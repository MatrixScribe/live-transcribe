import express from "express"
import http from "http"
import { setupRealtimeSocket } from "./realtimeSocket.js"

const app = express()

app.get("/", (req,res)=>{
  res.send("Realtime Transcription Server Running")
})

const server = http.createServer(app)

setupRealtimeSocket(server)

const PORT = process.env.PORT || 10000

server.listen(PORT,()=>{
  console.log("Server running on port",PORT)
})
