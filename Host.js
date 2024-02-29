const { WebSocketServer } = require("ws");
const server = new WebSocketServer({ port: 6075 });
server.on("connection", client => {
 client.on("message", (msg) => { server.clients.forEach(c => c.send(msg)); });
 });
console.log("Hosting");