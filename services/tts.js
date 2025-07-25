const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TTSService {
  constructor() {
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }
  
  get apiKey() {
    return process.env.ELEVENLABS_API_KEY;
  }
  
  get voiceId() {
    return process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  }

  async generateAudio(text) {
    try {
      console.log(`Generating audio for: "${text}"`);
      console.log('ElevenLabs config check:', {
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey?.length,
        hasVoiceId: !!this.voiceId,
        voiceId: this.voiceId
      });
      
      // Check if ElevenLabs is configured
      if (!this.apiKey || this.apiKey === 'your_elevenlabs_key') {
        console.log('ElevenLabs not configured, throwing error for fallback');
        throw new Error('ElevenLabs API key not configured');
      }
      
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
      const baseUrl = process.env.BASE_URL || 'https://voice-agent-testing-production.up.railway.app';
      const audioUrl = `${baseUrl}/audio/${filename}`;
      console.log(`Audio generated: ${audioUrl}`);
      
      return audioUrl;
    } catch (error) {
      console.error('TTS Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? Buffer.from(error.response.data).toString() : error.message
      });
      throw error;
    }
  }

  // Fallback to Twilio TTS if ElevenLabs fails
  generateTwilioTTS(text) {
    return `<Say voice="Polly.Joanna">${text}</Say>`;
  }
}

module.exports = new TTSService();