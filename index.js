import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple health check
app.get("/", (req, res) => res.send("Live Transcribe backend online"));

// Transcription endpoint
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audio provided" });

    const buffer = Buffer.from(audioBase64, "base64");

    const response = await openai.audio.transcriptions.create({
      file: buffer,
      model: "whisper-1"
    });

    const transcript = response.text || "";
    res.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

// Start server
const server = app.listen(port, () => console.log(`Server listening on port ${port}`));

// WebSocket (optional, for future real-time streaming)
const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
  console.log("WS client connected");
  ws.on("message", msg => console.log("WS message:", msg.toString()));
});
