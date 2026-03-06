import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const sessions = new Map();

export function createSession(ws) {
  const id = uuidv4();
  sessions.set(id, { ws, openai: null });
  return id;
}

export function getSession(id) {
  return sessions.get(id);
}

export function removeSession(id) {
  const session = sessions.get(id);
  if (session?.openai) session.openai.close();
  sessions.delete(id);
}

// ?? Initialize OpenAI Realtime WS
export async function initSession(session) {

  const openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  session.openai = openaiWs;

  openaiWs.on("open", () => {
    console.log("Connected to OpenAI Realtime for session");

    // Initialize transcription session
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["text"],
        input_audio_format: "pcm16",
        transcription: { model: "gpt-4o-mini-transcribe" }
      }
    }));
  });

  // ?? Forward transcription deltas to browser
  openaiWs.on("message", (msg) => {
    const event = JSON.parse(msg);

    if (event.type === "response.output_text.delta") {
      session.ws.send(JSON.stringify({
        type: "transcript",
        text: event.delta
      }));
    }

    if (event.type === "response.completed") {
      session.ws.send(JSON.stringify({ type: "done" }));
    }
  });

  openaiWs.on("close", () => console.log("OpenAI WS closed for session"));
  openaiWs.on("error", (err) => console.error("OpenAI WS error:", err));
}

// ?? Send audio chunks to OpenAI
export function sendAudio(session, base64Chunk) {
  if (!session.openai) return;
  session.openai.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: base64Chunk
  }));
}

// ?? Commit audio and request transcription
export function commitAudio(session) {
  if (!session.openai) return;
  session.openai.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  session.openai.send(JSON.stringify({ type: "response.create" }));
}
