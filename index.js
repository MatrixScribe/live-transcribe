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
app.use(bodyParser.json({ limit: "15mb" })); // handle chunked audio

// ---------------- OpenAI Client ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    // Convert base64 to Uint8Array
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Save temp file
    const fileName = path.join(__dirname, `${sessionId || "session"}-${Date.now()}.webm`);
    fs.writeFileSync(fileName, audioBuffer);

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fileName),
      model: "whisper-1"
    });

    // Delete temp file
    fs.unlinkSync(fileName);

    res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

// ---------------- Server ----------------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
