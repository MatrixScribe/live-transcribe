// core/sessionManager.js
import crypto from "crypto";
import WebSocket from "ws";
import OpenAI from "openai";

const sessions = {};

export class RealtimeSession {
  constructor(ws) {
    this.ws = ws;
    this.openaiWs = null;
  }

  async init() {
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

    this.openaiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.openaiWs.on("open", () => {
      console.log("Connected to OpenAI Realtime API");
    });

    this.openaiWs.on("message", (event) => {
      const data = JSON.parse(event.toString());

      // handle partial transcript
      if (data.type === "transcript.delta") {
        this.ws.send(JSON.stringify({ type: "transcript", text: data.text }));
      }

      // handle final transcript
      if (data.type === "transcript.final") {
        this.ws.send(JSON.stringify({ type: "transcript.final", text: data.text }));
      }
    });

    this.openaiWs.on("error", (err) => console.error("OpenAI WS error:", err));
  }

  sendAudio(base64Chunk) {
    if (!this.openaiWs || this.openaiWs.readyState !== WebSocket.OPEN) return;

    // append chunk
    this.openaiWs.send(
      JSON.stringify({ type: "input_audio_buffer.append", audio: base64Chunk })
    );

    // commit buffer and request response
    this.openaiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    this.openaiWs.send(JSON.stringify({ type: "response.create" }));
  }

  close() {
    if (this.openaiWs) this.openaiWs.close();
  }
}

export function createSession(ws) {
  const sessionId = crypto.randomUUID();
  sessions[sessionId] = new RealtimeSession(ws);
  return sessionId;
}

export function getSession(sessionId) {
  return sessions[sessionId];
}

export function removeSession(sessionId) {
  const s = sessions[sessionId];
  if (s) s.close();
  delete sessions[sessionId];
}
