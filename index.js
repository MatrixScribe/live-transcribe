import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import OpenAI from "openai"

const app = express()

app.get("/", (req, res) => {
  res.send("Live Transcription Server Running")
})

const server = http.createServer(app)

const wss = new WebSocketServer({
  server,
  path: "/ws"
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

wss.on("connection", (ws) => {

  console.log("CLIENT CONNECTED")

  ws.on("message", async (audioChunk) => {

    try {

      console.log("AUDIO CHUNK RECEIVED:", audioChunk.length)

      const transcription = await openai.audio.transcriptions.create({
        file: audioChunk,
        model: "gpt-4o-transcribe"
      })

      ws.send(JSON.stringify({
        transcript: transcription.text
      }))

    } catch (error) {

      console.error("TRANSCRIPTION ERROR:", error)

    }

  })

  ws.on("close", () => {
    console.log("CLIENT DISCONNECTED")
  })

})

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT)
})
