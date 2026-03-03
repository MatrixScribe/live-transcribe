// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { decode } from "base64-arraybuffer";
import { spawn } from "child_process"; // for optional conversion

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" })); // larger chunks

// ---------------- OpenAI Client ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------- Utility: Convert WebM to WAV ----------------
// Optional: ensures Whisper can read it without failing
async function webmToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-ar", "16000", // sample rate for Whisper
      "-ac", "1",     // mono
      outputPath
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error("ffmpeg failed with code " + code));
    });
  });
}

// ---------------- POST /transcribe ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    // Decode base64 into a Uint8Array
    const audioBuffer = new Uint8Array(decode(audioBase64));

    // Temporary file paths
    const timestamp = Date.now();
    const webmFile = path.join(__dirname, `${sessionId || "session"}-${timestamp}.webm`);
    const wavFile = path.join(__dirname, `${sessionId || "session"}-${timestamp}.wav`);

    // Save the WebM chunk
    fs.writeFileSync(webmFile, audioBuffer);

    // Convert to WAV for Whisper reliability
    await webmToWav(webmFile, wavFile);

    // Call OpenAI transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavFile),
      model: "whisper-1"
    });

    // Clean up temp files
    fs.unlinkSync(webmFile);
    fs.unlinkSync(wavFile);

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
