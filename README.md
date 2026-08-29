# SelfJS
Install Command: `npm i @imaentity/selfjs`

## Documentation
View Documentation [**Here**](https://github.com/ImaEntity/SelfJS/blob/master/docs.md)

## Bot Example's
Echo Bot:
```JS
const self = require("@imaentity/SelfJS");
const client = new self.Client();

client.on("MESSAGE_CREATE", async function(msg) {
    if(msg.author.bot || msg.author.self) return;
    await client.sendMessage(msg.channel_id, msg.content);
});

client.on("READY", function() {
    console.log("Ready!");
});

client.login("TOKEN");
```
