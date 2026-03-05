import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import OpenAI from "openai"
import multer from "multer"

const app = express()
const server = http.createServer(app)

const wss = new WebSocketServer({ server })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const uploadDir = "./uploads"
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)

wss.on("connection", (ws) => {

  console.log("Client connected")

  ws.on("message", async (message) => {

    try {

      const data = JSON.parse(message)

      const audioBuffer = Buffer.from(data.audioBase64, "base64")

      const webmPath = `${uploadDir}/${Date.now()}.webm`
      const wavPath = `${uploadDir}/${Date.now()}.wav`

      fs.writeFileSync(webmPath, audioBuffer)

      await new Promise((resolve, reject) => {

        ffmpeg(webmPath)
          .audioChannels(1)
          .audioFrequency(16000)
          .format("wav")
          .save(wavPath)
          .on("end", resolve)
          .on("error", reject)

      })

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(wavPath),
        model: "gpt-4o-transcribe"
      })

      ws.send(JSON.stringify({
        transcript: transcription.text
      }))

      fs.unlinkSync(webmPath)
      fs.unlinkSync(wavPath)

    } catch (err) {

      console.error("Transcription error:", err)

      ws.send(JSON.stringify({
        error: "transcription_failed"
      }))

    }

  })

  ws.on("close", () => {
    console.log("Client disconnected")
  })

})

app.get("/", (req, res) => {
  res.send("Live transcription server running")
})

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {
  console.log("Server listening on port", PORT)
})
