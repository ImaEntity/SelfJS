# 📜 Documentation
Welcome To SelfJS Documentation

> [!WARNING]
> Doc's might not be Up-to-Date or 100% Correct.

## Properties
+ ### ℹ Activites Status:
  The enum that holds the different status types.

  **Types:**
  ```
  Default   : -1
  Playing   : 0
  Streaming : 1
  Listening : 2
  Watching  : 3
  Custom    : 4
  Competing : 5
  ```

+ ### 🎮 Status:
  The string that holds the different status types.

  **Types:**
  ```
  "online",
  "dnd",
  "idle",
  "invisible" 
  ```

## Functions
+ ### 😴 Sleep:
  A promise-based sleep function that pauses execution for the given time in milliseconds.
  > Paramaters:  Miliseconds (Int) 
  
  <br>Example:
  ```javascript 
  discord.sleep(1)
  ```
+ ### 🤖 Send Webhook Message:
  A function to send a webhook message. The webhook token and ID are provided, along with any input data.
  >Paramaters: webhookID (String), webhookToken (String or JSON), inputData (JSON)

  <br>Example:
  ```javascript
  discord.sendWebhookMessage("01234567891011121314", "012345678910111213141516.123456.123456789101112131415161718", {
        "content": "Sending Content Throught Webhook"
    })
  ```
  or
    ```javascript
  discord.sendWebhookMessage("https://discord.com/api/webhooks/01234567891011121314/012345678910111213141516.123456.123456789101112131415161718", {
        "content": "Sending Content Throught Webhook"
    })
  ```

+ ### 📄 JSON Encode
  Encodes a JSON object for use with the discord API. (Self does this automatically.)
  >Paramaters: jsonObject (Any)

  <br>Example:
  ```javascript
  discord.jsonEncode("Content")
  ```

