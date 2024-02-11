/**
 * @name SelfJS
 * @description Breaking Discord's TOS to bot user accounts.
 * @author Эмберс
 * @version 2.10.11
 */

const https = require("https");
const ws = require("ws");
const fs = require("fs");

module.exports = {
	CDNBaseOpt: {
		host: "cdn.discordapp.com",
		port: 443
	},

	APIBaseOpt: {
		host: "discord.com",
		port: 443
	},

	status: {
		PLAYING: 0,
		STREAMING: 1,
		LISTENING: 2,
		WATCHING: 3,
		CUSTOM: 4,
		COMPETING: 5
	},

	sleep: function(millis) {
		return new Promise(function(res) {
			setTimeout(res, millis);
		});
	},

	jsonEncode: function(jsonData) {
		const str = JSON.stringify(jsonData);
		
		return str.replace(/[\u007F-\uFFFF]/g, function(chr) {
			const code = chr.charCodeAt(0).toString(16);

			return "\\u" + new Array(4 - code.length).fill('0').join("") + code;
		});
	},

	sendWebhookMessage: function(webhookID, webhookToken, inputData) {
		let options = null;
		let msgData = null;

		if(inputData) {
			msgData = module.exports.jsonEncode(inputData);
			options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/webhooks/${webhookID}/${webhookToken}`,
				headers: {
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};
		} else {
			msgData = module.exports.jsonEncode(webhookToken);
			options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: webhookID.split("//")[1].split('/').slice(1).join('/'),
				headers: {
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};
		}

		return new Promise(function(resolve) {
			const req = https.request(options, function(res) {
				res.on("end", resolve);
			});

			req.write(msgData);
			req.end();
		});
	},

	Client: class {
		constructor() {
			this.userID = null;
			this.token = null;
			this.socket = null;
			this.sessionID = null;
			this.onMessageFunction = null;
			this.onEditFunction = null;
			this.sequenceID = null;
			this.resumeURL = null;
			this.statusUpdateFunction = null;
			this.messageDeleteFunction = null;
			this.latency = null;
			this.beforeHB = null;
			this.hearbeatInterval = null;
		}

		login(token, isMobile = false, logMsgs = false) {
			return new Promise(function(resolve) {
				this.token = token;
			 	this.socket = new ws("wss://gateway.discord.gg?v=10&encoding=json");
				this.userID = null;
				this.sessionID = null;

				this.socket.on("open", function() {
					if(logMsgs) console.log("[MainControlSocket] Sending hello");

					this.socket.send(module.exports.jsonEncode({
						op: 2,
						d: {
							token: this.token,
							properties: {
								$os: isMobile ? "linux" : "windows",
								$browser: isMobile ? "Discord iOS" : "SelfJS",
								$device: isMobile ? "discord.gblk" : "SelfJS"
							}
						}
					}));
				}.bind(this));

				const socketMessageFunction = async function(payload) {
					payload = JSON.parse(payload.toString());

					if(payload.op == 10) {
						if(logMsgs) console.log("[MainControlSocket] Hello ACK received");

						if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
						this.beforeHB = Date.now();
						this.socket.send(module.exports.jsonEncode({op: 1, d: this.sequenceID}));

						this.hearbeatInterval = setInterval(function() {
							if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
							this.beforeHB = Date.now();
							this.socket.send(module.exports.jsonEncode({op: 1, d: this.sequenceID}));
						}.bind(this), payload.d.heartbeat_interval);
					} else if(payload.op == 11) {
						if(logMsgs) console.log("[MainControlSocket] Heartbeat ACK received");
						this.latency = Date.now() - this.beforeHB;
					} else if(payload.op == 0) {
						this.sequenceID = payload.s;

						if(payload.t == "READY") {
							this.userID = payload.d.user.id;
							this.sessionID = payload.d.session_id;
							this.resumeURL = payload.d.resume_gateway_url;

							if(logMsgs) console.log("[MainControlSocket] Ready message received");
							resolve();
						} else if(payload.t == "MESSAGE_CREATE") {
							const ackData = module.exports.jsonEncode({token: null});
							const options = {
								...module.exports.APIBaseOpt,
								method: "POST",
								path: `/api/v10/channels/${payload.d.channel_id}/messages/${payload.d.id}/ack`,
								headers: {
									"Authorization": this.token,
									"Content-Type": "application/json",
									"Content-Length": ackData.length
								}
							};

							const req = https.request(options);

							req.write(ackData);
							req.end();

							try {payload.d.author.self = payload.d.author.id == this.userID;} catch(e) {}

							if(typeof this.onMessageFunction == "function") this.onMessageFunction(payload.d);
						} else if(payload.t == "MESSAGE_UPDATE") {
							try {payload.d.author.self = payload.d.author.id == this.userID;} catch(e) {}

							if(typeof this.onEditFunction == "function") this.onEditFunction(payload.d);
						} else if(payload.t == "PRESENCE_UPDATE") {
							try {payload.d.author.self = payload.d.author.id == this.userID;} catch(e) {}

							if(typeof this.statusUpdateFunction == "function") this.statusUpdateFunction(payload.d);
						} else if(payload.t == "MESSAGE_DELETE") {
							if(typeof this.onDeleteFunction == "function") this.onDeleteFunction(payload.d);
						}
					} else if(payload.op == 7) {
						if(logMsgs) console.log("[MainControlSocket] Reconnect message received");

						if(this.hearbeatInterval) clearInterval(this.hearbeatInterval);
						this.socket.terminate();

						this.socket = new ws("wss://gateway.discord.gg?v=10&encoding=json");

						this.socket.on("open", function() {
							if(logMsgs) console.log("[MainControlSocket] Resume message sent");

							this.socket.send(module.exports.jsonEncode({
								op: 6,
								d: {
									token: this.token,
									session_id: this.sessionID,
									seq: this.sequenceID
								}
							}));
						}.bind(this));

						this.socket.on("message", socketMessageFunction);
					}
				}.bind(this);

				this.socket.on("message", socketMessageFunction);
			}.bind(this));
		}

		makeRequest(options = {}, base = module.exports.APIBaseOpt) {
			const path    = options.path    || '/';
			const method  = options.method  || "GET";
			const headers = options.headers || {};
			const body    = options.body    || undefined;
		
			const strBody = module.exports.jsonEncode(body) ?? "";

			headers["Authorization"] = this.token;
			headers["Content-Type"] = "application/json";
			headers["Content-Length"] = strBody.length;

			const reqOptions = {
				...base,
				path,
				method,
				headers
			};

			return new Promise(function(resolve) {
				const req = https.request(reqOptions, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				if(strBody) req.write(strBody);
				req.end();
			});
		}

		onMessage(msgFunc) {
			this.onMessageFunction = msgFunc;
		}

		onMessageEdit(editFunc) {
			this.onEditFunction = editFunc;
		}

		onMessageDelete(deleteFunc) {
			this.onDeleteFunction = deleteFunc;
		}

		onStatusUpdate(statusFunc) {
			this.statusUpdateFunction = statusFunc;
		}

		getDMChannel(userID) {
			const channelData = module.exports.jsonEncode({recipients: [userID]});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: "/api/v10/users/@me/channels",
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": channelData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(channelData);
				req.end();
			});
		}

		getRoles(serverID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/users/${userID}/profile?with_mutual_guilds=false&guild_id=${serverID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)).guild_member.roles);
					});
				});

				req.end();
			});
		}

		uploadFile(channelID, fileName, isSpoiled = false, msgContent = "", messageID = null) {
			const fileData = fs.readFileSync(fileName);

			if(fileData.length >= 26214400) return null;

			fileName = fileName.split('/').pop();

			const requestData = module.exports.jsonEncode({
				files: [
					{
						filename: fileName,
						file_size: fileData.length,
						id: '1'
					}
				]
			});
			const requestOptions = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/attachments`,
				headers: {
					"Content-Type": "application/json",
					"Authorization": this.token,
					"Content-Length": requestData.length
				}
			};

			return new Promise(function(resolve) {
				const requestReq = https.request(requestOptions, function(requestRes) {
					const requestChunks = [];
					const fileTable = {
						png: "image/png",
						jpg: "image/jpeg",
						jpeg: "image/jpeg",
						js: "application/javascript",
						json: "application/json",
						html: "text/html",
						mp4: "video/mp4",
						mp3: "audio/mpeg",
						css: "text/css",
						c: "text/x-c",
						cpp: "text/x-c",
						h: "text/x-c",
						hpp: "text/x-c",
						bat: "application/x-msdownload",
						exe: "application/x-msdownload",
						asm: "text/x-asm",
						webp: "image/webp",
						webm: "video/webm",
						mov: "video/quicktime",
						mkv: "video/x-matroska",
						java: "text/x-java-source",
						class: "application/java-vm",
						jar: "application/java-archive",
						wav: "audio/x-wav",
						zip: "application/zip",
						rar: "application/x-rar-compressed",
						txt: "text/plain",
						log: "text/plain",
						lua: "text/x-lua",
						xml: "application/xml"
					};

					requestRes.on("data", function(chunk) {
						requestChunks.push(chunk);
					}).on("end", function() {
						const requestResData = JSON.parse(Buffer.concat(requestChunks));
					
						const fileOptions = {
							host: "discord-attachments-uploads-prd.storage.googleapis.com",
							port: 443,
							method: "PUT",
							path: `/${requestResData.attachments[0].upload_url.split('/').slice(3).join('/')}`,
							headers: {
								"Content-Type": fileTable[fileName.split('.').slice(-1)[0]] ?? false,
								"Content-Length": fileData.length
							}
						};

						const fileRequest = https.request(fileOptions, function(fileRes) {
							const fileChunks = [];
							
							fileRes.on("data", function(chunk) {
								fileChunks.push(chunk);
							}).on("end", function() {
								let finalData = module.exports.jsonEncode({
									content: msgContent,
									attachments: [
										{
											id: '0',
											filename: (isSpoiled ? "SPOILER_" : "") + fileName,
											uploaded_filename: requestResData.attachments[0].upload_filename
										}
									]
								});
								
								if(messageID) {
									finalData = JSON.parse(finalData);
									finalData.message_reference = {
										channel_id: channelID,
										message_id: messageID
									};

									finalData = module.exports.jsonEncode(finalData);
								}

								const finalOptions = {
									...module.exports.APIBaseOpt,
									method: "POST",
									path: `/api/v10/channels/${channelID}/messages`,
									headers: {
										"Content-Type": "application/json",
										"Authorization": this.token,
										"Content-Length": finalData.length
									}
								};

								const finalReq = https.request(finalOptions, function(finalRes) {
									const finalChunks = [];

									finalRes.on("data", function(chunk) {
										finalChunks.push(chunk);
									}).on("end", function() {
										resolve(JSON.parse(Buffer.concat(finalChunks)));
									});
								});

								finalReq.write(finalData);
								finalReq.end();
							}.bind(this));
						}.bind(this));

						fileRequest.write(fileData);
						fileRequest.end();
					}.bind(this));
				}.bind(this));

				requestReq.write(requestData);
				requestReq.end();
			}.bind(this));
		}

		search(channelID, options) {
			options = options || {};

			const pinned = options.pinned ?? null;
			const author = options.author ?? null;
			const mentions = options.mentions ?? null;
			const has = options.has ?? null;
			const minDate = options.minDate ?? null;
			const maxDate = options.maxData ?? null;
			const content = options.content ?? null;
			const offset = options.offset ?? null;

			let path = `/api/v10/channels/${channelID}/messages/search?`;

			if(pinned != null) path += `pinned=${pinned}&`;
			if(minDate != null) path += `min_id=${minDate}&`;
			if(maxDate != null) path += `max_id=${maxDate}&`;
			if(offset != null) path += `offset=${offset}&`;
			if(content != null) path += `content=${encodeURI(content)}&`;
			if(author != null) path += author.map((e) => `author_id=${e}`).join('&') + '&';
			if(mentions != null) path += mentions.map((e) => `mentions=${e}`).join('&') + '&';
			if(has != null) path += has.map((e) => `has=${e}`).join('&');

			const requestOptions = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path,
				headers: {
					"Authorization": this.token
				}
			};
			
			return new Promise(function(resolve) {
				const req = https.request(requestOptions, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		getUserData(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/users/${userID}/profile?with_mutual_guilds=false`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		setRolesForMemeber(serverID, userID, roleIDs) {
			const roleData = module.exports.jsonEncode(roleIDs);
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/guilds/${serverID}/members/${userID}`,
				headers: {
					"Content-Type": "application/json",
					"Content-Length": roleData.length,
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(roleData);
				req.end();
			});
		}

		async sendMessage(channelID, message) {
			return await this.makeRequest({
				method: "POST",
				path: `/api/v10/channels/${channelID}/messages`,
				body: {
					content: message
				}
			});
		}

		async replyToMessage(channelID, messageID, message) {
			return await this.makeRequest({
				method: "POST",
				path: `/api/v10/channels/${channelID}/messages`,
				body: {
					content: message,
					message_reference: {
						channel_id: channelID,
						message_id: messageID
					}
				}
			});
		}

		createChannel(guildID, name, type, parentID = null) {
			const channelData = module.exports.jsonEncode({name, type, parent_id: parentID});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/guilds/${guildID}/channels`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": channelData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(channelData);
				req.end();
			});
		}

		setChannelPermissions(channelID, userID, allow, deny) {
			const permissionData = module.exports.jsonEncode({id: userID, allow, deny, type: 1});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/channels/${channelID}/permissions/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": permissionData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(permissionData);
				req.end();
			});
		}

		getMessages(channelID, limit) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/channels/${channelID}/messages?limit=${limit}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		getUsers(guildID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/guilds/${guildID}/members`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		removeFromChannel(channelID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/recipients/${userID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		leaveChannel(channelID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});
				
				req.end();
			}.bind(this));
		}

		ring(channelID, userIDs) {
			const ringData = module.exports.jsonEncode({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/call/ring`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ringData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ringData);
				req.end();
			});
		}

		stopRinging(channelID, userIDs) {
			const ringData = module.exports.jsonEncode({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/call/stop-ringing`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ringData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ringData);
				req.end();
			});
		}

		addToChannel(channelID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/channels/${channelID}/recipients/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		async getAvatar(userID, size = 256) {
			let avatarID = null;

			try {
				avatarID = await this.getUserData(userID);
				avatarID = avatarID.user.avatar;
			} catch(e) {
				return null;
			}

			const options = {
				...module.exports.CDNBaseOpt,
				method: "GET",
				path: `/avatars/${userID}/${avatarID}.webp?size=${size}`
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(Buffer.concat(chunks));
					});
				});

				req.end();
			});
		}

		addFriend(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		editMessage(channelID, messageID, newMessage) {
			const msgData = module.exports.jsonEncode({content: newMessage});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}/messages/${messageID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(msgData);
				req.end();
			});
		}

		removeFriend(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		renameChannel(channelID, channelName) {
			const nameData = module.exports.jsonEncode({name: channelName});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": nameData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(nameData);
				req.end();
			});
		}

		block(userID) {
			const blockData = module.exports.jsonEncode({type: 2});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": blockData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(blockData);
				req.end();
			});
		}

		unblock(userID) {
			return new Promise(function(resolve) {
				this.removeFriend(userID).then(resolve);
			}.bind(this));
		}

		deleteMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/messages/${messageID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		setStatus(status, activities, afk = false) {
			return new Promise(function (resolve) {
				this.socket.send(module.exports.jsonEncode({
					op: 3,
					d: {
						since: Date.now(),
						status,
						activities,
						afk
					}
				}));

				setTimeout(resolve, 1000);
			}.bind(this));
		}

		createGroupChat(userIDs) {
			const userData = module.exports.jsonEncode({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/users/@me/channels`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": userData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(userData);
				req.end();
			});
		}

		startTyping(channelID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/typing`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		pinMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/channels/${channelID}/pins/${messageID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		unpinMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/pins/${messageID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		editNote(userID, note) {
			const noteData = module.exports.jsonEncode({note});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/notes/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": noteData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(noteData);
				req.end();
			});
		}

		getChannelData(channelID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					let chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		transferOwnership(channelID, userID) {
			const ownershipData = module.exports.jsonEncode({owner: userID});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ownershipData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ownershipData);
				req.end();
			});
		}
	}
};
