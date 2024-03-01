const { WebSocketServer } = require("ws");
const server = new WebSocketServer({ port: 6075 });
server.on("connection", client => {
 client.on("message", (msg) => {
  if (msg.isBinary) { return; }
  if (msg.length > 400) { client.send("Message too long"); return; }
  server.clients.forEach(c => c.send(msg + "")); 
  });
 });
console.log("Hosting");