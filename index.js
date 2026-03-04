import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import bodyParser from "body-parser";
import { Configuration, OpenAIApi } from "openai";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// OpenAI config
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Ensure temp folder exists
const tempDir = path.join(process.cwd(), "tmp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Helper: convert webm/ogg blob to WAV
function convertToWav(inputBuffer) {
  return new Promise((resolve, reject) => {
    const inputPath = path.join(tempDir, `input-${Date.now()}.webm`);
    const outputPath = path.join(tempDir, `output-${Date.now()}.wav`);
    fs.writeFileSync(inputPath, inputBuffer);

    execFile(ffmpegPath, ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", outputPath], (err) => {
      if (err) return reject(err);
      const wavBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      resolve(wavBuffer);
    });
  });
}

// Route: receive audio chunk
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Convert to WAV
    const wavBuffer = await convertToWav(audioBuffer);

    // Send to OpenAI
    const response = await openai.audio.transcriptions.create({
      file: wavBuffer,
      model: "gpt-4o-transcribe",
      response_format: "json",
    });

    const transcript = response.text?.trim() || "";
    return res.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    return res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
