# Properties
- **status**: The enum that holds the different status types.

# Functions
- **sleep(millis)**: A promise-based sleep function that pauses execution for the given time in milliseconds.

- **sendWebhookMessage(webhookID, webhookToken, inputData)**: A function to send a webhook message. The webhook token and ID are provided, along with any input data.

# Class
- **Client**: This class allows the interaction with the Discord server. The following are its methods:

  - **userID**: The client's user ID.
  
  - **token**: The client's token.

  - **latency**: The latency of the client's websocket connection.

  - **login(token, isMobile = false, logMsgs = false)**: Logs in the client to Discord.

  - **onMessage(msgFunc)**: Function to be executed when a message is received.

  - **onMessageEdit(editFunc)**: Function to be executed when a message is edited.

  - **onStatusUpdate(statusFunc)**: Function to be executed when a status update occurs.

  - **getDMChannel(userID)**: Gets the Direct Message (DM) channel for the specified user.

  - **getRoles(serverID, userID)**: Gets the roles for a user in a server.

  - **uploadFile(channelID, fileName, isSpoiled = false, msgContent = "", messageID = null)**: Uploads a file to the specified channel.

  - **search(channelID, options)**: Search for messages in a channel based on the specified options.

  - **getUserData(userID)**: Gets the data of a user.

  - **setRolesForMember(serverID, userID, roleIDs)**: Sets roles for a member in a server.

  - **sendMessage(channelID, message)**: Sends a message to a specified channel.

  - **replyToMessage(channelID, messageID, message)**: Replies to a specified message.

  - **createChannel(guildID, name, type, parentID = null)**: Creates a channel in a server based on the specified options.

  - **setChannelPermissions(channelID, userID, allow, deny)**: Sets a users permissions in a channel based on the specified options.

  - **getMessages(channelID, limit)**: Gets messages from a channel with a limit.

  - **getUsers(guildID)**: Gets users from a guild.

  - **removeFromChannel(channelID, userID)**: Removes a user from a channel.

  - **leaveChannel(channelID)**: Leaves a channel.

  - **ring(channelID, userIDs)**: Starts a call with the specified users in a channel.

  - **stopRinging(channelID, userIDs)**: Stops ringing the specified users in a channel.

  - **addToChannel(channelID, userID)**: Adds a user to a channel.

  - **getAvatar(userID, size = 256)**: Gets the avatar of a user.

  - **addFriend(userID)**: Sends a friend request to a user.

  - **editMessage(channelID, messageID, newMessage)**: Edits a message.

  - **removeFriend(userID)**: Removes a user from the friend list.

  - **renameChannel(channelID, channelName)**: Renames a channel.

  - **block(userID)**: Blocks a user.

  - **unblock(userID)**: Unblocks a user.

  - **deleteMessage(channelID, messageID)**: Deletes a message.

  - **setStatus(status, activities, afk = false)**: Sets the status of the client.

  - **createGroupChat(userIDs)**: Creates a new channel with the specified users.

  - **startTyping(channelID)**: Simulates the client typing in a channel.

  - **pinMessage(channelID, messageID)**: Pins a message in a channel.

  - **unpinMessage(channelID, messageID)**: Unpins a message in a channel.

  - **editNote(userID, note)**: Edits a note for a user.

  - **getChannelData(channelID)**: Gets data of a channel.

  - **transferOwnership(channelID, userID)**: Transfers ownership of a channel to another user.
