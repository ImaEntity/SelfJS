/**
 * @name SelfJS
 * @description Breaking Discord's TOS to bot user accounts.
 * @author Entity
 * @version 4.0.1
 */

const EventEmitter = require("events");
const https = require("https");
const ws = require("ws");

const DISCORD_EPOCH = 1420070400000n;
const SELF_VERSION = "v4.0";
const WS_ENDPOINT  = "wss://gateway.discord.gg?v=10&encoding=json";
const LOGIN_PROPS  = {
    os: process.platform,
	browser: "SelfJS",
    device: "NodeJS"
};

const Status = {
    PLAYING       : 0,
    STREAMING     : 1,
    LISTENING     : 2,
    WATCHING      : 3,
    CUSTOM_STATUS : 4,
    COMPETING     : 5
};

const OPCODES = {
    GATEWAY: {
        DISPATCH                  : 0,
        HEARTBEAT                 : 1,
        IDENTIFY                  : 2,
        PRESENCE_UPDATE           : 3,
        VOICE_STATE_UPDATE        : 4,
        RESUME                    : 6,
        RECONNECT                 : 7,
        REQUEST_GUILD_MEMBERS     : 8,
        INVALID_SESSION           : 9,
        HELLO                     : 10,
        HEARTBEAT_ACK             : 11,
        REQUEST_SOUNDBOARD_SOUNDS : 31
    },

    // fuck this stupid ass DAVE protocol
    VOICE: {
        IDENTIFY                            : 0,
        SELECT_PROTOCOL                     : 1,
        READY                               : 2,
        HEARTBEAT                           : 3,
        SESSION_DESCRIPTION                 : 4,
        SPEAKING                            : 5,
        HEARTBEAT_ACK                       : 6,
        RESUME                              : 7,
        HELLO                               : 8,
        RESUMED                             : 9,
        CLIENTS_CONNECT                     : 11,
        CLIENT_DISCONNECT                   : 13,
        DAVE_PREPARE_TRANSITION             : 21,
        DAVE_EXECUTE_TRANSITION             : 22,
        DAVE_TRANSITION_READY               : 23,
        DAVE_PREPARE_EPOCH                  : 24,
        DAVE_MLS_EXTERNAL_SENDER            : 25,
        DAVE_MLS_KEY_PACKAGE                : 26,
        DAVE_MLS_PROPOSALS                  : 27,
        DAVE_MLS_COMMIT_WELCOME             : 28,
        DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION : 29,
        DAVE_MLS_WELCOME                    : 30,
        DAVE_MLS_INVALID_COMMIT_WELCOME     : 31
    }
};

