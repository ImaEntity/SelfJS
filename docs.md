# Docs

| Property Name      | Type         | Parent      | Parameters                                | Description                                                    |
| :----------------- | :----------- | :---------- | :---------------------------------------- | :------------------------------------------------------------- |
| status             | **Object**   | **SelfJS**  | None                                      | The status that can be set ex: PLAYING, WATCHING, etc.         |
| sleep              | **Function** | **SelfJS**  | {Millis}                                  | Sleeps for an amount of milliseconds.                          |
| sendWebhookMessage | **Function** | **SelfJS**  | {URL} {Content} OR {ID} {Token} {Content} | Sends a message using a webhook.                               |
| Client             | **Class**    | **SelfJS**  | None                                      | A class that holds the properties of a discord client.         |
| login              | **Function** | **Client**  | {Token} [Mobile?] [Verbose?]              | The login function for a client.                               |
| onMessage          | **Function** | **Client**  | {Callback {Data}}                         | Runs a callback function everytime a message is sent.          |
| onMessageEdit      | **Function** | **Client**  | {Callback {Data}}                         | Runs a callback function everytime a message is edited.        |
| getRoles           | **Function** | **Client**  | {Server ID} {User ID}                     | Gets the role IDs of a user in a server.                       |
| setRolesForMemeber | **Function** | **Client**  | {Server ID} {User ID} {Role IDs}          | Gives a user a role in a server.                               |
| sendMessage        | **Function** | **Client**  | {Channel ID} {Content}                    | Sends a message to a channel.                                  |
| replyToMessage     | **Function** | **Client**  | {Channel ID} {Message ID} {Content}       | Replies to a message to a channel.                             |
| getMessages        | **Function** | **Client**  | {Channel ID} {Limit}                      | Gets an amount of messages in a channel from newest to oldest. |
