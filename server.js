import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import { createSession, removeSession, getSession } from "./sessionManager.js"

const app = express()

app.get("/", (req, res) => {
  res.send("Live Transcription Server Running")
})

const server = http.createServer(app)

const wss = new WebSocketServer({
  server,
  path: "/ws"
})

wss.on("connection", async (ws) => {

  const sessionId = createSession(ws)

  console.log("Client connected:", sessionId)

  const session = getSession(sessionId)

  await session.init()

  ws.on("message", async (message) => {

    try {

      const data = JSON.parse(message)

      if (data.type === "audio") {

        session.sendAudio(data.chunk)

      }

    } catch (err) {

      console.error("WS message error:", err)

    }

  })

  ws.on("close", () => {

    console.log("Client disconnected:", sessionId)

    removeSession(sessionId)

  })

})

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {

  console.log("Server running on port", PORT)

})
