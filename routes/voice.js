const express = require('express');
const { VoiceResponse } = require('twilio').twiml;
const TTS = require('../services/tts');
const Analysis = require('../services/analysis');
const testQuestions = require('../data/test-questions.json');

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
        currentQuestion: 0,
        responses: [],
        startTime: new Date()
      };
      sessions.set(CallSid, session);
      
      // Welcome message
      try {
        const welcomeAudio = await TTS.generateAudio(
          "Hello! Thank you for participating in our voice survey. This will take about 3 minutes."
        );
        twiml.play(welcomeAudio);
      } catch (error) {
        console.log('TTS failed, using Twilio fallback');
        twiml.say("Hello! Thank you for participating in our voice survey. This will take about 3 minutes.");
      }
      twiml.pause({ length: 1 });
    }
    
    // Process recording if present
    if (RecordingUrl) {
      await processRecording(session, RecordingUrl);
    }
    
    // Get next question
    const nextQuestion = getNextQuestion(session);
    
    if (nextQuestion) {
      // Generate audio for question
      try {
        const questionAudio = await TTS.generateAudio(nextQuestion.text);
        twiml.play(questionAudio);
      } catch (error) {
        console.log('TTS failed, using Twilio fallback');
        twiml.say(nextQuestion.text);
      }
      
      twiml.record({
        maxLength: 30,
        timeout: 5,
        transcribe: false,
        action: '/voice/webhook',
        method: 'POST'
      });
    } else {
      // End survey
      try {
        const thanksAudio = await TTS.generateAudio(
          "Thank you for completing the survey! Your responses have been recorded."
        );
        twiml.play(thanksAudio);
      } catch (error) {
        console.log('TTS failed, using Twilio fallback');
        twiml.say("Thank you for completing the survey! Your responses have been recorded.");
      }
      twiml.hangup();
      
      // Process final session
      await processFinalSession(session);
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
function getNextQuestion(session) {
  if (session.currentQuestion < testQuestions.length) {
    const question = testQuestions[session.currentQuestion];
    session.currentQuestion++;
    return question;
  }
  return null;
}

async function processRecording(session, recordingUrl) {
  console.log(`Processing recording: ${recordingUrl}`);
  
  // Skip processing if API keys not configured
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_key') {
    console.log('Skipping recording processing - OpenAI API key not configured');
    session.responses.push({
      questionIndex: session.currentQuestion - 1,
      question: testQuestions[session.currentQuestion - 1],
      recordingUrl,
      transcription: { text: '[Recording received - processing skipped]' },
      analysis: { qualityScore: 0 },
      timestamp: new Date()
    });
    return;
  }
  
  try {
    // Transcribe the recording
    const transcription = await require('../services/transcription').transcribe(recordingUrl);
    
    // Analyze with LLM
    const analysis = await Analysis.analyzeResponse(
      transcription.text,
      testQuestions[session.currentQuestion - 1]
    );
    
    // Store response
    session.responses.push({
      questionIndex: session.currentQuestion - 1,
      question: testQuestions[session.currentQuestion - 1],
      recordingUrl,
      transcription,
      analysis,
      timestamp: new Date()
    });
    
    console.log('Response processed:', {
      question: testQuestions[session.currentQuestion - 1].text,
      transcription: transcription.text,
      qualityScore: analysis.qualityScore
    });
    
  } catch (error) {
    console.error('Recording processing error:', error);
  }
}

async function processFinalSession(session) {
  console.log('\n=== SURVEY COMPLETED ===');
  console.log(`Call SID: ${session.callSid}`);
  console.log(`Duration: ${Date.now() - session.startTime.getTime()}ms`);
  console.log(`Questions: ${session.responses.length}`);
  
  session.responses.forEach((response, index) => {
    console.log(`\nQ${index + 1}: ${response.question.text}`);
    console.log(`A${index + 1}: ${response.transcription.text}`);
    console.log(`Score: ${response.analysis.qualityScore}/10`);
  });
  
  // Calculate overall session quality
  const avgQuality = session.responses.reduce((sum, r) => sum + r.analysis.qualityScore, 0) / session.responses.length;
  console.log(`\nOverall Quality: ${avgQuality.toFixed(1)}/10`);
  
  // Remove from memory
  sessions.delete(session.callSid);
}

module.exports = router;