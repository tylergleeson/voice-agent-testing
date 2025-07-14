const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const TTS = require('../services/tts');
const Conversation = require('../services/conversation');
const Transcription = require('../services/transcription');

const router = express.Router();

// In-memory session storage (for testing only)
const sessions = new Map();

// Webhook handler for incoming calls
router.post('/webhook', async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('CallSid:', req.body.CallSid);
  console.log('From:', req.body.From);
  console.log('CallStatus:', req.body.CallStatus);
  
  const { CallSid, Digits, RecordingUrl, From } = req.body;
  const twiml = new VoiceResponse();
  
  try {
    let session = sessions.get(CallSid);
    
    // Initialize new session
    if (!session) {
      session = {
        callSid: CallSid,
        phoneNumber: From,
        conversationHistory: [],
        startTime: new Date()
      };
      sessions.set(CallSid, session);
      
      // Welcome message
      const welcomeMessage = Conversation.getWelcomeMessage();
      try {
        const welcomeAudio = await TTS.generateAudio(welcomeMessage);
        twiml.play(welcomeAudio);
      } catch (error) {
        console.log('TTS failed, using Twilio fallback');
        twiml.say(welcomeMessage);
      }
      
      // Start recording for user response
      twiml.record({
        maxLength: 30,
        timeout: 5,
        transcribe: false,
        action: '/voice/webhook',
        method: 'POST'
      });
    }
    
    // Process recording if present (user spoke)
    if (RecordingUrl) {
      const aiResponse = await processConversation(session, RecordingUrl);
      
      if (aiResponse.shouldEndCall) {
        // End conversation
        const goodbyeMessage = Conversation.getGoodbyeMessage();
        try {
          const goodbyeAudio = await TTS.generateAudio(goodbyeMessage);
          twiml.play(goodbyeAudio);
        } catch (error) {
          console.log('TTS failed, using Twilio fallback');
          twiml.say(goodbyeMessage);
        }
        twiml.hangup();
        
        // Clean up session
        await processFinalSession(session);
      } else {
        // Continue conversation
        try {
          const responseAudio = await TTS.generateAudio(aiResponse.response);
          twiml.play(responseAudio);
        } catch (error) {
          console.log('TTS failed, using Twilio fallback');
          twiml.say(aiResponse.response);
        }
        
        // Record next user response
        twiml.record({
          maxLength: 30,
          timeout: 5,
          transcribe: false,
          action: '/voice/webhook',
          method: 'POST'
        });
      }
    }
    
  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    twiml.say('Sorry, there was an error. Please try again later.');
    twiml.hangup();
  }
  
  console.log('=== SENDING RESPONSE ===');
  console.log('TwiML Length:', twiml.toString().length);
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Manual call initiation for testing
router.post('/initiate-test-call', async (req, res) => {
  const { phoneNumber } = req.body;
  
  try {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const call = await twilio.calls.create({
      url: `${process.env.BASE_URL}/voice/webhook`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    res.json({ 
      success: true, 
      callSid: call.sid,
      message: 'Test call initiated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function processConversation(session, recordingUrl) {
  console.log(`Processing conversation: ${recordingUrl}`);
  
  try {
    // Transcribe the user's speech
    const transcription = await Transcription.transcribe(recordingUrl);
    const userMessage = transcription.text;
    
    console.log(`User said: "${userMessage}"`);
    
    // Generate AI response
    const aiResponse = await Conversation.generateResponse(userMessage, session.conversationHistory);
    
    // Update conversation history
    session.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse.response }
    );
    
    console.log('Conversation exchange:', {
      user: userMessage,
      ai: aiResponse.response,
      shouldEnd: aiResponse.shouldEndCall
    });
    
    return aiResponse;
    
  } catch (error) {
    console.error('Conversation processing error:', error);
    
    // Fallback response
    return {
      response: "I'm sorry, I didn't catch that. Could you say that again?",
      shouldEndCall: false
    };
  }
}

async function processFinalSession(session) {
  console.log('\n=== CONVERSATION COMPLETED ===');
  console.log(`Call SID: ${session.callSid}`);
  console.log(`Duration: ${Date.now() - session.startTime.getTime()}ms`);
  console.log(`Conversation exchanges: ${session.conversationHistory.length / 2}`);
  
  // Log conversation history
  session.conversationHistory.forEach((message, index) => {
    const speaker = message.role === 'user' ? 'User' : 'AI';
    console.log(`${speaker}: ${message.content}`);
  });
  
  // Remove from memory
  sessions.delete(session.callSid);
}

module.exports = router;