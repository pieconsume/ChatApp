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
  accountmap.set(name, pass);}
 getmsg(1);
//Events
 server.on("connection", (client, req) => {
 console.log("new connection");
 let userid = req.socket.remoteAddress; //Todo - switch this out with some sort of session
 if (usermap.get(userid) == null) { client.send("Do /register <username> <password> or /login <username> <password> to begin talking"); } else { client.send("Welcome back!"); }
 client.on("message", (rawmsg) => {
  let user = usermap.get(userid);
  if (rawmsg.isBinary) { return; }
  const msg = rawmsg.toString();
  if      (msg.length == 0) { return; }
  else if (msg.length > 2000) { client.send("Message too long"); }
  else if (msg.startsWith("/")){
   if (usermap.get(userid) == null){
    if      (msg.startsWith("/register ")){
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
     else { registeraccount(name, pass); client.send("Registered account"); usermap.set(userid, { username: name, spamcount: 0, lastmessage: new Date().getTime() }); broadcast(name + " joined the chat"); } }
    else if (msg.startsWith("/login ")){
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
     else                       { client.send("Successfully logged in"); usermap.set(userid, { username: name, spamcount: 0, lastmessage: new Date().getTime() }); broadcast(name + " joined the chat"); } } }
   else if (usermap.get(userid) != null){
    if (msg.startsWith("/history ")){
     const args = msg.slice(9).split(" ");
     const startidx = parseInt(args[0]);
     const endidx   = parseInt(args[1]);
     const idxtotal = startidx-endidx;
     const indexessz = fs.fstatSync(msgindexes, { bigint: false }).size;
     const indexcount = indexessz / 8;
     if (startidx < 0 || endidx < 0 ||  startidx < endidx || idxtotal > 100 || startidx > indexcount || endidx > indexcount) { client.send("Invalid request"); return; }
     for (let i = startidx; i >= endidx; i--) { client.send("/history " + getmsg(i)); } }
    else if (msg.startsWith("/users")) { user.trackusers = true; client.send("/users " + Array.from(usermap.values(), x => x.username).join(",")); } } }
  else if (usermap.get(userid) == null) { client.send("You must do /register <username> <password> or /login <username> <password> before chatting"); }
  else{
   const historysz = fs.fstatSync(msghistory, { bigint: true }).size;
   const indexessz = fs.fstatSync(msgindexes, { bigint: false }).size;
   const fileindex = new BigInt64Array([historysz, BigInt(msg.length)]);
   const msgindex  = indexessz / 8;
   fs.writeSync(msgindexes, fileindex);
   fs.writeSync(msghistory, msg);
   const user   = usermap.get(req.socket.remoteAddress);
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
 function getmsg(idx){
  //Not great but it works for now
  let msgdata = new BigInt64Array(2);
  fs.readSync(msgindexes, msgdata, 0, 16, idx*16);
  let msgarr = new Int8Array(parseInt(msgdata[1]));
  fs.readSync(msghistory, msgarr, 0, parseInt(msgdata[1]), parseInt(msgdata[0]));
  let str = Buffer.from(msgarr.buffer).toString();
  return str;
  }
 function broadcast(msg){ server.clients.forEach(c => c.send(msg)); }
 function registeraccount(name, pass){
  accountmap.set(name, pass);
  let padname = name.padEnd(32, " "), padpass = pass.padEnd(32, " ");
  fs.writeSync(accounts, padname);
  fs.writeSync(accounts, padpass);}