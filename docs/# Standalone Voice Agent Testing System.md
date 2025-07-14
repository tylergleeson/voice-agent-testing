# Standalone Voice Agent Testing System
## Twilio + ElevenLabs + LLM Integration

### Overview
A minimal, isolated system to test voice survey interactions before integrating into your main Survey Gig app. This lets you perfect the voice flow, test quality, and validate the user experience.

---

## Phase 1: Basic Setup & Dependencies (Day 1)

### 1.1 Project Structure
```
voice-agent-test/
├── server.js              # Main Express server
├── config/
│   ├── twilio.js          # Twilio configuration
│   ├── elevenlabs.js      # ElevenLabs configuration
│   └── openai.js          # OpenAI/LLM configuration
├── routes/
│   ├── voice.js           # Voice webhook handlers
│   └── test.js            # Testing endpoints
├── services/
│   ├── tts.js             # Text-to-speech service
│   ├── transcription.js   # Speech-to-text service
│   └── analysis.js        # LLM response analysis
├── data/
│   └── test-questions.json # Sample survey questions
├── audio/                 # Generated audio files
├── recordings/            # User recordings
└── .env                   # Environment variables
```

### 1.2 Essential Dependencies
```json
{
  "name": "voice-agent-test",
  "dependencies": {
    "express": "^4.18.2",
    "twilio": "^4.19.0",
    "axios": "^1.6.0",
    "openai": "^4.24.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "uuid": "^9.0.1"
  }
}
```

### 1.3 Environment Configuration
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Rachel voice

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# Server Configuration
PORT=3000
BASE_URL=https://your-ngrok-url.ngrok.io  # For local testing
```

---

## Phase 2: Core Voice Agent Implementation (Day 2-3)

### 2.1 Basic Express Server Setup
```javascript
// server.js
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.BASE_URL}/voice/webhook`);
});
```

### 2.2 Twilio Voice Webhook Handler
```javascript
// routes/voice.js
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
  console.log('Webhook received:', req.body);
  
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
      const welcomeAudio = await TTS.generateAudio(
        "Hello! Thank you for participating in our voice survey. This will take about 3 minutes."
      );
      twiml.play(welcomeAudio);
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
      const questionAudio = await TTS.generateAudio(nextQuestion.text);
      
      twiml.play(questionAudio);
      twiml.record({
        maxLength: 30,
        timeout: 5,
        transcribe: false,
        action: '/voice/webhook',
        method: 'POST'
      });
    } else {
      // End survey
      const thanksAudio = await TTS.generateAudio(
        "Thank you for completing the survey! Your responses have been recorded."
      );
      twiml.play(thanksAudio);
      twiml.hangup();
      
      // Process final session
      await processFinalSession(session);
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    twiml.say('Sorry, there was an error. Please try again later.');
    twiml.hangup();
  }
  
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
```

### 2.3 Test Questions Data
```json
[
  {
    "id": 1,
    "text": "What is your favorite type of cuisine and why?",
    "category": "lifestyle",
    "expectedDuration": 15
  },
  {
    "id": 2,
    "text": "How do you typically spend your weekends?",
    "category": "lifestyle", 
    "expectedDuration": 20
  },
  {
    "id": 3,
    "text": "What factors are most important to you when making a purchase decision?",
    "category": "consumer",
    "expectedDuration": 25
  }
]
```

---

## Phase 3: ElevenLabs Integration (Day 3-4)

### 3.1 Text-to-Speech Service
```javascript
// services/tts.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TTSService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  async generateAudio(text) {
    try {
      console.log(`Generating audio for: "${text}"`);
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        data: {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        },
        responseType: 'arraybuffer'
      });

      // Save audio file
      const filename = `${uuidv4()}.mp3`;
      const filepath = path.join(__dirname, '../audio', filename);
      
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
      }
      
      fs.writeFileSync(filepath, response.data);
      
      // Return URL accessible by Twilio
      const audioUrl = `${process.env.BASE_URL}/audio/${filename}`;
      console.log(`Audio generated: ${audioUrl}`);
      
      return audioUrl;
    } catch (error) {
      console.error('TTS Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Fallback to Twilio TTS if ElevenLabs fails
  generateTwilioTTS(text) {
    return `<Say voice="Polly.Joanna">${text}</Say>`;
  }
}

module.exports = new TTSService();
```

