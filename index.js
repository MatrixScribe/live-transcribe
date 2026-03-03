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

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 required" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const tempFile = path.join(__dirname, `chunk-${Date.now()}.webm`);
    fs.writeFileSync(tempFile, audioBuffer);

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: "whisper-1"
      });

      fs.unlinkSync(tempFile);

      return res.json({ transcript: transcription.text });

    } catch (err) {
      console.error("Transcription failed:", err);
      return res.status(500).json({ error: err.message });
    }

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});
