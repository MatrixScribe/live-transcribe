import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// Use prebuilt ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Temporary storage folder for segments
const SEGMENT_DIR = path.join(__dirname, "segments");
if (!fs.existsSync(SEGMENT_DIR)) fs.mkdirSync(SEGMENT_DIR);

// ---------------- Transcription endpoint ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64 || !sessionId) return res.status(400).json({ error: "Missing audioBase64 or sessionId" });

    const buffer = Buffer.from(audioBase64, "base64");
    const tempFile = path.join(SEGMENT_DIR, `${sessionId}_${Date.now()}.webm`);
    fs.writeFileSync(tempFile, buffer);

    // Convert to WAV for OpenAI (more reliable)
    const wavFile = tempFile.replace(".webm", ".wav");

    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(wavFile);
    });

    // Transcribe with OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavFile),
      model: "gpt-4o-mini-transcribe"
    });

    // Clean up temp files
    fs.unlinkSync(tempFile);
    fs.unlinkSync(wavFile);

    res.json({ transcript: transcription.text || "" });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

// ---------------- Health check ----------------
app.get("/", (req, res) => res.send("Live Transcribe Backend is running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
