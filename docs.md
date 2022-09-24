# Docs

| Property Name      | Type     | Parent  | Parameters                                  | Description                                             |
| :----------------- | :------- | :------ | :---------------------------------------- | :------------------------------------------------------ |
| status             | Object   | SelfJS  | None                                      | The status  that can be set ex: PLAYING, WATCHING, etc. |
| sleep              | Function | SelfJS  | {Millis}                                  | Sleeps for a certain amount of milliseconds.            |
| sendWebhookMessage | Function | SelfJS  | {URL} {Content} OR {ID} {Token} {Content} | Sends a message using a webhook.                        |
| Client             | Class    | SelfJS  | None                                      | A class that holds the properties of a discord client.  |
| login              | Function | Client  | {Token} [Mobile?] [Verbose?]              | The login function for a client.                        |
| sendMessage        | Function | Client  | {Channel ID} {Message content}            | Sends a message to a certain channel.                   |
| replyToMessage     | Function | Client  | {Channel ID} {Message ID} {Content}       | Replies to a message to a certain channel.              |
