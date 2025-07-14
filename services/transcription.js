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