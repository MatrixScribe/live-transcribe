// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" })); // handle larger chunks

// ---------------- OpenAI Client ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------- Session buffer ----------------
const sessions = {}; // sessionId => { audioBuffers: [] }
const CHUNKS_PER_TRANSCRIPTION = 3; // ~3 chunks ~ 6-9 sec

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64 || !sessionId)
      return res.status(400).json({ error: "audioBase64 and sessionId required" });

    if (!sessions[sessionId]) sessions[sessionId] = { audioBuffers: [] };

    // Convert base64 -> Buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");
    sessions[sessionId].audioBuffers.push(audioBuffer);

    // Only transcribe every N chunks
    if (sessions[sessionId].audioBuffers.length >= CHUNKS_PER_TRANSCRIPTION) {
      const combinedBuffer = Buffer.concat(sessions[sessionId].audioBuffers);
      const tempFile = path.join(__dirname, `${sessionId}-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, combinedBuffer);

      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFile),
          model: "whisper-1"
        });

        fs.unlinkSync(tempFile);

        // Clear buffer after transcription
        sessions[sessionId].audioBuffers = [];

        return res.json({ transcript: transcription.text });
      } catch (err) {
        console.error("Transcription failed:", err);
        return res.status(500).json({ error: err.message });
      }
    } else {
      // Not enough chunks yet
      return res.json({ transcript: "" });
    }

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Start server ----------------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
