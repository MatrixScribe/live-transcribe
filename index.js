import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// ---------------- OpenAI Client ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- Helper: Convert WebM to WAV ----------------
async function convertWebMToWav(webmBuffer) {
  return new Promise((resolve, reject) => {
    const inputPath = path.join(tmpdir(), `input_${Date.now()}.webm`);
    const outputPath = path.join(tmpdir(), `output_${Date.now()}.wav`);

    fs.writeFileSync(inputPath, webmBuffer);

    const ffmpegProcess = spawn(ffmpeg, [
      "-y",
      "-i", inputPath,
      "-ar", "16000", // 16kHz for OpenAI
      "-ac", "1",     // mono
      outputPath
    ]);

    ffmpegProcess.on("error", (err) => reject(err));
    ffmpegProcess.stderr.on("data", () => {}); // suppress logs

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) return reject(new Error("FFmpeg failed"));

      const wavBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      resolve(wavBuffer);
    });
  });
}

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audio sent" });

    const webmBuffer = Buffer.from(audioBase64, "base64");

    // Convert WebM -> WAV
    const wavBuffer = await convertWebMToWav(webmBuffer);

    // Send to OpenAI
    const response = await openai.audio.transcriptions.create({
      file: wavBuffer,
      model: "gpt-4o-mini-transcribe",
      // You can also use "whisper-1" if preferred
    });

    const transcript = response.text || "";

    res.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
