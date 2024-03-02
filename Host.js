//Vars
 const { WebSocketServer } = require("ws");
 const { Buffer }          = require("node:buffer"); 
 const fs                  = require("node:fs");
 const server     = new WebSocketServer({ port: 6075 });
 const accountmap = new Map();
 const usermap    = new Map();
 const accounts   = fs.openSync("Accounts.txt", "a+");
 const msgindexes = fs.openSync("MessageIndexes.bin", "a+");
 const msghistory = fs.openSync("MessageHistory.txt", "a+");
 const namechars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"
//Init
 const {size} = fs.fstatSync(accounts);
 const accbuf = Buffer.alloc(size);
 fs.readSync(accounts, accbuf, 0, size);
 const accstr = accbuf.toString();
 for (let i = 0; i < size; i += 64){
  const name = accstr.substring(i, i+32).trim();
  const pass = accstr.substring(i+32, i+64).trim();
  accountmap.set(name, pass);
  console.log(name, pass);}
//Events
 server.on("connection", client => {
 client.send("Do /register <username> <password> or /login <username> <password> to begin talking");
 client.on("message", (rawmsg) => {
  if (rawmsg.isBinary) { return; }
  const msg = rawmsg.toString();
  if      (msg.length == 0) { return; }
  else if (msg.length > 2000) { client.send("Message too long"); }
  else if (msg.startsWith("/")){ 
   if (msg.startsWith("/register ")){
    const full  = msg.substring(10);
    const split = full.split(" ");
    if (split.length != 2) { client.send("Incorrect arg count"); return; }
    const name = split[0];
    const pass = split[1];
    for (let i = 0; i < name.length; i++) { if (!namechars.includes(name[i])) { client.send("Invalid character in username"); return; } }
    //Todo - make sure multibyte chars don't screw everything up
    if      (accountmap.get(name) != null) { client.send("Account already registered"); return; }
    else if (name.length > 32)             { client.send("Username must be under 32 characters"); }
    else if (pass.length > 32)             { client.send("Password must be under 32 characters"); }
    else if (name.length < 3)              { client.send("Username must be at least 3 characters"); }
    else if (pass.length < 8)              { client.send("Password must be at least 8 characters"); }
    else { registeraccount(name, pass); client.send("Registered account"); usermap.set(client, { username: name, spamcount: 0, lastmessage: new Date().getTime() }); broadcast(name + " joined the chat"); };
    }
   if (msg.startsWith("/login ")){
    const full  = msg.substring(7);
    const split = full.split(" ");
    if      (split.length != 2) { client.send("Incorrect arg count"); return; }
    const name = split[0];
    const pass = split[1];
    const match = accountmap.get(name);
    for (let i = 0; i < name.length; i++) { if (!namechars.includes(name[i])) { client.send("Invalid character in username"); return; } }
    if      (match == null)    { client.send("Account does not exist"); }
    else if (pass != match)    { client.send("Incorrect password"); }
    else if (name.length > 32) { client.send("Username must be under 32 characters"); }
    else if (name.length < 3)  { client.send("Username must be at least 3 characters long"); }
    else                       { client.send("Successfully logged in"); usermap.set(client, { username: name, spamcount: 0, lastmessage: new Date().getTime() }); broadcast(name + " joined the chat"); } }
   else if (msg.startsWith("/history ")) {} }
  else if (usermap.get(client) == null) { client.send("You must do /register <username> <password> or /login <username> <password> before chatting"); }
  else {
   const historysz = fs.fstatSync(msghistory, { bigint: true }).size;
   const indexessz = fs.fstatSync(msgindexes, { bigint: false }).size;
   const fileindex = new BigInt64Array([historysz]);
   const msgindex  = indexessz / 8;
   console.log(msgindex);
   fs.writeSync(msgindexes, fileindex);
   fs.writeSync(msghistory, msg);
   const user   = usermap.get(client);
   user.spamcount++;
   user.spamcount -= ((new Date().getTime()-user.lastmessage) / 1000);
   if (user.spamcount < 0) { user.spamcount = 0 };
   if (user.spamcount > 5) { client.send("Ratelimited"); return; }
   user.lastmessage = new Date().getTime();
   broadcast(user.username + ": " + msg);}
  });
 });
console.log("Hosting");
//Functions
 function broadcast(msg){ server.clients.forEach(c => c.send(msg)); }
 function registeraccount(name, pass) {
  accountmap.set(name, pass);
  let padname = name.padEnd(32, " "), padpass = pass.padEnd(32, " ");
  fs.writeSync(accounts, padname);
  fs.writeSync(accounts, padpass);}