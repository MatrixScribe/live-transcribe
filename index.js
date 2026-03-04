import express from "express";
import cors from "cors";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64 || !sessionId) return res.status(400).json({ error: "Missing audioBase64 or sessionId" });

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const tmpFile = `./tmp_${sessionId}_${Date.now()}.webm`;
    fs.writeFileSync(tmpFile, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: "gpt-4o-mini-transcribe"
    });

    fs.unlinkSync(tmpFile);

    res.json({ transcript: transcription.text || "" });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.get("/", (req, res) => res.send("Backend live"));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
