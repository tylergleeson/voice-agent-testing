# Voice Agent Testing System

A standalone system for testing voice survey interactions using Twilio, ElevenLabs, and LLM integration.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env` and fill in your API keys:
   ```bash
   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone
   
   # ElevenLabs Configuration
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_key
   ```

3. **Run setup (includes ngrok tunnel):**
   ```bash
   npm run setup
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Visit the test dashboard:**
   Go to `http://localhost:3000/test/dashboard`

## Features

- **Voice Surveys**: Automated phone-based surveys with ElevenLabs TTS
- **Speech Recognition**: OpenAI Whisper transcription
- **LLM Analysis**: GPT-4 powered response quality scoring
- **Test Dashboard**: Web interface for testing and monitoring
- **Session Management**: Track survey progress and responses

## Project Structure

```
voice-agent-test/
├── server.js              # Main Express server
├── config/                 # Configuration files
├── routes/
│   ├── voice.js           # Voice webhook handlers
│   └── test.js            # Testing endpoints
├── services/
│   ├── tts.js             # Text-to-speech service
│   ├── transcription.js   # Speech-to-text service
│   └── analysis.js        # LLM response analysis
├── data/
│   └── test-questions.json # Sample survey questions
└── audio/                 # Generated audio files
```

## API Endpoints

- `POST /voice/webhook` - Twilio voice webhook
- `POST /voice/initiate-test-call` - Start test call
- `GET /test/dashboard` - Test dashboard UI
- `GET /test/status` - System status check

## Testing Workflow

1. Configure API keys in `.env`
2. Run `npm run setup` to start ngrok tunnel
3. Update Twilio webhook URL with ngrok URL
4. Use dashboard to initiate test calls
5. Monitor console for session logs and analysis

## Success Criteria

- [ ] Call connects and plays ElevenLabs audio
- [ ] User responses are recorded and transcribed
- [ ] LLM provides quality scores 7+ for good responses
- [ ] Complete 3-question survey in under 5 minutes
- [ ] 90%+ transcription accuracy