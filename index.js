import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/transcribe", async (req, res) => {

  try {

    const { audioBase64, sessionId } = req.body;

    if (!audioBase64) {
      return res.json({ transcript: "" });
    }

    const buffer = Buffer.from(audioBase64, "base64");

    // skip tiny chunks
    if (buffer.length < 15000) {
      return res.json({ transcript: "" });
    }

    const webm = path.join(__dirname, `temp_${sessionId}.webm`);
    const wav = path.join(__dirname, `temp_${sessionId}.wav`);

    fs.writeFileSync(webm, buffer);

    await new Promise((resolve, reject) => {

      ffmpeg(webm)
        .audioFrequency(16000)
        .audioChannels(1)
        .format("wav")
        .save(wav)
        .on("end", resolve)
        .on("error", reject);

    });

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wav),
      model: "whisper-1"
    });

    fs.unlinkSync(webm);
    fs.unlinkSync(wav);

    const transcript = result.text?.trim() || "";

    res.json({ transcript });

  } catch (err) {

    console.error("TRANSCRIBE ERROR:", err);
    res.json({ transcript: "" });

  }

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
