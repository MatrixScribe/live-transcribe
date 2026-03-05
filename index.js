import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Context memory per session
const sessionContext = {};

// Uploads directory
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// HTTP server
const server = app.listen(process.env.PORT || 10000, () =>
  console.log("Server listening on port", process.env.PORT || 10000)
);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let sessionId = "session_" + Date.now();
  sessionContext[sessionId] = [];

  ws.on("message", async (msg) => {
    try {
      const { audioBase64 } = JSON.parse(msg);
      if (!audioBase64) return;

      const webmPath = path.join(UPLOAD_DIR, `${sessionId}_${Date.now()}.webm`);
      const wavPath = webmPath.replace(".webm", ".wav");
      fs.writeFileSync(webmPath, Buffer.from(audioBase64, "base64"));

      // Convert WebM ? WAV
      await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
          .toFormat("wav")
          .save(wavPath)
          .on("end", resolve)
          .on("error", reject);
      });

      // Call OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(wavPath),
        model: "whisper-1",
      });

      const text = transcription.text?.trim() || "";
      sessionContext[sessionId].push(text);

      // Send back to client
      ws.send(JSON.stringify({ transcript: text, context: sessionContext[sessionId] }));

      // Clean up
      fs.unlinkSync(webmPath);
      fs.unlinkSync(wavPath);
    } catch (err) {
      console.error("Whisper error:", err);
      ws.send(JSON.stringify({ transcript: "", error: err.message }));
    }
  });

  ws.on("close", () => {
    delete sessionContext[sessionId];
    console.log("Client disconnected");
  });

  ws.send(JSON.stringify({ sessionId, message: "Connected to Pro Streaming Transcribe Server" }));
});