### 3.2 Speech-to-Text Service
```javascript
// services/transcription.js
const axios = require('axios');

class TranscriptionService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  async transcribe(audioUrl) {
    try {
      console.log(`Transcribing audio: ${audioUrl}`);
      
      // Download audio file
      const audioResponse = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'arraybuffer'
      });

      // Use OpenAI Whisper as primary transcription
      const openai = require('openai');
      const client = new openai({ apiKey: process.env.OPENAI_API_KEY });
      
      // Create temp file for Whisper
      const fs = require('fs');
      const path = require('path');
      const tempFile = path.join(__dirname, '../temp_audio.wav');
      fs.writeFileSync(tempFile, audioResponse.data);
      
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        response_format: 'json',
        temperature: 0.0
      });
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      return {
        text: transcription.text,
        confidence: 0.9, // Whisper doesn't provide confidence, assume high
        service: 'whisper'
      };
      
    } catch (error) {
      console.error('Transcription error:', error);
      
      // Fallback to basic transcription
      return {
        text: "[Transcription failed - manual review needed]",
        confidence: 0.0,
        service: 'fallback'
      };
    }
  }
}

module.exports = new TranscriptionService();
```

---

## Phase 4: LLM Analysis Integration (Day 4-5)

### 4.1 Response Analysis Service
```javascript
// services/analysis.js
const OpenAI = require('openai');

class AnalysisService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyzeResponse(responseText, question) {
    try {
      const prompt = `
Analyze this survey response for quality and insights:

Question: "${question.text}"
Response: "${responseText}"

Provide analysis in this exact JSON format:
{
  "qualityScore": [1-10 integer],
  "wordCount": [number of words],
  "sentiment": "positive|neutral|negative",
  "emotion": "excited|satisfied|concerned|neutral|frustrated",
  "specificity": [1-10 integer, how specific/detailed],
  "relevance": [1-10 integer, how relevant to question],
  "insights": ["key insight 1", "key insight 2"],
  "summary": "brief 1-sentence summary"
}

Rate based on:
- Length and detail (more words = higher score)
- Specificity (examples, details = higher score) 
- Emotional expression (shows engagement)
- Direct relevance to the question asked
`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      // Add computed metrics
      analysis.timestamp = new Date();
      analysis.processingTime = Date.now();
      
      console.log('LLM Analysis:', {
        question: question.text.substring(0, 50) + '...',
        response: responseText.substring(0, 100) + '...',
        score: analysis.qualityScore,
        sentiment: analysis.sentiment
      });
      
      return analysis;
      
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Fallback analysis
      return {
        qualityScore: 5,
        wordCount: responseText.split(' ').length,
        sentiment: 'neutral',
        emotion: 'neutral',
        specificity: 5,
        relevance: 5,
        insights: ['Response recorded'],
        summary: 'Basic response provided',
        error: 'LLM analysis failed'
      };
    }
  }
}

module.exports = new AnalysisService();
```

---

## Phase 5: Testing Interface (Day 5-6)

### 5.1 Simple Test Dashboard
```javascript
// routes/test.js
const express = require('express');
const router = express.Router();

// Test dashboard HTML
router.get('/dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Voice Agent Test Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .card { border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        input { padding: 8px; margin: 5px; width: 200px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>Voice Agent Test Dashboard</h1>
    
    <div class="card">
        <h3>Initiate Test Call</h3>
        <input type="tel" id="phoneNumber" placeholder="+1234567890" />
        <button onclick="initiateCall()">Start Test Call</button>
        <div id="callStatus"></div>
    </div>
    
    <div class="card">
        <h3>System Status</h3>
        <button onclick="checkStatus()">Check Status</button>
        <div id="systemStatus"></div>
    </div>
    
    <div class="card">
        <h3>Recent Sessions</h3>
        <button onclick="loadSessions()">Load Recent Sessions</button>
        <div id="sessionsData"></div>
    </div>

    <script>
        async function initiateCall() {
            const phone = document.getElementById('phoneNumber').value;
            const statusDiv = document.getElementById('callStatus');
            
            if (!phone) {
                statusDiv.innerHTML = '<div class="status error">Please enter phone number</div>';
                return;
            }
            
            try {
                const response = await fetch('/voice/initiate-test-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    statusDiv.innerHTML = \`<div class="status success">Call initiated! SID: \${result.callSid}</div>\`;
                } else {
                    statusDiv.innerHTML = \`<div class="status error">Error: \${result.error}</div>\`;
                }
            } catch (error) {
                statusDiv.innerHTML = \`<div class="status error">Error: \${error.message}</div>\`;
            }
        }
        
        async function checkStatus() {
            const statusDiv = document.getElementById('systemStatus');
            
            try {
                const response = await fetch('/test/status');
                const status = await response.json();
                
                statusDiv.innerHTML = \`
                    <div class="status success">
                        <strong>Server:</strong> \${status.server}<br>
                        <strong>Twilio:</strong> \${status.twilio}<br>
                        <strong>ElevenLabs:</strong> \${status.elevenlabs}<br>
                        <strong>OpenAI:</strong> \${status.openai}
                    </div>
                \`;
            } catch (error) {
                statusDiv.innerHTML = \`<div class="status error">Status check failed</div>\`;
            }
        }
        
        async function loadSessions() {
            const sessionsDiv = document.getElementById('sessionsData');
            
            try {
                const response = await fetch('/test/sessions');
                const sessions = await response.json();
                
                let html = '<h4>Recent Test Sessions:</h4>';
                sessions.forEach(session => {
                    html += \`
                        <div style="border: 1px solid #eee; padding: 10px; margin: 5px 0;">
                            <strong>Call:</strong> \${session.callSid}<br>
                            <strong>Time:</strong> \${new Date(session.startTime).toLocaleString()}<br>
                            <strong>Responses:</strong> \${session.responses.length}<br>
                            <strong>Avg Quality:</strong> \${session.avgQuality}/10
                        </div>
                    \`;
                });
                
                sessionsDiv.innerHTML = html;
            } catch (error) {
                sessionsDiv.innerHTML = '<div class="status error">Failed to load sessions</div>';
            }
        }
    </script>
</body>
</html>
  `);
});

