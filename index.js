import WebSocket, { WebSocketServer } from "ws";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";
import { PassThrough } from "stream";

ffmpeg.setFfmpegPath(ffmpegPath);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server listening on port ${PORT}`);

wss.on("connection", (ws) => {
  console.log("Client connected");

  const audioStream = new PassThrough();

  // FFmpeg transforms raw PCM -> WAV
  const ffmpegProcess = ffmpeg(audioStream)
    .inputFormat("s16le")
    .audioFrequency(16000)
    .audioChannels(1)
    .format("wav")
    .on("error", (err) => console.error("FFmpeg error:", err));

  ffmpegProcess.pipe(new PassThrough()); // keep stream flowing

  let buffer = [];
  ws.on("message", async (msg) => {
    buffer.push(msg);

    // Send to Whisper every ~1 second (or 16k samples)
    if (buffer.length >= 20) { 
      const chunk = Buffer.concat(buffer);
      buffer = [];

      try {
        const transcription = await openai.audio.transcriptions.create({
          file: chunk,
          model: "whisper-1"
        });
        if (transcription.text) {
          ws.send(JSON.stringify({ transcript: transcription.text }));
        }
      } catch (err) {
        console.error("Whisper error:", err);
      }
    }
  });

  ws.on("close", () => {
    audioStream.end();
    console.log("Client disconnected");
  });
});
