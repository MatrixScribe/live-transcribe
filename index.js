// index.js
import fs from "fs";
import path from "path";
import http from "http";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = process.env.PORT || 10000;

// In-memory session storage for continuous transcripts
const sessions = {};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/transcribe") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { audioBase64, sessionId } = JSON.parse(body);

        if (!audioBase64 || !sessionId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Missing audioBase64 or sessionId" }));
        }

        // Convert base64 to Buffer
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const tmpFile = path.join("/tmp", `chunk-${Date.now()}.webm`);
        fs.writeFileSync(tmpFile, audioBuffer);

        // Transcribe via OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpFile),
          model: "whisper-1"
        });

        fs.unlinkSync(tmpFile);

        // Append to session transcript
        if (!sessions[sessionId]) sessions[sessionId] = "";
        sessions[sessionId] += (sessions[sessionId] ? " " : "") + transcription.text;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          transcript: transcription.text,          // current chunk
          fullTranscript: sessions[sessionId]      // full so far
        }));

      } catch (err) {
        console.error("Transcription error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
