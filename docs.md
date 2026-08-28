# SelfJS Documentation
Welcome To SelfJS Documentation  

> [!WARNING]  
> These docs might not be up to date or 100% correct, Self is always being added to.  
> If a descrepancy is found perfer the JSdoc included with the self.js file

## Installation

```bash
npm install @imaentity/selfjs
```

## Import

```javascript
const self = require("@imaentity/selfjs");
```

---

# Constants

## `Status`

Contains the activity types used by Discord.

```javascript
Status.PLAYING        // 0
Status.STREAMING      // 1
Status.LISTENING      // 2
Status.WATCHING       // 3
Status.CUSTOM_STATUS  // 4
Status.COMPETING      // 5
```

---

# Functions

## `validateToken(token)`

Checks whether a Discord token is valid without creating a persistent `Client`.

Returns the user's Discord user object if valid, or `null` if the token is invalid.

### Parameters

| Name    | Type     | Description                    |
| ------- | -------- | ------------------------------ |
| `token` | `String` | The Discord token to validate. |

### Returns

```javascript
Promise<Object | null>
```

### Example

```javascript
const user = await self.validateToken(token);

if(user)
    console.log(`Logged in as ${user.username}`);
else
    console.log("Invalid token");
```

---

## `createToken(options)`

Attempts to log into a Discord account using an email and password.

If MFA is not enabled, the returned object contains the token immediately.

If MFA is required, the returned object contains the available MFA methods and a `confirmMFA()` function.

### Parameters

| Name               | Type     | Description       |
| ------------------ | -------- | ----------------- |
| `options`          | `Object` | Login options.    |
| `options.email`    | `String` | Account email.    |
| `options.password` | `String` | Account password. |

### Returns

```javascript
Promise<Object | null>
```

### Successful login

```javascript
{
    token: String,
    user_id: String,
    mfaRequired: false
}
```

### MFA login

```javascript
{
    user_id: String,
    mfaRequired: true,
    mfaMethods: Array<String>,
    confirmMFA: Function
}
```

### Example

```javascript
const login = await self.createToken({
    email: "discord@example.com",
    password: "password"
});

if(!login)
    throw new Error("Login failed");

if(!login.mfaRequired) {
    console.log(login.token);
} else {
    console.log("MFA methods:", login.mfaMethods);

    const result = await login.confirmMFA("totp", {
        code: "123456"
    });

    console.log(result);
}
```

> [!NOTE]
> SMS MFA is currently unsupported.

---

## `snowflakeToUTC(snowflake)`

Converts a Discord snowflake into a UTC timestamp.

The returned timestamp is in milliseconds since Unix epoch.

### Parameters

| Name        | Type     | Description        |
| ----------- | -------- | ------------------ |
| `snowflake` | `String` | Discord snowflake. |

### Returns

```javascript
Number
```

### Example

```javascript
const timestamp = self.snowflakeToUTC("1329029486758592595");

console.log(new Date(timestamp));
```

---

## `UTCToSnowflake(timestamp)`

Converts a UTC timestamp into a Discord snowflake.

The generated snowflake only contains the timestamp portion. Worker ID, process ID, and sequence values are zero.

### Parameters

| Name        | Type     | Description                    |
| ----------- | -------- | ------------------------------ |
| `timestamp` | `Number` | UTC timestamp in milliseconds. |

### Returns

```javascript
String
```

### Example

```javascript
const snowflake = self.UTCToSnowflake(Date.now());

console.log(snowflake);
```

---

# Client

`Client` provides an interface for connecting to Discord and interacting with the account.

## Creating a client

```javascript
const client = new self.Client();
```

### Options

```javascript
const client = new self.Client({
    properties: {
        os: process.platform,
        browser: "SelfJS",
        device: "NodeJS"
    },

    debugLogs: true,

    intents: 0
});
```

| Option       | Type      | Default       | Description                   |
| ------------ | --------- | ------------- | ----------------------------- |
| `properties` | `Object`  | `LOGIN_PROPS` | Gateway identify properties.  |
| `debugLogs`  | `Boolean` | `true`        | Enables SelfJS debug logging. |
| `intents`    | `Number`  | `null`        | Gateway intents.              |

---

# Properties

## `client.user`

The user object belonging to the logged-in account.

```javascript
console.log(client.user);
```

This is populated after the `READY` event.

---

## `client.token`

The token currently being used by the client.

```javascript
console.log(client.token);
```

---

## `client.latency`

The time between sending a heartbeat and receiving its acknowledgement.

```javascript
console.log(client.latency);
```

The value is in milliseconds.

---

# Login

## `client.login(token)`

Connects the client to the Discord Gateway using the provided token.

### Parameters

| Name    | Type     | Description            |
| ------- | -------- | ---------------------- |
| `token` | `String` | Discord account token. |

