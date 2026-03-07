import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { handleRealtimeSession } from "./sessionManager.js";

const app = express();

app.get("/", (req, res) => {
  res.send("Live Transcription Server Running");
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws",
});

wss.on("connection", async (ws) => {
  console.log("Client connected");

  try {
    await handleRealtimeSession(ws);
  } catch (err) {
    console.error("Session error:", err);
    ws.close();
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Server running on port", PORT));
