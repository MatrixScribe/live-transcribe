// index.js
import express from "express";
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
app.use(bodyParser.json({ limit: "50mb" }));

// Init OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.json({ transcript: "" });

    // Decode base64 ? temp WebM file
    const tempWebmPath = path.join(__dirname, `temp_${sessionId}.webm`);
    const tempWavPath = path.join(__dirname, `temp_${sessionId}.wav`);
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(tempWebmPath, audioBuffer);

    // Convert WebM ? WAV using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(tempWebmPath)
        .toFormat("wav")
        .save(tempWavPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Call OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempWavPath),
      model: "whisper-1"
    });

    // Cleanup temp files
    fs.unlinkSync(tempWebmPath);
    fs.unlinkSync(tempWavPath);

    const transcript = transcription.text?.trim() || "";
    res.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    res.json({ transcript: "" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
