import express from "express"
import http from "http"
import WebSocket, { WebSocketServer } from "ws"

const OPENAI_KEY = process.env.OPENAI_API_KEY

const app = express()

app.get("/", (req,res)=>{
  res.send("Live transcription server running")
})

const server = http.createServer(app)

const wss = new WebSocketServer({
  server,
  path: "/ws"
})

wss.on("connection",(client)=>{

  console.log("Client connected")

  const openai = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers:{
        "Authorization":`Bearer ${OPENAI_KEY}`,
        "OpenAI-Beta":"realtime=v1"
      }
    }
  )

  openai.on("open",()=>{
    console.log("Connected to OpenAI realtime")
  })

  openai.on("message",(msg)=>{

    try{

      const data = JSON.parse(msg)

      if(data.type === "response.output_text.delta"){

        client.send(JSON.stringify({
          type:"transcript",
          text:data.delta
        }))

      }

      if(data.type === "response.completed"){

        client.send(JSON.stringify({
          type:"done"
        }))

      }

    }catch(e){
      console.log("parse error")
    }

  })

  client.on("message",(msg)=>{

    const data = JSON.parse(msg)

    if(data.type === "audio"){

      if(openai.readyState === 1){

        openai.send(JSON.stringify({
          type:"input_audio_buffer.append",
          audio:data.chunk
        }))

      }

    }

    if(data.type === "commit"){

      openai.send(JSON.stringify({
        type:"input_audio_buffer.commit"
      }))

      openai.send(JSON.stringify({
        type:"response.create"
      }))

    }

  })

  client.on("close",()=>{
    console.log("Client disconnected")
    openai.close()
  })

})

const PORT = process.env.PORT || 10000

server.listen(PORT,()=>{
  console.log("Server running on port",PORT)
})
