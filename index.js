// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import OpenAI from "openai";
import { decode } from "base64-arraybuffer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "15mb" })); // allow bigger chunks

// ---------------- OpenAI Client ----------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    // Convert base64 to Uint8Array
    const audioBuffer = new Uint8Array(decode(audioBase64));

    // Save temp WAV file for this chunk
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const fileName = path.join(tempDir, `${sessionId || "session"}-${Date.now()}.wav`);
    fs.writeFileSync(fileName, audioBuffer);

    // Call OpenAI transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fileName),
      model: "gpt-4o-mini-transcribe" // faster streaming-friendly model
    });

    // Delete temp file
    fs.unlinkSync(fileName);

    // Return transcript
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
