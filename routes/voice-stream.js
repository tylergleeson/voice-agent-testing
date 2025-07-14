const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const TwilioMediaStreamService = require('../services/twilio-media-stream');
const VoiceStreamOrchestrator = require('../services/voice-stream-orchestrator');

const router = express.Router();

// Voice 2.0 webhook - starts media streaming instead of recording
router.post('/webhook-stream', async (req, res) => {
  console.log('=== VOICE 2.0 WEBHOOK RECEIVED ===');
  console.log('CallSid:', req.body.CallSid);
  console.log('From:', req.body.From);
  console.log('CallStatus:', req.body.CallStatus);
  
  const twiml = new VoiceResponse();
  
  try {
    // Check if ElevenLabs is configured for Voice 2.0
    const ElevenLabsVoice2Service = require('../services/elevenlabs-voice2');
    const testService = new ElevenLabsVoice2Service();
    
    if (!testService.isConfigured()) {
      console.log('ElevenLabs Voice 2.0 not configured, using fallback');
      twiml.say('Hello! ElevenLabs Voice 2.0 is not configured. Please check your agent ID.');
      twiml.hangup();
    } else {
      // Start media streaming for real-time conversation
      console.log('Starting Twilio Media Streams...');
      
      // Use BASE_URL for Railway deployment
      const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;
      const wsUrl = `${baseUrl.replace('https://', 'wss://')}/voice/media-stream`;
      console.log('WebSocket URL for Twilio:', wsUrl);
      
      const start = twiml.start();
      start.stream({
        name: 'elevenlabs-voice2-stream',
        url: wsUrl
      });
      
      console.log('Media stream configuration added to TwiML');
      
      // Welcome message while setting up stream
      twiml.say({
        voice: 'Polly.Joanna'
      }, 'Hello! Connecting you to our AI assistant. Please wait a moment.');
    }
    
  } catch (error) {
    console.error('=== VOICE 2.0 WEBHOOK ERROR ===');
    console.error('Error:', error);
    twiml.say('Sorry, there was an error connecting to the voice assistant.');
    twiml.hangup();
  }
  
  console.log('=== SENDING VOICE 2.0 RESPONSE ===');
  console.log('TwiML Length:', twiml.toString().length);
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Note: WebSocket endpoint is registered in server.js due to express-ws requirements

// Status endpoint for Voice 2.0
router.get('/stream-status', (req, res) => {
  const stats = VoiceStreamOrchestrator.getStats();
  
  res.json({
    service: 'ElevenLabs Voice 2.0 Streaming',
    status: 'running',
    activeConversations: stats.activeConversations,
    conversations: stats.conversations,
    uptime: process.uptime()
  });
});

// Manual call initiation with Voice 2.0
router.post('/initiate-stream-call', async (req, res) => {
  const { phoneNumber } = req.body;
  
  try {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const baseUrl = process.env.BASE_URL || 'https://voice-agent-testing-production.up.railway.app';
    
    const call = await twilio.calls.create({
      url: `${baseUrl}/voice/webhook-stream`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    res.json({ 
      success: true, 
      callSid: call.sid,
      message: 'Voice 2.0 streaming call initiated',
      type: 'streaming'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;