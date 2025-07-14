const WebSocket = require('ws');
const { EventEmitter } = require('events');

class ElevenLabsVoice2Service extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.agentId = process.env.ELEVENLABS_AGENT_ID; // You'll need to set this
    this.ws = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('Connecting to ElevenLabs Voice 2.0...');
      console.log('Agent ID:', this.agentId);
      console.log('API Key length:', this.apiKey?.length);
      
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;
      console.log('WebSocket URL:', wsUrl);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      // Add timeout to detect connection issues
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('ElevenLabs connection timeout - open event never fired');
          this.ws.close();
        }
      }, 10000); // 10 second timeout

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout); // Clear timeout since we connected
        console.log('ElevenLabs Voice 2.0 connected!');
        this.isConnected = true;
        
        // Send conversation initiation message
        console.log('Sending conversation initiation...');
        const initMessage = {
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: "You are a friendly, professional voice assistant conducting brief phone conversations with callers. Keep responses under 30 seconds when spoken. Ask engaging follow-up questions and show genuine interest in the person."
              },
              first_message: "Hello! Thanks for calling. I'm an AI assistant and I'd love to have a quick chat with you. How are you doing today?",
              language: "en"
            }
          },
          custom_llm_extra_body: {},
          dynamic_variables: {}
        };
        
        console.log('Initiation message:', JSON.stringify(initMessage, null, 2));
        this.ws.send(JSON.stringify(initMessage));
        
        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing ElevenLabs message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log('ElevenLabs connection closed:', code, reason.toString());
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error) => {
        console.error('=== ELEVENLABS WEBSOCKET ERROR ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to connect to ElevenLabs:', error);
      throw error;
    }
  }

  handleMessage(message) {
    console.log('ElevenLabs message type:', message.type);
    
    switch (message.type) {
      case 'conversation_initiation_metadata':
        console.log('Conversation initiated:', message);
        this.emit('conversation_started', message);
        break;
        
      case 'audio':
        // Received AI speech audio chunk
        console.log('Received audio chunk');
        this.emit('audio_chunk', {
          audio: message.audio_event.audio_base_64,
          eventId: message.audio_event.event_id
        });
        break;
        
      case 'user_transcript':
        // User speech was transcribed
        console.log('User transcript:', message.user_transcription_event.user_transcript);
        this.emit('user_transcript', message.user_transcription_event);
        break;
        
      case 'agent_response':
        // AI agent text response
        console.log('Agent response:', message.agent_response_event.agent_response);
        this.emit('agent_response', message.agent_response_event);
        break;
        
      case 'ping':
        // Send pong response
        this.sendPong();
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  sendAudio(audioBase64) {
    if (!this.isConnected || !this.ws) {
      console.error('Not connected to ElevenLabs');
      return;
    }

    // Twilio sends PCM 8kHz, ElevenLabs expects PCM 16kHz
    // ElevenLabs should handle the sample rate conversion automatically
    const message = {
      type: "user_audio_chunk",
      user_audio_chunk: {
        chunk: audioBase64
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  sendPong() {
    if (!this.isConnected || !this.ws) return;
    
    const pongMessage = {
      type: 'pong'
    };
    
    this.ws.send(JSON.stringify(pongMessage));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(this.apiKey && this.agentId && 
              this.apiKey !== 'your_elevenlabs_key' && 
              this.agentId !== 'your_agent_id');
  }
}

module.exports = ElevenLabsVoice2Service;