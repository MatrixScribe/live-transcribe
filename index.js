// index.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// OpenAI (NEW SDK — correct way)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.send("Live Transcribe Server is running.");
});

// Transcription endpoint
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "No audio provided" });
    }

    const tempFilePath = path.join(__dirname, "temp-audio.wav");

    // Convert base64 ? file
    const buffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(tempFilePath, buffer);

    // Send to OpenAI Whisper
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    res.json({ transcript: response.text });

  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({
      error: "Transcription failed",
      details: error.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
