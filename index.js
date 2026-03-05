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

    if (!audioBase64) {
      console.log("? No audio received");
      return res.json({ transcript: "" });
    }

    // Decode base64
    const audioBuffer = Buffer.from(audioBase64, "base64");

    console.log("?? Received audio size:", audioBuffer.length, "bytes");

    if (audioBuffer.length < 15000) {
      console.log("?? Segment too small — skipping");
      return res.json({ transcript: "" });
    }

    const tempWebmPath = path.join(__dirname, `temp_${sessionId}.webm`);
    const tempWavPath = path.join(__dirname, `temp_${sessionId}.wav`);

    fs.writeFileSync(tempWebmPath, audioBuffer);

    console.log("?? Converting WebM ? WAV");

    await new Promise((resolve, reject) => {
      ffmpeg(tempWebmPath)
        .toFormat("wav")
        .save(tempWavPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("?? Sending to Whisper...");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempWavPath),
      model: "whisper-1"
    });

    const transcript = transcription.text?.trim() || "";

    console.log("?? Whisper result:", transcript);

    // Cleanup
    if (fs.existsSync(tempWebmPath)) fs.unlinkSync(tempWebmPath);
    if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

    res.json({ transcript });

  } catch (err) {
    console.error("? Transcription error:", err);
    res.json({ transcript: "" });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`?? Server listening on port ${PORT}`);
});
