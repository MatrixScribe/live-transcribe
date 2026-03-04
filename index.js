// --------------------------
// Live Transcription Backend
// --------------------------

const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

// --------------------------
// OpenAI Setup
// --------------------------
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// --------------------------
// Express Setup
// --------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // allow large audio chunks

const server = http.createServer(app);

// --------------------------
// WebSocket Server
// --------------------------
const wss = new WebSocket.Server({ server });
wss.on("connection", ws => {
  console.log("WebSocket client connected");
  ws.send(JSON.stringify({ message: "connected" }));
});

// --------------------------
// /transcribe endpoint
// --------------------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, sessionId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audio provided" });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Send to OpenAI transcription
    const response = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: "whisper-1"
    });

    if (response.text && response.text.trim() !== "") {
      return res.json({ transcript: response.text.trim() });
    } else {
      return res.json({ transcript: "" }); // empty transcript
    }
  } catch (err) {
    console.error("Transcription error:", err.message || err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --------------------------
// Start Server
// --------------------------
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