## Class
+ ### Client
  This class allows the interaction with the Discord server.

  <br>Example:
  ```javascript
  const discord = require("@imaentity/selfjs");
  const client = new discord.Client();
  ```

  + ### 🧑 UserID: The client's user ID.

  + ### 🎟 Token: The client's token.

  + ### 📶 Latency: The latency of the client's websocket connection.

  + ### 🔑 Login (REQUIRED)
    Logs in the client to Discord.
    >Paramaters: Token (String), isMobile (Boolean | false), logMsgs (Boolean | false)

    <br>Example:
    ```javascript
    client.login("012345678910111213141516.123456.123456789101112131415161718")
    ```

  + ### 💬 onMessage
    Function to be executed when a message is received.
    >Paramaters: msgFunc (Function)

    <br>Example:
    ```javascript
    client.onMessage(async function(msg) {
      console.log("Message Received: " + msg.content)
    });
    ```

  + ### ✏ onMessageEdit
    Function to be executed when a message is edited.
    >Paramaters: editFunc (Function)

    <br>Example:
    ```javascript
    client.onMessageEdit(async function(msg) {
      console.log("Message Edited: " + msg.content)
    });
    ```

  + ### 🚮 onMessageDelete
    Function to be executed when a message is deleted.
    >Paramaters: deleteFunc (Function)

    <br>Example:
    ```javascript
    client.onMessageDelete(async function(msg) {
      console.log("Message Deleted: " + msg.content)
    });
    ```

  + ### 🕶 onStatusUpdate
    Function to be executed when a status update occurs.
    >Paramaters: statusFunc (Function)

    <br>Example:
    ```javascript
    client.onStatusUpdate(async function(status) {
      console.log(status)
    });
    ```
  
  + ### 🔏 getDMChannel
    Gets the Direct Message (DM) channel for the specified user.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.getDMChannel("01234567891011121314")
    ```

  + ### 🧪 getRoles
    Gets the roles for a user in a server.
    >Paramaters: serverID (String), userID (String)

    <br>Example:
    ```javascript
    client.getRoles("01234567891011121314", "41312111019876543210")
    ```

  + ### 📁 uploadFile
    Uploads a file to the specified channel.
    >Paramaters: channelID (String), fileName (String), isSpoiled (Boolean | false), msgContent (String | ""), messageID (String | null)

    <br>Example:
    ```javascript
    client.uploadFile("01234567891011121314", "image.png", true, "Message Related to The Image", "41312111019876543210")
    ```
  
  + ### 🔍 search
    Search for messages in a channel based on the specified options.
    >Paramaters: channelID (String), options (JSON)

    <br>Example:
    ```javascript
    client.search("01234567891011121314", {
      "content": "Text"
    })
    ```

  + ### 👤 getUserData
    Gets the data of a user.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.getUserData("01234567891011121314")
    ```
  
  + ### 🔨 setRolesForMember
    Sets roles for a member in a server.
    >Paramaters: serverID (String), userID (String), roleIDs (String or JSON)

    <br>Example:
    ```javascript
    client.setRolesForMember("01234567891011121314", "41312111019876543210", [
      "1285712985712985712",
      "1284578912561872568",
      "9127498127459812749"
    ])
    ```

  + ### 🗣 sendMessage
    Sends a message to a specified channel.
    >Paramaters: channelID (String), message (Any)

    <br>Example:
    ```javascript
    client.sendMessage("01234567891011121314", "Message")
    ```
  
  + ### 👨🏻‍🤝‍👨🏻 replyToMessage
    Replies to a specified message.
    >Paramaters: channelID (String), messageID (String), message (Any)

    <br>Example:
    ```javascript
    client.replyToMessage("01234567891011121314", "41312111019876543210", "Replied Message")
    ```

  + ### 📔 createChannel
    Creates a channel in a server based on the specified options.
    >Paramaters: guildID (String), name (String), type (Int), parentID (String | null)

    <br>Example:
    ```javascript
    // 0 = GUILD_TEXT

    client.createChannel("01234567891011121314", "new-channel", 0, "41312111019876543210")
    ```

  + ### 👑 setChannelPermissons
    Sets a users permissions in a channel based on the specified options.
    >Paramaters: channelID (String), userID (String), allow (String | 0), deny (String | 0)

    <br>Example:
    ```javascript
    client.setChannelPermissons("01234567891011121314", "41312111019876543210")
    ```

  + ### 📖 getMessages
    Gets messages from a channel with a limit.
    >Paramaters: channelID (String), limit (String or Int)

    <br>Example:
    ```javascript
    client.getMessages("01234567891011121314", "10")
    ```

  + ### 🏙 getUsers
    Gets users from a guild.
    >Paramaters: guildID (String)

    <br>Example:
    ```javascript
    client.getUsers("01234567891011121314")
    ```

  + ### ❌ removeFromChannel
    Removes a user from a channel.
    >Paramaters: channelID (String), userID (String)

    <br>Example:
    ```javascript
    client.removeFromChannel("01234567891011121314", "41312111019876543210")
    ```

  + ### 🏃‍♀️ leaveChannel
    Leaves a channel.
    >Paramaters: channelID (String)

    <br>Example:
    ```javascript
    client.leaveChannel("01234567891011121314")
    ```
  
  + ### 📞 ring
    Starts a call with the specified users in a channel.
    >Paramaters: channelID (String), userIDs (String or JSON)

    <br>Example:
    ```javascript
    client.ring("01234567891011121314", {
      "12549812509818205",
      "19024578912857987"
    })
    ```

  + ### 📴 stopRinging
    Stops ringing the specified users in a channel.
    >Paramaters: channelID (String), userIDs (String or JSON)

    <br>Example:
    ```javascript
    client.stopRinging("01234567891011121314", {
      "12549812509818205",
      "19024578912857987"
    })
    ```

  + ### ➕ addToChannel
    Adds a user to a channel.
    >Paramaters: channelID (String), userID (String)

    <br>Example:
    ```javascript
    client.addToChannel("01234567891011121314", "41312111019876543210")
    ```

  + ### 📷 getAvatar
    Gets the avatar of a user.
    >Paramaters: userID (String), size (Int | 256)

    <br>Example:
    ```javascript
    client.getAvatar("01234567891011121314")
    ```
  
  + ### 🤼 addFriend
    Sends a friend request to a user.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.addFriend("01234567891011121314")
    ```

  + ### 🖊 editMessage
    Edits a message.
    >Paramaters: channelID (String), messageID (String), message (Any)

    <br>Example:
    ```javascript
    client.editMessage("01234567891011121314", "41312111019876543210", "Edited Message")
    ```

  + ### 👋 removeFriend
    Removes a user from the friend list.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.removeFriend("01234567891011121314")
    ```

  + ### 📛 renameChannel
    Renames a channel.
    >Paramaters: channelID (String), channelName (String)

    <br>Example:
    ```javascript
    client.renameChannel("01234567891011121314", "Renamed Channel")
    ```

  + ### ❎ block
    Blocks a user.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.block("01234567891011121314")
    ```

  + ### ✅ unblock
    Unblocks a user.
    >Paramaters: userID (String)

    <br>Example:
    ```javascript
    client.unblock("01234567891011121314")
    ```

  + ### 🚮 deleteMessage
    Deletes a message.
    >Paramaters: channelID (String), messageID (String)

    <br>Example:
    ```javascript
    client.deleteMessage("01234567891011121314", "41312111019876543210")
    ```

  + ### 🗿 setStatus
    Sets the status of the client.
    >Paramaters: status (String), activites (JSON), afk (Boolean | false)

    <br>Example:
    ```javascript
    client.setStatus("dnd", [{
        name: "Streaming",
        type: 1
    }])
    ```

  + ### 🤼 createGroupChat
    Creates a new channel with the specified users.
    >Paramaters: userIDs (String or JSON)

    <br>Example:
    ```javascript
    client.createGroupChat([
      "12847128957125",
      "12905901285798",
      "64837698943868"
    ])
    ```

  + ### 🎹 startTyping
    Simulates the client typing in a channel.
    >Paramaters: channelID (String)

    <br>Example:
    ```javascript
    client.startTyping("01234567891011121314")
    ```

  + ### 📌 pinMessage
    Pins a message in a channel.
    >Paramaters: channelID (String), messageID (String)

    <br>Example:
    ```javascript
    client.pinMessage("01234567891011121314", "41312111019876543210")
    ```

  + ### ❌ unpinMessage
    Unpins a message in a channel.
    >Paramaters: channelID (String), messageID (String)

    <br>Example:
    ```javascript
    client.unpinMessage("01234567891011121314", "41312111019876543210")
    ```

  + ### 📝 editNote
    Edits a note for a user.
    >Paramaters: userID (String), note (String)

    <br>Example:
    ```javascript
    client.editNote("01234567891011121314", "Edited Note")
    ```

  + ### 💾 getChannelData
    Gets data of a channel.
    >Paramaters: channelID (String)

    <br>Example:
    ```javascript
    client.getChannelData("01234567891011121314")
    ```
  
  + ### 👑 transferOwnership
    Transfers ownership of a channel to another user.
    >Paramaters: channelID (String), userID (String)

    <br>Example:
    ```javascript
    client.transferOwnership("01234567891011121314", "41312111019876543210")
    ```