import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();

app.get("/", (req,res)=>{
  res.send("Live Transcription Server Running");
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

wss.on("connection", (client) => {

  const clientId = crypto.randomUUID();
  console.log("Client connected:", clientId);

  const openai = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  openai.on("open", () => {
    console.log("Connected to OpenAI realtime");
    // session config
    openai.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["text"],
        input_audio_format: "webm",
        input_audio_transcription: { model: "gpt-4o-transcribe" },
        speaker_diarization: true
      }
    }));
  });

  openai.on("message", (data)=>{
    const msg = JSON.parse(data);
    if(msg.type === "response.output_text.delta"){
      client.send(JSON.stringify({ transcript: msg.delta }));
    }
  });

  let audioBuffer = [];

  client.on("message", async (chunk) => {
    try {
      // convert Blob/Buffer to base64 properly
      const arrayBuffer = await chunk.arrayBuffer?.() || chunk;
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      openai.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio
      }));

      // immediately commit the buffer to generate transcript
      openai.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      // create the streaming response
      openai.send(JSON.stringify({ type: "response.create" }));

    } catch (err) {
      console.error("Audio processing error:", err);
    }
  });

  client.on("close", () => {
    console.log("Client disconnected:", clientId);
    if(openai.readyState === WebSocket.OPEN) openai.close();
  });

});

const PORT = process.env.PORT || 10000;
server.listen(PORT, ()=>{
  console.log("Server running on port", PORT);
});
