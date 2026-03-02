// index.js
import express from "express";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // large chunks

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Root endpoint
app.get("/", (req, res) => res.send("Live transcription server running."));

// Transcription endpoint
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audioBase64 provided" });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const tempFile = join(__dirname, `temp-${Date.now()}.webm`);
    fs.writeFileSync(tempFile, audioBuffer);

    // Call OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: "whisper-1",
    });

    fs.unlinkSync(tempFile); // clean up temp file
    res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
