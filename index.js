import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.json({ transcript: "" });

    const tempWebmPath = path.join(uploadsDir, `temp_${sessionId}.webm`);
    const tempWavPath = path.join(uploadsDir, `temp_${sessionId}.wav`);

    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(tempWebmPath, audioBuffer);

    // convert WebM -> WAV
    await new Promise((resolve, reject) => {
      ffmpeg(tempWebmPath)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(tempWavPath);
    });

    // call OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempWavPath),
      model: "whisper-1"
    });

    // cleanup
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
