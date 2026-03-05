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
app.use(bodyParser.json({ limit: "100mb" })); // increase limit

// Init OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64 || audioBase64.length < 1000) return res.json({ transcript: "" });

    const tempWebmPath = path.join(uploadDir, `temp_${sessionId}_${Date.now()}.webm`);
    const tempWavPath = path.join(uploadDir, `temp_${sessionId}_${Date.now()}.wav`);

    // Decode base64 to WebM
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(tempWebmPath, audioBuffer);

    const stats = fs.statSync(tempWebmPath);
    console.log("Uploaded file:", tempWebmPath, "size:", stats.size);
    if (stats.size < 20000) { // skip tiny chunks
      fs.unlinkSync(tempWebmPath);
      return res.json({ transcript: "" });
    }

    // Convert WebM ? WAV
    await new Promise((resolve, reject) => {
      ffmpeg(tempWebmPath)
        .inputOptions(["-f webm", "-c:a copy"])
        .toFormat("wav")
        .save(tempWavPath)
        .on("end", resolve)
        .on("error", (err) => {
          console.error("FFmpeg conversion error:", err);
          reject(err);
        });
    });

    // OpenAI Whisper transcription
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
    console.error("TRANSCRIBE ERROR:", err);
    res.json({ transcript: "" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
