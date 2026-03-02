// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { decode } from "base64-arraybuffer";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json({ limit: "15mb" })); // allow bigger audio chunks

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if(!audioBase64) return res.status(400).json({ error: "No audioBase64" });

    const audioBuffer = new Uint8Array(decode(audioBase64));
    const fileName = path.join("./", `${sessionId || "session"}-${Date.now()}.webm`);
    fs.writeFileSync(fileName, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fileName),
      model: "whisper-1"
    });

    fs.unlinkSync(fileName);

    res.json({ transcript: transcription.text });
  } catch(err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
