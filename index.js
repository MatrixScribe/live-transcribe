// index.js
import express from "express";
import cors from "cors";
import fs from "fs";
import { Configuration, OpenAIApi } from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- CORS ----------
app.use(cors());
app.use(express.json({ limit: "50mb" })); // large audio chunks

// ---------- OpenAI Setup ----------
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// ---------- Transcribe endpoint ----------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;

    if (!audioBase64 || !sessionId) {
      return res.status(400).json({ error: "Missing audioBase64 or sessionId" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const tmpFile = `./tmp_${sessionId}_${Date.now()}.webm`;
    fs.writeFileSync(tmpFile, audioBuffer);

    // Send to OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: "gpt-4o-mini-transcribe"
    });

    fs.unlinkSync(tmpFile);

    if (transcription?.text) {
      res.json({ transcript: transcription.text });
    } else {
      res.json({ transcript: "" });
    }
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ---------- Health check ----------
app.get("/", (req, res) => res.send("Backend live"));

// ---------- Start server ----------
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
