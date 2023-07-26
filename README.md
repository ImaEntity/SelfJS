# SelfJS
## Install: npm i @imaentity/selfjs

An example of an echo bot:
```JS
const discord = require("@imaentity/SelfJS");
const client = new discord.Client();

(async function() {
    await client.login("TOKEN");
  
    client.onMessage(async function(msg) {
        if(msg.author.bot || msg.author.self) return;
        
        await client.sendMessage(msg.channel_id, msg.content);
    });
}());
```
