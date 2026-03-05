// index.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json({ limit: "200mb" }));

const PORT = process.env.PORT || 10000;
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// store session transcripts
const sessions = {};

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", ws => {
  const sessionId = Date.now() + "_" + Math.floor(Math.random() * 10000);
  sessions[sessionId] = "";
  ws.send(JSON.stringify({ sessionId }));

  ws.on("message", async msg => {
    try {
      const { audioBase64 } = JSON.parse(msg);
      if (!audioBase64) return;

      const webmFile = path.join(uploadsDir, `${sessionId}.webm`);
      const wavFile = path.join(uploadsDir, `${sessionId}.wav`);
      fs.writeFileSync(webmFile, Buffer.from(audioBase64, "base64"));

      await new Promise((resolve, reject) => {
        ffmpeg(webmFile)
          .outputOptions(["-ar 16000", "-ac 1"])
          .toFormat("wav")
          .save(wavFile)
          .on("end", resolve)
          .on("error", reject);
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(wavFile),
        model: "whisper-1"
      });

      const text = transcription.text?.trim() || "";
      sessions[sessionId] += (sessions[sessionId] ? " " : "") + text;

      ws.send(JSON.stringify({ transcript: text, fullTranscript: sessions[sessionId] }));

      fs.unlinkSync(webmFile);
      fs.unlinkSync(wavFile);

    } catch (err) {
      console.error("Whisper error:", err.message);
      ws.send(JSON.stringify({ error: err.message }));
    }
  });

  ws.on("close", () => console.log("Client disconnected:", sessionId));
});

// HTTP server
const server = app.listen(PORT, () => console.log(`Server running on ${PORT}`));
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});
