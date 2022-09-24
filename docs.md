# Docs
| Property Name            | Type     | Parent  | Parameters                                  | Description                                             |
| :----------------------- | :------- | :------ | :------------------------------------------ | :------------------------------------------------------ |
| Client                   | Class    | SelfJS  | None                                        | A class that holds the properties of a discord client.  |
| status                   | Object   | SelfJS  | None                                        | The status  that can be set ex: PLAYING, WATCHING, etc. |
| login                    | Function | Client  | {Token} [Mobile?] [Verbose output]          | The login function for a client.                        |
| sendMessage              | Function | Client  | {Channel ID} {Message content}              | Sends a message to a certain channel.                   |
| replyToMessage           | Function | Client  | {Channel ID} {Message ID} {Message content} | Sends a message to a certain channel.                   |
