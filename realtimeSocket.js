import WebSocket from "ws"

export default class RealtimeSession {

  constructor(clientWS) {

    this.clientWS = clientWS
    this.openaiWS = null

  }

  async init() {

    this.openaiWS = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      }
    )

    this.openaiWS.on("open", () => {

      console.log("Connected to OpenAI realtime")

      this.openaiWS.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text"],
          input_audio_format: "pcm16",
          turn_detection: {
            type: "server_vad"
          }
        }
      }))

    })

    this.openaiWS.on("message", (msg) => {

      try {

        const data = JSON.parse(msg)

        if (data.type === "response.output_text.delta") {

          this.clientWS.send(JSON.stringify({
            transcript: data.delta
          }))

        }

      } catch (err) {

        console.error("OpenAI message error:", err)

      }

    })

  }

  sendAudio(base64Chunk) {

    if (!this.openaiWS || this.openaiWS.readyState !== 1) return

    this.openaiWS.send(JSON.stringify({
      type: "input_audio_buffer.append",
      audio: base64Chunk
    }))

  }

  close() {

    if (this.openaiWS) {

      this.openaiWS.close()

    }

  }

}
