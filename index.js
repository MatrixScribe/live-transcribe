import express from "express";
import cors from "cors";
import fs from "fs";
import { spawn } from "child_process";
import path from "path";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- Middlewares ----------------
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// ---------------- OpenAI Setup ----------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------- Paths ----------------
const ffmpegPath = path.resolve("./ffmpeg");

// ---------------- Transcribe Route ----------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "Missing audio data" });

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const tempInput = `temp_${sessionId}.webm`;
    const tempOutput = `temp_${sessionId}.wav`;

    fs.writeFileSync(tempInput, audioBuffer);

    // Convert to wav using prebuilt FFmpeg
    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        "-y",
        "-i", tempInput,
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        tempOutput
      ]);

      ff.on("error", reject);
      ff.on("close", (code) => {
        if (code !== 0) reject(new Error(`FFmpeg exited with ${code}`));
        else resolve();
      });
    });

    // Read wav file and send to OpenAI transcription
    const audioFile = fs.readFileSync(tempOutput);
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1"
    });

    // Clean up temp files
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

    res.json({ transcript: response.text || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Transcription error" });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
