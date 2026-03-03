import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check route (important for Render)
app.get("/", (req, res) => {
  res.send("Live Transcribe Backend Running");
});

// Transcription route
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 required" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const tempFilePath = path.join(__dirname, `chunk-${Date.now()}.webm`);

    fs.writeFileSync(tempFilePath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1"
    });

    fs.unlinkSync(tempFilePath);

    return res.json({ transcript: transcription.text });

  } catch (error) {
    console.error("Transcription error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
