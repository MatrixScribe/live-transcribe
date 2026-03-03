// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { decode } from "base64-arraybuffer";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" })); // increased for longer chunks

// ---------------- OpenAI ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(decode(audioBase64));

    // Save temporary WebM
    const webmFile = path.join(__dirname, `${sessionId || "session"}-${Date.now()}.webm`);
    fs.writeFileSync(webmFile, audioBuffer);

    // Convert to WAV using ffmpeg-static
    const wavFile = webmFile.replace(".webm", ".wav");

    await new Promise((resolve, reject) => {
      ffmpeg(webmFile)
        .setFfmpegPath(ffmpegPath)
        .output(wavFile)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Transcribe with OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavFile),
      model: "whisper-1"
    });

    // Clean up temp files
    fs.unlinkSync(webmFile);
    fs.unlinkSync(wavFile);

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
