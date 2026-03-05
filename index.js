import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));

const PORT = process.env.PORT || 10000;

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store session transcripts in memory (pro-level context)
const sessions = {};

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Express POST fallback (optional)
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64 || !sessionId) return res.json({ transcript: "" });

    const sessionFile = path.join(uploadsDir, `${sessionId}_${Date.now()}.webm`);
    const wavFile = sessionFile.replace(".webm", ".wav");
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(sessionFile, audioBuffer);

    // Force re-encode WebM -> WAV (linear PCM)
    await new Promise((resolve, reject) => {
      ffmpeg(sessionFile)
        .outputOptions(["-ar 16000", "-ac 1", "-f wav"])
        .save(wavFile)
        .on("end", resolve)
        .on("error", reject);
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavFile),
      model: "whisper-1"
    });

    // Cleanup
    fs.unlinkSync(sessionFile);
    fs.unlinkSync(wavFile);

    const transcript = transcription.text?.trim() || "";
    if (!sessions[sessionId]) sessions[sessionId] = "";
    sessions[sessionId] += (sessions[sessionId] ? " " : "") + transcript;

    res.json({ transcript, fullTranscript: sessions[sessionId] });
  } catch (err) {
    console.error("TRANSCRIBE ERROR:", err);
    res.json({ transcript: "", fullTranscript: sessions[req.body.sessionId] || "" });
  }
});

// WebSocket for pro streaming
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
  let sessionId = uuidv4();
  ws.send(JSON.stringify({ sessionId }));

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (!data.audioBase64) return;

      const sessionFile = path.join(uploadsDir, `${sessionId}_${Date.now()}.webm`);
      const wavFile = sessionFile.replace(".webm", ".wav");
      const audioBuffer = Buffer.from(data.audioBase64, "base64");
      fs.writeFileSync(sessionFile, audioBuffer);

      // Re-encode WebM -> WAV
      await new Promise((resolve, reject) => {
        ffmpeg(sessionFile)
          .outputOptions(["-ar 16000", "-ac 1", "-f wav"])
          .save(wavFile)
          .on("end", resolve)
          .on("error", reject);
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(wavFile),
        model: "whisper-1"
      });

      fs.unlinkSync(sessionFile);
      fs.unlinkSync(wavFile);

      const transcript = transcription.text?.trim() || "";
      if (!sessions[sessionId]) sessions[sessionId] = "";
      sessions[sessionId] += (sessions[sessionId] ? " " : "") + transcript;

      ws.send(JSON.stringify({ transcript, fullTranscript: sessions[sessionId] }));
    } catch (err) {
      console.error("Whisper error:", err);
      ws.send(JSON.stringify({ error: err.message }));
    }
  });

  ws.on("close", () => console.log("Client disconnected:", sessionId));
});

// Upgrade HTTP server to handle WS
const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});
