// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { createSession, removeSession, getSession } from "./core/sessionManager.js";
import path from "path";

const app = express();

// serve front-end
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (req, res) => res.sendFile(path.join(process.cwd(), "public/index.html")));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (ws) => {
  const sessionId = createSession(ws);
  console.log("Client connected:", sessionId);

  const session = getSession(sessionId);
  await session.init();

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "audio") session.sendAudio(data.chunk);
      if (data.type === "audio_end") {
        // optional: finalize transcript
        console.log("Audio ended for session:", sessionId);
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected:", sessionId);
    removeSession(sessionId);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Server running on port", PORT));
