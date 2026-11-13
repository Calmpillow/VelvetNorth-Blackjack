"use strict";
const http = require("node:http");
const crypto = require("node:crypto");
const WebSocket = require("ws");
const PORT = Number(process.env.PORT || 8787);
const MAX_ROOMS = 30, MAX_PLAYERS = 12, MAX_MESSAGE = 16 * 1024;
const rooms = new Map();
const server = http.createServer((req,res)=>{
  if(req.url==="/health"||req.url==="/healthz"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return res.end(JSON.stringify({ok:true,service:"velvet-north",rooms:rooms.size,maxRooms:MAX_ROOMS,uptime:Math.floor(process.uptime())}));}
  if(req.url==="/api/rooms"){const list=[...rooms.values()].filter(r=>!r.private&&r.host.readyState===WebSocket.OPEN).map(r=>({id:r.id,roomCode:r.code,name:r.name,players:r.clients.size+1,maxPlayers:MAX_PLAYERS,private:false}));res.writeHead(200,{"content-type":"application/json","access-control-allow-origin":"*","cache-control":"no-store"});return res.end(JSON.stringify({rooms:list,capacity:MAX_ROOMS}));}
  res.writeHead(200,{"content-type":"text/plain; charset=utf-8"});res.end("Velvet North multiplayer service\n");
});
const wss = new WebSocket.Server({server,path:"/ws",maxPayload:MAX_MESSAGE,perMessageDeflate:false});
const send=(ws,obj)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
const code=()=>crypto.randomBytes(4).toString("hex").toUpperCase();
const hash=(s,salt="")=>crypto.scryptSync(String(s),salt,32).toString("hex");
const safeHashEqual=(a,b)=>{if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));};
function roomByCode(value){const normalized=String(value||"").toUpperCase();return [...rooms.values()].find(r=>r.code===normalized);}
function removeRoom(r,reason="host-left"){if(!r)return;rooms.delete(r.id);for(const [id,ws] of r.clients){send(ws,{type:"error",message:"The table host disconnected. The room has closed."});try{ws.close(1001,reason)}catch{}}r.clients.clear();}
function leave(ws){const r=ws.room;if(!r)return;ws.room=null;if(ws.isHost){removeRoom(r);return;}if(r.clients.has(ws.playerId)){r.clients.delete(ws.playerId);send(r.host,{type:"peer-left",peerId:ws.playerId});}}
function fail(ws,message){send(ws,{type:"error",message});}
wss.on("connection",ws=>{
 ws.isAlive=true;ws.on("pong",()=>ws.isAlive=true);ws.messageCount=0;ws.rateWindow=Date.now();
 ws.on("message",raw=>{
  const now=Date.now();if(now-ws.rateWindow>10000){ws.rateWindow=now;ws.messageCount=0;}if(++ws.messageCount>160)return fail(ws,"Too many messages. Please slow down.");
  let m;try{m=JSON.parse(raw.toString())}catch{return fail(ws,"Invalid message format.");}if(!m||typeof m.type!=="string")return;
  if(m.type==="ping"){if(ws.room)ws.room.lastActivity=now;send(ws,{type:"pong",at:now});return;}
  if(m.type==="host"){
   if(ws.room)return fail(ws,"This connection already belongs to a room.");
   if(rooms.size>=MAX_ROOMS)return fail(ws,"All 30 server slots are currently in use. Try again later.");
   const roomCode=String(m.roomCode||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);if(roomCode.length<2)return fail(ws,"Room code must contain at least 2 letters or numbers.");if(roomByCode(roomCode))return fail(ws,"That room code is already in use. Choose another.");
   const isPrivate=!!m.private;const password=String(m.password||"");if(isPrivate&&password.length<4)return fail(ws,"Private rooms need a password of at least 4 characters.");
   const id=crypto.randomUUID();const passwordSalt=isPrivate?crypto.randomBytes(16).toString("hex"):null;const r={id,code:roomCode,name:String(m.name||"Velvet North Table").slice(0,24),private:isPrivate,passwordSalt,passwordHash:isPrivate?hash(password,passwordSalt):null,host:ws,hostId:"host-"+crypto.randomBytes(5).toString("hex"),clients:new Map(),createdAt:now,lastActivity:now};rooms.set(id,r);ws.room=r;ws.isHost=true;send(ws,{type:"registered",roomId:id,roomCode:r.code,hostId:r.hostId,private:isPrivate});return;
  }
  if(m.type==="join"){
   if(ws.room)return fail(ws,"This connection already belongs to a room.");const r=m.roomId?rooms.get(String(m.roomId)):roomByCode(m.roomCode);if(!r||r.host.readyState!==WebSocket.OPEN)return fail(ws,"That table could not be found. Refresh the directory or check the code.");if(r.clients.size+1>=MAX_PLAYERS)return fail(ws,"This table is full (12 players maximum).");if(r.private&&!safeHashEqual(hash(String(m.password||""),r.passwordSalt),r.passwordHash))return fail(ws,"That private-room password is incorrect.");
   const playerId="p-"+crypto.randomBytes(7).toString("hex");ws.room=r;ws.playerId=playerId;r.clients.set(playerId,ws);r.lastActivity=now;send(ws,{type:"joined",roomId:r.id,roomCode:r.code,playerId,state:null});send(r.host,{type:"peer-message",peerId:playerId,payload:{type:"hello",name:String(m.name||"Guest").slice(0,18),look:m.look||{}}});return;
  }
  if(m.type==="to-peer"&&ws.isHost&&ws.room){const target=ws.room.clients.get(String(m.peerId));if(!target)return;send(target,{type:"peer-data",payload:m.payload});ws.room.lastActivity=now;return;}
  if(m.type==="disconnect-peer"&&ws.isHost&&ws.room){const target=ws.room.clients.get(String(m.peerId));if(target){ws.room.clients.delete(String(m.peerId));try{target.close(1000,"removed by host")}catch{}send(ws,{type:"peer-left",peerId:String(m.peerId)});}return;}
  if(m.type==="action"&&ws.room&&!ws.isHost){send(ws.room.host,{type:"peer-message",peerId:ws.playerId,payload:{type:"action",action:String(m.action||""),data:m.data||{}}});ws.room.lastActivity=now;return;}
  if(m.type==="host-state"&&ws.isHost&&ws.room){for(const client of ws.room.clients.values())send(client,{type:"state",state:m.state});return;}
 });
 ws.on("close",()=>{leave(ws)});ws.on("error",()=>{leave(ws)});
});
// Keepalive detects half-open mobile connections; dead peers are removed cleanly.
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},25000);
// Daily maintenance: remove dead/stale records; active rooms are never reset just for maintenance.
function dailyMaintenance(){const now=Date.now();for(const r of rooms.values()){if(r.host.readyState!==WebSocket.OPEN||now-r.lastActivity>36*60*60*1000)removeRoom(r,"daily-maintenance");}}
const daily=setInterval(dailyMaintenance,24*60*60*1000);daily.unref();heartbeat.unref();
server.listen(PORT,"0.0.0.0",()=>console.log(`Velvet North server listening on ${PORT}`));
function shutdown(){clearInterval(heartbeat);clearInterval(daily);for(const r of [...rooms.values()]){send(r.host,{type:"error",message:"The multiplayer service is restarting. Please reconnect shortly."});try{r.host.close(1001,"server-shutdown")}catch{}removeRoom(r,"server-shutdown");}server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
