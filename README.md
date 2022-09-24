# SelfJS
Breaking discord's TOS to bot user accounts.

An example of a echo bot:
```JS
const discord = require("self.js");
const client = new discord.Client();

(async function() {
    await.client.login("TOKEN");
  
    client.onMessage(async function(msg) {
        await client.sendMessage(msg.channel_id, msg.content);
    });
}());
```
