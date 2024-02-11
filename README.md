# SelfJS
Install Command: `npm i @imaentity/selfjs`

## Documentation
View Documentation [**Here**](https://github.com/ImaEntity/SelfJS/blob/master/docs.md)

## Bot Example's
Echo Bot:
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
