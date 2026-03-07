import WebSocket from "ws";
import { decode } from "audio-decode";
import { Transform } from "stream";

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Convert WebM Blob (from frontend) to PCM16 Float32Array
async function webmToPCM16(arrayBuffer) {
  const audioBuffer = await decode(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const pcm16 = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    pcm16[i] = Math.max(-1, Math.min(1, channelData[i])) * 32767;
  }
  return pcm16.buffer;
}

export async function handleRealtimeSession(clientWs) {
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  });

  openaiWs.on("open", () => console.log("Connected to OpenAI Realtime"));

  // Push transcription back to client
  openaiWs.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "transcript") {
        clientWs.send(JSON.stringify({ transcript: data.text }));
      }
    } catch (e) {
      console.error("OpenAI message parse error:", e);
    }
  });

  clientWs.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "audio") {
        const pcm = await webmToPCM16(Buffer.from(data.chunk));
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer", audio: Array.from(new Uint16Array(pcm)) }));
      }
    } catch (err) {
      console.error("Client audio processing error:", err);
    }
  });

  clientWs.on("close", () => {
    console.log("Client disconnected");
    openaiWs.close();
  });
}