### Example

```javascript
client.login(token);
```

Once connected, events can be received using `client.on()`.

---

# Events

`Client` extends Node.js `EventEmitter`, so events can be listened to using `.on()`.

```javascript
client.on("MESSAGE_CREATE", message => {
    console.log(message.content);
});
```

## `READY`

Emitted when the client successfully logs in.

```javascript
client.on("READY", data => {
    console.log("Logged in as:", data.user.username);
});
```

---

## `MESSAGE_CREATE`

Emitted when a message is received.

```javascript
client.on("MESSAGE_CREATE", message => {
    console.log(message.content);
});
```

The message object also receives:

```javascript
message.author.self
```

which is `true` when the message was sent by the current account.

### Preventing automatic acknowledgement

Messages are automatically acknowledged unless they were sent by the current account.

Call:

```javascript
message.preventACK();
```

to prevent the automatic acknowledgement.

Example:

```javascript
client.on("MESSAGE_CREATE", message => {
    if(message.content === "keep this unread")
        message.preventACK();
});
```

---

## `DISCONNECT`

Emitted when the Gateway connection closes.

```javascript
client.on("DISCONNECT", () => {
    console.log("Disconnected");
});
```

---

## `INVALID_SESSION`

Emitted when Discord invalidates the current session and it cannot be resumed.

```javascript
client.on("INVALID_SESSION", () => {
    console.log("Session invalidated");
});
```

---

# Messages

## `client.sendMessage(message)`

Sends a message to a channel.

### Parameters

| Name                        | Type            | Description                |
| --------------------------- | --------------- | -------------------------- |
| `message`                   | `Object`        | Message data.              |
| `message.channel_id`        | `String`        | Channel ID.                |
| `message.content`           | `String`        | Message content.           |
| `message.files`             | `Array<Object>` | Optional file attachments. |
| `message.message_reference` | `Object`        | Optional reply reference.  |

### Reply reference

```javascript
{
    id: "123456789",
    channel_id: "987654321"
}
```

### File

A file object can contain:

```javascript
{
    filename: "image.png",
    data: Buffer,
    spoiled: false
}
```

### Example

```javascript
await client.sendMessage({
    channel_id: "123456789",
    content: "Hello!"
});
```

### Example with a file

```javascript
await client.sendMessage({
    channel_id: "123456789",
    content: "Here is a file",
    files: [{
        filename: "image.png",
        data: require("fs").readFileSync("image.png"),
        spoiled: false
    }]
});
```

---

## `client.editMessage(message)`

Edits an existing message.

### Parameters

| Name                 | Type            | Description               |
| -------------------- | --------------- | ------------------------- |
| `message`            | `Object`        | Message data.             |
| `message.id`         | `String`        | Message ID.               |
| `message.channel_id` | `String`        | Channel ID.               |
| `message.content`    | `String`        | New message content.      |
| `message.files`      | `Array<Object>` | Optional new attachments. |

### Example

```javascript
await client.editMessage({
    channel_id: "123456789",
    id: "987654321",
    content: "Edited message"
});
```

---

## `client.getMessages(options)`

Gets recent messages from a channel.

### Parameters

| Name                 | Type     | Description                                  |
| -------------------- | -------- | -------------------------------------------- |
| `options.channel_id` | `String` | Channel ID.                                  |
| `options.limit`      | `Number` | Maximum number of messages.                  |
| `options.before`     | `String` | Only return messages before this message ID. |

### Returns

```javascript
Promise<Array>
```

Messages are returned from newest to oldest.

### Example

```javascript
const messages = await client.getMessages({
    channel_id: "123456789",
    limit: 25
});
```

---

## `client.ackMessage(message)`

Acknowledges a message, removing its unread notification.

### Parameters

| Name                 | Type     | Description |
| -------------------- | -------- | ----------- |
| `message.channel_id` | `String` | Channel ID. |
| `message.id`         | `String` | Message ID. |

### Returns

```javascript
Promise<Object>
```

### Example

```javascript
await client.ackMessage({
    channel_id: "123456789",
    id: "987654321"
});
```

---

# Reactions

## `client.addReaction(options)`

Adds a reaction to a message.

### Parameters

| Name                 | Type     | Description          |
| -------------------- | -------- | -------------------- |
| `options.channel_id` | `String` | Channel ID.          |
| `options.message_id` | `String` | Message ID.          |
| `options.emoji`      | `String` | Emoji to react with. |

### Example

```javascript
await client.addReaction({
    channel_id: "123456789",
    message_id: "987654321",
    emoji: "👍"
});
```

---

## `client.removeReaction(options)`

Removes the client's reaction from a message.

### Parameters

| Name                 | Type     | Description      |
| -------------------- | -------- | ---------------- |
| `options.channel_id` | `String` | Channel ID.      |
| `options.message_id` | `String` | Message ID.      |
| `options.emoji`      | `String` | Emoji to remove. |