// Status check endpoint
router.get('/status', async (req, res) => {
  const status = {
    server: 'Running',
    twilio: 'Unknown',
    elevenlabs: 'Unknown',
    openai: 'Unknown'
  };
  
  // Test Twilio
  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    status.twilio = 'Connected';
  } catch (error) {
    status.twilio = 'Error';
  }
  
  // Test ElevenLabs
  try {
    const axios = require('axios');
    await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    status.elevenlabs = 'Connected';
  } catch (error) {
    status.elevenlabs = 'Error';
  }
  
  // Test OpenAI
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await openai.models.list();
    status.openai = 'Connected';
  } catch (error) {
    status.openai = 'Error';
  }
  
  res.json(status);
});

module.exports = router;
```

---

## Phase 6: Local Development Setup (Day 6)

### 6.1 Setup Script
```bash
#!/bin/bash
# setup.sh

echo "Setting up Voice Agent Test Environment..."

# Install dependencies
npm install

# Create required directories
mkdir -p audio recordings temp

# Set up ngrok for webhook testing
echo "Installing ngrok..."
npm install -g ngrok

# Start ngrok tunnel
echo "Starting ngrok tunnel..."
ngrok http 3000 &

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io')
echo "Ngrok URL: $NGROK_URL"

# Update .env with ngrok URL
sed -i "s|BASE_URL=.*|BASE_URL=$NGROK_URL|" .env

echo "Setup complete!"
echo "1. Update your Twilio webhook URL to: $NGROK_URL/voice/webhook"
echo "2. Start the server with: npm start"
echo "3. Visit test dashboard at: $NGROK_URL/test/dashboard"
```

### 6.2 Package.json Scripts
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup": "bash setup.sh",
    "test-call": "node scripts/test-call.js"
  }
}
```

---

## Testing Workflow

### Day 1: Basic Setup
1. ✅ Create project structure
2. ✅ Install dependencies
3. ✅ Configure environment variables
4. ✅ Set up ngrok tunnel

### Day 2: Voice Flow
1. ✅ Implement Twilio webhook
2. ✅ Test basic call flow
3. ✅ Verify recording capture
4. ✅ Test call termination

### Day 3: ElevenLabs Integration
1. ✅ Implement TTS service
2. ✅ Test audio generation
3. ✅ Implement STT service
4. ✅ Test transcription accuracy

### Day 4: LLM Analysis
1. ✅ Implement response analysis
2. ✅ Test quality scoring
3. ✅ Verify insight extraction
4. ✅ Test error handling

### Day 5: End-to-End Testing
1. ✅ Complete survey flow test
2. ✅ Multi-question surveys
3. ✅ Quality validation
4. ✅ Performance testing

### Day 6: Optimization
1. ✅ Audio caching
2. ✅ Error recovery
3. ✅ Monitoring setup
4. ✅ Documentation

## Success Criteria

**Technical Validation:**
- [ ] Call connects and plays ElevenLabs audio
- [ ] User responses are recorded and transcribed  
- [ ] LLM provides quality scores 7+ for good responses
- [ ] Complete 3-question survey in under 5 minutes
- [ ] 90%+ transcription accuracy

**User Experience Validation:**
- [ ] Voice sounds natural and professional
- [ ] Questions are clear and well-paced
- [ ] Recording prompts work reliably
- [ ] Graceful error handling
- [ ] Smooth conversation flow

Once this standalone system is working perfectly, you'll have confidence in the voice agent before integrating it into your main Survey Gig application!