import express from "express";
import http from "http";
import WebSocket from "ws";
import cors from "cors";
import { config } from "dotenv";
import OpenAI from "openai";

config(); // load .env

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");

  let buffer = [];

  ws.on("message", async (msg) => {
    // Expecting ArrayBuffer (raw audio chunk)
    try {
      const audioData = Buffer.from(msg);

      // Push to buffer for streaming
      buffer.push(audioData);

      // Send audio to OpenAI streaming
      if (!ws.transcribing) {
        ws.transcribing = true;

        const stream = await openai.audio.transcriptions.create({
          file: Buffer.concat(buffer),
          model: "gpt-4o-mini-transcribe",
          response_format: "verbose_json",
        });

        if (stream.text) {
          ws.send(JSON.stringify({ transcript: stream.text }));
        }

        buffer = []; // reset buffer
        ws.transcribing = false;
      }
    } catch (err) {
      console.error("WebSocket error:", err);
      ws.send(JSON.stringify({ error: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
