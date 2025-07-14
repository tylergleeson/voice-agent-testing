const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');
require('dotenv').config();

const voiceRoutes = require('./routes/voice');
const voiceStreamRoutes = require('./routes/voice-stream');
const testRoutes = require('./routes/test');

const app = express();
// Enable WebSocket support
const wsInstance = expressWs(app);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static audio files
app.use('/audio', express.static('audio'));
app.use('/recordings', express.static('recordings'));

// Routes
app.use('/voice', voiceRoutes);
app.use('/voice', voiceStreamRoutes); // Voice 2.0 streaming routes
app.use('/test', testRoutes);

// WebSocket endpoint for Twilio Media Streams (must be after regular routes)
app.ws('/voice/media-stream', (ws, req) => {
  console.log('New Twilio Media Stream WebSocket connection');
  const TwilioMediaStreamService = require('./services/twilio-media-stream');
  TwilioMediaStreamService.handleConnection(ws, req);
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Voice Agent Test Server Running' });
});

// List audio files endpoint
app.get('/audio-files', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const audioDir = path.join(__dirname, 'audio');
    if (!fs.existsSync(audioDir)) {
      return res.json({ files: [], message: 'Audio directory does not exist' });
    }
    
    const files = fs.readdirSync(audioDir);
    const audioFiles = files
      .filter(file => file.endsWith('.mp3'))
      .map(file => ({
        name: file,
        url: `${process.env.BASE_URL || 'https://voice-agent-testing-production.up.railway.app'}/audio/${file}`,
        created: fs.statSync(path.join(audioDir, file)).mtime
      }))
      .sort((a, b) => b.created - a.created);
    
    res.json({ 
      count: audioFiles.length,
      files: audioFiles 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://voice-agent-testing-production.up.railway.app';

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - Voice 2.0 Ready`);
  console.log(`Original Webhook URL: ${BASE_URL}/voice/webhook`);
  console.log(`Voice 2.0 Webhook URL: ${BASE_URL}/voice/webhook-stream`);
  console.log(`WebSocket URL: wss://${BASE_URL.replace('https://', '')}/voice/media-stream`);
  console.log('Environment check:', {
    PORT,
    BASE_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || 'Missing',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'Set' : 'Missing',
    ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID ? 'Set' : 'Missing - REQUIRED FOR VOICE 2.0'
  });
});