### Example

```javascript
await client.removeReaction({
    channel_id: "123456789",
    message_id: "987654321",
    emoji: "👍"
});
```

---

# Search

## `client.search(options)`

Searches for messages in a channel.

### Parameters

| Name                   | Type                            | Description                              |
| ---------------------- | ------------------------------- | ---------------------------------------- |
| `options.channel_id`   | `String`                        | Channel ID.                              |
| `options.content`      | `String`                        | Search message content.                  |
| `options.authors`      | `Array<String>`                 | Filter by author IDs.                    |
| `options.mentions`     | `Array<String>`                 | Filter by mentioned user IDs.            |
| `options.contentTypes` | `Array<String>`                 | Filter by content type.                  |
| `options.pinned`       | `Boolean`                       | Only return pinned messages.             |
| `options.authorTypes`  | `Array<String>`                 | Filter by author type.                   |
| `options.sort`         | `"new" \| "old" \| "relevance"` | Search sorting mode.                     |
| `options.offset`       | `Number`                        | Number of results to skip.               |
| `options.after`        | `Number`                        | Only messages after this UTC timestamp.  |
| `options.before`       | `Number`                        | Only messages before this UTC timestamp. |

### Content types

Valid `contentTypes` values include:

```text
image
video
link
file
embed
sound
poll
sticker
snapshot
```

### Author types

Valid `authorTypes` values include:

```text
user
bot
webhook
```

### Sorting

```javascript
sort: "new"
sort: "old"
sort: "relevance"
```

### Example

```javascript
const results = await client.search({
    channel_id: "123456789",
    content: "hello",
    sort: "relevance"
});
```

### Date filtering

`after` and `before` use UTC timestamps in milliseconds.

```javascript
const results = await client.search({
    channel_id: "123456789",
    after: Date.now() - 86400000
});
```

---

# Channels

## `client.getOpenChannels()`

Gets the channels currently present in the account's DM list.

This can contain both direct messages and group DMs.

### Returns

```javascript
Promise<Object>
```

### Example

```javascript
const channels = await client.getOpenChannels();
console.log(channels);
```

---

# Status

## `client.setStatus(options)`

Sets the account's status and activities.

### Parameters

| Name                 | Type                                         | Description            |
| -------------------- | -------------------------------------------- | ---------------------- |
| `options.status`     | `"online" \| "idle" \| "dnd" \| "invisible"` | Account status.        |
| `options.activities` | `Array<Object>`                              | Activities to display. |

Activity objects contain:

```javascript
{
    type: Number,
    name: String
}
```

### Example

```javascript
client.setStatus({
    status: "dnd",

    activities: [{
        name: "with the Discord API",
        type: Status.PLAYING
    }]
});
```

### Custom status

```javascript
client.setStatus({
    status: "online",

    activities: [{
        name: "my custom status",
        type: Status.CUSTOM_STATUS
    }]
});
```

### Streaming

Streaming activities automatically receive the activity's name as `details`.

```javascript
client.setStatus({
    status: "online",

    activities: [{
        name: "Minecraft",
        type: Status.STREAMING
    }]
});
```

---

# Authentication

## `client.logout()`

Logs out the current account and closes the Gateway connection.

### Returns

```javascript
Promise<Object>
```

### Example

```javascript
await client.logout();
```

---

# Connection

## `client.disconnect(code)`

Closes the current Gateway session.

After disconnecting, the client will no longer receive Gateway events. Call `login()` again to create a new session.

### Parameters

| Name   | Type     | Default | Description           |
| ------ | -------- | ------- | --------------------- |
| `code` | `Number` | `1000`  | WebSocket close code. |

### Example

```javascript
client.disconnect();
```

Or with a specific close code:

```javascript
client.disconnect(1000);
```

---

# Complete Example

```javascript
const self = require("@imaentity/selfjs");

const client = new self.Client({
    debugLogs: true
});

client.on("READY", data => {
    console.log(`Logged in as ${data.user.username}`);
});

client.on("MESSAGE_CREATE", async message => {
    console.log(`${message.author.username}: ${message.content}`);

    if(message.content === "!hello") {
        await client.sendMessage({
            channel_id: message.channel_id,
            content: "Hello!"
        });
    }
});

client.on("DISCONNECT", () => {
    console.log("Disconnected");
});

client.login(process.env.DISCORD_TOKEN);
```

---

# Exported API

SelfJS currently exports:

```javascript
module.exports = {
    Status,
    validateToken,
    createToken,
    UTCToSnowflake,
    snowflakeToUTC,
    Client
};
```

So the following are available:

```javascript
self.Status
self.validateToken
self.createToken
self.UTCToSnowflake
self.snowflakeToUTC
self.Client
```
