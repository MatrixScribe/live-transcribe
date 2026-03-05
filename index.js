import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Use multer to parse multipart/form-data
const upload = multer({ dest: "uploads/" });

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ transcript: "" });

    const sessionId = req.body.sessionId || "session_" + Date.now();
    const tempWavPath = path.join("uploads", `${sessionId}.wav`);

    // Convert uploaded file to WAV
    await new Promise((resolve, reject) => {
      ffmpeg(req.file.path)
        .toFormat("wav")
        .save(tempWavPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempWavPath),
      model: "whisper-1"
    });

    // Cleanup
    fs.unlinkSync(req.file.path);
    fs.unlinkSync(tempWavPath);

    res.json({ transcript: transcription.text?.trim() || "" });
  } catch (err) {
    console.error("TRANSCRIBE ERROR:", err);
    res.json({ transcript: "" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
