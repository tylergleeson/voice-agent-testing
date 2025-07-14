const express = require('express');
const cors = require('cors');
require('dotenv').config();

const voiceRoutes = require('./routes/voice');
const testRoutes = require('./routes/test');

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static audio files
app.use('/audio', express.static('audio'));
app.use('/recordings', express.static('recordings'));

// Routes
app.use('/voice', voiceRoutes);
app.use('/test', testRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Voice Agent Test Server Running' });
});

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://voice-agent-testing-production.up.railway.app';

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${BASE_URL}/voice/webhook`);
  console.log('Environment check:', {
    PORT,
    BASE_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || 'Missing'
  });
});