// Formats JSON in a way that makes the Discord API
// able to accept random unicode characters
function unison(jsonData) {
    return JSON.stringify(jsonData)?.replace(
        /[\u007F-\uFFFF]/g,
        c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
}

function rawRequest(options={}) {
    const host    = options.host    ?? "discord.com";
    const port    = options.port    ?? 443;
    const headers = options.headers ?? {};
    const isJson  = options.isJson  ?? true;
    const query   = options.query   ?? [];
    const path    = !options.useCustomPath ?
        `/api/v10${options.path}` : options.path;

    let body = options.body;
    if(isJson && body != null) {
        body = unison(body);
        headers["Content-Type"] = "application/json";
    }

    headers["Content-Length"] = body != null ? Buffer.byteLength(body) : 0;

    if(!options.path || !options.method)
        throw new Error(".path and .method properties are required!");

    const rawQuery = Object.entries(query)
        .filter(e => e[0] != null && e[1] != null)
        .map(function(e) {
            const key = encodeURIComponent(e[0]);
            if(!Array.isArray(e[1])) return `${key}=${encodeURIComponent(e[1])}`;
            return e[1].map(v => `${key}=${v}`).join('&');
        }).join('&');
    
    const reqOptions = {
        host,
        port,
        path: `${path}${rawQuery != "" ? '?' : ""}${rawQuery}`,
        headers,
        method: options.method
    };

    return new Promise(function(resolve) {
        const req = https.request(reqOptions, function(res) {
            const chunks = [];

            res.on("data", c => chunks.push(c));
            res.on("end", function() {
                const data = Buffer.concat(chunks);

                try {
                    if(isJson) resolve(JSON.parse(data));
                } catch {}
                
                resolve(data);
            });
        });

        if(body != null) req.write(body);
        req.end();
    });
}

const POST   = (options) => rawRequest({...options, method: "POST"});
const GET    = (options) => rawRequest({...options, method: "GET"});
const PATCH  = (options) => rawRequest({...options, method: "PATCH"});
const DELETE = (options) => rawRequest({...options, method: "DELETE"});
const PUT    = (options) => rawRequest({...options, method: "PUT"});

/**
 * Validates the provided token and returns some user data from the websocket  
 * Only use this function if you need basic user data, but dont need to login
 * @param {String} token The token to validate
 * @returns {Promise<Object|null>} User data returned from the websocket, null if invalid
 */
async function validateToken(token) {
    const socket = new ws(WS_ENDPOINT);
    if(!token) return null;

    socket.on("open", function() {
        socket.send(unison({
            op: OPCODES.GATEWAY.IDENTIFY,
            d: {token, properties: LOGIN_PROPS}
        }));
    });

    return await new Promise(function(resolve) {
        socket.on("error", function() {
            socket.close();
            resolve(null);
        });
        
        socket.on("message", function(data) {
            data = JSON.parse(data.toString());
            if(data.op == OPCODES.GATEWAY.HELLO)
                socket.send(unison({op: OPCODES.GATEWAY.HEARTBEAT, d: 0}));

            if(data.op == OPCODES.GATEWAY.DISPATCH && data.t == "READY") {
                socket.close();
                resolve(data.d.user);
            }
            
            if(data.op == OPCODES.GATEWAY.INVALID_SESSION) {
                socket.close();
                resolve(null);
            }
        });
    });
}

/**
 * Creates a new token from the provided account credientials if possible  
 * Let's the user handle mfa if required by the account
 * @param {Object} options Options for getting a token
 * @param {String} options.email The email to use for finding a token
 * @param {String} options.password The password to use for getting a token
 * @returns {Promise<Object|null>} An object containing a token, mfa methods and a callback, or null
 */
async function createToken(options) {
    const {email, password} = options;
    if(!email || !password) return null;

    const loginData = await POST({
        path: "/auth/login",
        body: {login: email, password}
    });

    if(!loginData.user_id) return null;
    if(!loginData.mfa) return {
        token: loginData.token,
        user_id: loginData.user_id,
        mfaRequired: false
    };

    return {
        user_id: loginData.user_id,
        mfaRequired: true,
        mfaMethods: Object.entries(loginData)
            .filter(([k, v]) => k != "mfa" && v === true)
            .map(([k, _v]) => k),
        
        confirmMFA: async function(mfaMethod, data) {
            if(mfaMethod == "mfa" || loginData[mfaMethod] !== true)
                return null;
            
            if(mfaMethod == "sms")
                throw new Error("SMS MFA is currently unsupported");

            return POST({
                path: `/auth/mfa/${mfaMethod}`,
                body: {
                    ...data,
                    login_instance_id: loginData.login_instance_id,
                    ticket: loginData.ticket,
                    gift_code_sku_id: null,
                    login_source: null
                }
            });
        }
    };
}

/**
 * Converts a discord snowflake to a UTC timestamp
 * @param {String} snowflake The discord snowflake to convert
 * @returns {Number} The resultant UTC timestamp
 */
function snowflakeToUTC(snowflake) {
    return Number((BigInt(snowflake) >> 22n) + DISCORD_EPOCH);
}

/**
 * Converts a UTC timestamp to a discord snowflake
 * Importantly, the resultant snowflake does not contain process id, worker id, or sequence values
 * @param {Number} timestamp The UTC timestamp to convert
 * @returns {String} The resultant snowflake
 */
function UTCToSnowflake(timestamp) {
    return ((BigInt(timestamp) - DISCORD_EPOCH) << 22n).toString();
}

class Client extends EventEmitter {
    #socket             = null;
    #sessionID          = null;
    #sequenceID         = null;
    #resumeURL          = null;
    #heartbeatInterval  = null;
    #lastHeartbeatSent  = null;
    #heartbeatIntTime   = null;
    #properties         = null;
    #debugLogs          = null;
    #POST               = null;
    #GET                = null;
    #PATCH              = null;
    #DELETE             = null;
    #PUT                = null;
    #handleHeartbeatACK = null;
    #identifiedClient   = null;
    #intents            = null;

    constructor(options={}) {
        super();

        this.#properties = options.properties ?? LOGIN_PROPS;
        this.#debugLogs  = options.debugLogs  ?? true;
        this.#intents    = options.intents    ?? null;

        this.token   = null;
        this.user    = null;
        this.latency = null;
    }
    
    #log(...args) {
        if(!this.#debugLogs) return;
        console.log(`(SelfJS ${SELF_VERSION}) [MainControlSocket]`, ...args);
    }

    #handleHeartbeat(interval) {
        if(this.#heartbeatInterval)
            clearInterval(this.#heartbeatInterval);

        this.#heartbeatIntTime = interval;

        let heartbeatFailed = false;
        function sendHeartbeat() {
            if(heartbeatFailed) {
                this.#log("Heartbeat failed, attempting reconnect");
                this.#reconnect();
                return;
            }

            this.#socket.send(unison({op: OPCODES.GATEWAY.HEARTBEAT, d: this.#sequenceID}));
            this.#lastHeartbeatSent = Date.now();
            heartbeatFailed = true;
            
            this.#log("Sent heartbeat");
        }

        this.#heartbeatInterval = setInterval(sendHeartbeat.bind(this), interval);
        sendHeartbeat.call(this);
        
        return () => {
            this.latency = Date.now() - this.#lastHeartbeatSent;
            heartbeatFailed = false;

            this.#log("Heartbeat acknowledged, updated latency");

            if(this.#identifiedClient) return;
            this.#identifiedClient = true;

            this.#socket.send(unison({
                op: OPCODES.GATEWAY.IDENTIFY,
                d: {
                    token: this.token,
                    properties: this.#properties,
                    ...(this.#intents != null && {intents: this.#intents}) // what the fuck
                }
            }));

            this.#log("Sent identifier packet");
        };
    }

    #reconnect() {
        this.#socket.removeAllListeners("close");
        this.#socket.terminate();

        this.#socket = new ws(this.#resumeURL);
        this.#socket.on("open", function() {
            this.#socket.send(unison({
                op: OPCODES.GATEWAY.RESUME,
                d: {token: this.token, session_id: this.#sessionID, seq: this.#sequenceID}
            }));

            this.#log("Requested session resume");
        }.bind(this));

        this.#socket.on("error", console.error);
        this.#socket.on("close", this.#handleClose.bind(this));
        this.#socket.on("message", this.#handlePacket.bind(this));
    }

    #handlePacket(data) {
        const packet = JSON.parse(data.toString());
        switch(packet.op) {
            case OPCODES.GATEWAY.HELLO:
                this.#handleHeartbeatACK = this.#handleHeartbeat(packet.d.heartbeat_interval);
                break;

            case OPCODES.GATEWAY.HEARTBEAT: {
                this.#log("Received heartbeat timer reset");
                this.#handleHeartbeatACK = this.#handleHeartbeat(this.#heartbeatIntTime);
                break;
            }

            case OPCODES.GATEWAY.HEARTBEAT_ACK:
                this.#handleHeartbeatACK();
                break;

            case OPCODES.GATEWAY.INVALID_SESSION: {
                this.#log("Session invalidated");

                if(!packet.d) {
                    this.disconnect();
                    this.emit("INVALID_SESSION");
                    break;
                }

                this.#reconnect();
                break;
            }

            case OPCODES.GATEWAY.RECONNECT: {
                this.#log("Received reconnect request");
                this.#reconnect();
                break;
            }

            case OPCODES.GATEWAY.DISPATCH:
                this.#handleDispatch(packet);
                break;

            default: {
                const opcodeName = Object.keys(OPCODES.GATEWAY)[Object.values(OPCODES.GATEWAY).indexOf(packet.op)];
                this.#log(`Received unknown opcode: ${opcodeName ?? packet.op}`);
                break;
            }
        }
    }

    #handleClose(code) {
        this.#log(`Connection closed with code: ${code}`);
        this.emit("DISCONNECT");

        const reconnectableCodes = [
            4000, 4001, 4002, 4003,
            4005, 4007, 4008, 4009
        ];

        if(!reconnectableCodes.includes(code)) {
            this.login(this.token);
            return;
        }

        this.#reconnect();
    }

    #handleDispatch(packet) {
        this.#sequenceID = packet.s;
        
        let ackMessage = true;
        switch(packet.t) {
            case "READY": {
                this.#resumeURL = packet.d.resume_gateway_url;
                this.#sessionID = packet.d.session_id;
                this.user       = packet.d.user;
                break;
            }

            case "MESSAGE_CREATE": {
                packet.d.preventACK = () => ackMessage = false;
                packet.d.author.self = this.user.id == packet.d.author.id;
                break;
            }
        }

        this.emit(packet.t, packet.d);
        if(
            packet.d?.author?.id == this.user.id ||
            packet.t != "MESSAGE_CREATE" ||
            !ackMessage
        ) return;
    
        this.ackMessage(packet.d);    
    }

    login(token) {
        this.#POST   = (options) => POST  ({...options, headers: {"Authorization": token, ...options.headers}});
        this.#GET    = (options) => GET   ({...options, headers: {"Authorization": token, ...options.headers}});
        this.#PATCH  = (options) => PATCH ({...options, headers: {"Authorization": token, ...options.headers}});
        this.#DELETE = (options) => DELETE({...options, headers: {"Authorization": token, ...options.headers}});
        this.#PUT    = (options) => PUT   ({...options, headers: {"Authorization": token, ...options.headers}});
        
        this.token = token;

        this.#identifiedClient = false;
        this.#socket = new ws(this.#resumeURL ?? WS_ENDPOINT);

        this.#socket.on("open", () => this.#log("Initialized socket"));
        this.#socket.on("error", console.error);
        this.#socket.on("close", this.#handleClose.bind(this));
        this.#socket.on("message", this.#handlePacket.bind(this));
    }

    // temp, while other shits being added
    _attachMethod(options={}) {
        this[options.methodName] = function(...args) {
            options.method(this.#socket, {
                POST   : this.#POST,
                GET    : this.#GET,
                PATCH  : this.#PATCH,
                DELETE : this.#DELETE,
                PUT    : this.#PUT
            }, ...args);
        };
    }

    /**
     * Acknowledges that a message was sent, and removes the notification for it
     * @param {Object} message The message being acknowledged
     * @param {String} message.channel_id The id of the channel which the message was sent in
     * @param {String} message.id The id of the message that was sent
     * @returns {Promise<Object>} The exact response from discord
     */
    ackMessage(message) {
        return POST({path: `/channels/${message.channel_id}/messages/${message.id}/ack`});
    }

    async #uploadFiles(msg) {
        const files = msg.files.map(function(file, idx) {
            return {
                id: (idx + 1).toString(),
                file_size: Buffer.byteLength(file.data),
                ...file
            };
        });

        const attachments = [];
        const uploadSources = await this.#POST({
            path: `/channels/${msg.channel_id}/attachments`,
            body: {files}
        });

        for(let i = 0; i < uploadSources.attachments.length; i++) {
            const source = uploadSources.attachments[i];
            const url = new URL(source.upload_url);
            
            await PUT({
                host: url.host,
                port: url.port,
                path: url.pathname + url.search,
                useCustomPath: true, isJson: false,
                body: msg.files[i].data,
                headers: {
                    "Content-Type": "application/octet-stream"
                }
            });

            attachments.push({
                id: source.id,
                uploaded_filename: source.upload_filename,
                filename: `${msg.files[i].spoiled ? "SPOILER_" : ""}${files[i].filename}`,
                ...files[i]
            });
        }

        return attachments;
    }

    /**
     * Sends a message in a specified channel, with optional file attachments
     * @param {Object} message The message object to send
     * @param {String} message.channel_id The id of the channel to send the message in
     * @param {String} [message.content] The content for the message, if not specified, a files list must be
     * @param {Array<Object>} [message.files] A list of files to send, if not specified, message content must be
     * @param {Object} [message.message_reference] An optional message to reply to
     * @param {String} message.message_reference.id The id of the message to reply to
     * @param {String} message.message_reference.channel_id The channel id of the message to reply to, must be the same as message.channel_id
     * @returns {Promise<Object>} The message object as stored on the server
     */
    async sendMessage(message) {
        if(message.files) message.attachments = await this.#uploadFiles(message);
        if(message.message_reference) message.message_reference.message_id = message.message_reference.id;

        return this.#POST({
            path: `/channels/${message.channel_id}/messages`,
            body: message
        });
    }

    /**
     * Edits a message in a specified channel, with optional file attachments
     * @param {Object} message The message object to edit
     * @param {String} message.id The id of the message to edit
     * @param {String} message.channel_id The id of the channel to edit the message in
     * @param {String} [message.content] The content for the message, if not specified, a files list must be
     * @param {Array<Object>} [message.files] A list of files to edit, if not specified, message content must be
     * @returns {Promise<Object>} The message object as stored on the server
     */
    async editMessage(message) {
        if(message.files) message.attachments = await this.#uploadFiles(message);

        return this.#PATCH({
            path: `/channels/${message.channel_id}/messages/${message.id}`,
            body: message
        });
    }  

    /**
     * Gets the channels active in the DM list of the user, channels can be both DMs and group chats
     * @returns {Promise<Object>} The list of channels open in the user's DM list
     */
    getOpenChannels() { return this.#GET({path: "/users/@me/channels"}); }

    /**
     * Closes the current session and disconnects from discord
     * Once this is done a client will no longer see events
     * And will need to create a new session via the login function
     * @param {number} [code] The close code to send to discord, 1000 if not provided
     * @returns {void}
     */
    disconnect(code=1000) {
        this.#handleHeartbeatACK = null;
        if (this.#heartbeatInterval)
            clearInterval(this.#heartbeatInterval);

        this.#socket.removeAllListeners("close");
        this.#socket.close(code);
        this.#socket = null;

        this.emit("DISCONNECT");
    }

    /**
     * Sets the current activities, and status of the user
     * @param {Object} options The options used to set the user data
     * @param {"online" | "idle" | "dnd" | "invisible"} options.status Used to set the status of the client
     * @param {Array<{
     *     type: number,
     *     name: String
     * }>} options.activities Used to provide a list of activities
     * 
     * @returns {void}
     */
    setStatus(options) {
        for(const activity of options.activities) {
            if(activity.type == Status.CUSTOM_STATUS) {
                activity.state = activity.name;
                activity.name = "Custom Status";
            } else if(activity.type == Status.STREAMING)
                activity.details = activity.name;
        }

        this.#socket.send(unison({
            op: OPCODES.GATEWAY.PRESENCE_UPDATE,
            d: {
                afk: false,
                since: Date.now(),
                ...options
            }
        }));
    }

    /**
     * Logs out the current token
     * @returns {Promise<Object>} The result of the logout request
     */
    logout() {
        this.disconnect();
        return this.#POST({path: "/auth/logout"});
    }
    
    /**
     * Adds a reaction to a specified message
     * @param {Object} options The options specifying which message and reaction to add
     * @param {String} options.emoji The emoji reaction to add to the message
     * @param {String} options.channel_id The id of the channel the message is in
     * @param {String} options.message_id The id of the message to add the reaction to
     * @returns {Promise<Object>} The response from the server
     */
    addReaction(options) {
        const emoji = encodeURIComponent(options.emoji);

        return this.#PUT({
            path: `/channels/${options.channel_id}/messages/${options.message_id}/reactions/${emoji}/@me`
        });
    }

    /**
     * Removes a reaction from a specified message
     * @param {Object} options The options specifying which message and reaction to remove
     * @param {String} options.emoji The emoji reaction to remove from the message
     * @param {String} options.channel_id The id of the channel the message is in
     * @param {String} options.message_id The id of the message to remove the reaction from
     * @returns {Promise<Object>} The response from the server
     */
    removeReaction(options) {
        const emoji = encodeURIComponent(options.emoji);
        
        return this.#DELETE({
            path: `/channels/${options.channel_id}/messages/${options.message_id}/reactions/${emoji}/@me`
        });
    }

    /**
     * Searches for messages in a certain channel
     * @param {Object} options The options specifying what to search for and in which channel
     * @param {String} options.channel_id The channel id to search in
     * @param {String} [options.content] Only return messages that include this content
     * @param {Array<String>} [options.authors] Only return messages from these user ids
     * @param {Array<String>} [options.mentions] Only return messages that mention one these user ids
     * @param {Array<"image" | "video" | "link" | "file" | "embed" | "sound" | "poll" | "sticker" | "snapshot">} [options.contentTypes] Searches for messages that contain one of these content types
     * @param {Boolean} [options.pinned] Only included pinned messages in the search results
     * @param {Array<"user" | "bot" | "webhook">} [options.authorTypes] Only return messages from these author types 
     * @param {"new" | "old" | "relevance"} [options.sort] Sort resulting messages in this order
     * @param {Number} [options.offset] Skip this number of messages in the returned data
     * @param {Number} [options.after] Only return messages after this utc timestamp
     * @param {Number} [options.before] Only return messages before this utc timestamp
     * @returns {Promise<Object>} The result of the search, contains both channel and message data
     */
    search(options) {
        const minDate = options.after ? UTCToSnowflake(options.after) : null;
        const maxDate = options.before ? UTCToSnowflake(options.before) : null;

        return this.#GET({
            path: `/channels/${options.channel_id}/messages/search`,
            query: {
                sort_by: options.sort == "relevance" ? "relevance" : "timestamp",
                sort_order: options.sort == "old" ? "asc" : "desc",
                offset: options.offset ?? 0,
                author_id: options.authors,
                author_type: options.authorTypes,
                pinned: options.pinned,
                mentions: options.mentions,
                has: options.contentTypes,
                content: options.content,
                min_id: minDate,
                max_id: maxDate
            }
        });
    }

    /**
     * Gets recent messages in a certain channel
     * @param {Object} options The options specifying what channel to get messages in and how many
     * @param {String} options.channel_id The channel id to get messages from
     * @param {Number} [options.limit] The max amount of messages to return
     * @param {String} [options.before] Only return messages before this message id
     * @returns {Promise<Array>} The list of messages in order from newest to oldest
     */
    getMessages(options) {
        return this.#GET({
            path: `/channels/${options.channel_id}/messages`,
            query: {limit: options.limit, before: options.before}
        });
    }
}

module.exports = {
    Status,
	validateToken,
	createToken,
    UTCToSnowflake,
    snowflakeToUTC,
    Client
};