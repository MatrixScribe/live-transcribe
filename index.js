// index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // handle large audio files

// OpenAI setup
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Hello endpoint
app.get('/', (req, res) => {
  res.send('Hello from Live Transcribe Server!');
});

// Transcription endpoint
app.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'No audio provided' });

    // Save audio temporarily
    const buffer = Buffer.from(audioBase64, 'base64');
    const tempFile = 'audio-temp.wav';
    fs.writeFileSync(tempFile, buffer);

    // Call OpenAI Whisper API
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: 'whisper-1',
    });

    fs.unlinkSync(tempFile); // clean up temp file
    res.json({ transcript: response.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
