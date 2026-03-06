import { WebSocketServer } from "ws"
import WebSocket from "ws"
import crypto from "crypto"

import {createSession,getSession,removeSession} from "./sessionManager.js"

export function setupRealtimeSocket(server){

const wss = new WebSocketServer({
server,
path:"/ws"
})

wss.on("connection",(clientWS)=>{

const sessionID = crypto.randomUUID()

createSession(sessionID,clientWS)

console.log("Client connected:",sessionID)

const openaiWS = new WebSocket(
"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
{
headers:{
"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
"OpenAI-Beta":"realtime=v1"
}
}
)

openaiWS.on("open",()=>{

console.log("Connected to OpenAI realtime")

openaiWS.send(JSON.stringify({

type:"session.update",

session:{
modalities:["text"],
input_audio_format:"webm",
turn_detection:{
type:"server_vad"
},
transcription:{
model:"gpt-4o-transcribe"
}
}

}))

})

clientWS.on("message",(audioChunk)=>{

if(openaiWS.readyState === WebSocket.OPEN){

openaiWS.send(JSON.stringify({

type:"input_audio_buffer.append",
audio:Buffer.from(audioChunk).toString("base64")

}))

}

})

openaiWS.on("message",(data)=>{

try{

const msg = JSON.parse(data)

if(msg.type === "response.output_text.delta"){

const session = getSession(sessionID)

const text = msg.delta

session.transcript += text

clientWS.send(JSON.stringify({

transcript:`Speaker ${session.speaker}: ${text}`

}))

}

if(msg.type === "response.completed"){

const session = getSession(sessionID)

session.speaker++

}

}catch(err){

console.error("Parse error",err)

}

})

clientWS.on("close",()=>{

console.log("Client disconnected:",sessionID)

removeSession(sessionID)

openaiWS.close()

})

})

}
