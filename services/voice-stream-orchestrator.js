const ElevenLabsVoice2Service = require('./elevenlabs-voice2');
const TwilioMediaStreamService = require('./twilio-media-stream');

class VoiceStreamOrchestrator {
  constructor() {
    this.activeConversations = new Map(); // callSid -> { elevenlabs, twilioWs }
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    console.log('Setting up Voice Stream Orchestrator event handlers...');
    
    // Handle Twilio Media Stream events
    TwilioMediaStreamService.on('stream_started', (streamData) => {
      console.log('Orchestrator received stream_started event');
      this.startConversation(streamData);
    });

    TwilioMediaStreamService.on('audio_received', (audioData) => {
      this.forwardToElevenLabs(audioData);
    });

    TwilioMediaStreamService.on('call_ended', (callSid) => {
      console.log('Orchestrator received call_ended event');
      this.endConversation(callSid);
    });
    
    console.log('Event handlers setup complete');
  }

  async startConversation(streamData) {
    const { callSid, ws } = streamData;
    
    try {
      console.log(`Starting Voice 2.0 conversation for call: ${callSid}`);
      
      // Create new ElevenLabs connection for this call
      const elevenlabs = new ElevenLabsVoice2Service();
      
      // Set up ElevenLabs event handlers for this conversation
      elevenlabs.on('connected', () => {
        console.log(`ElevenLabs connected for call: ${callSid}`);
      });

      elevenlabs.on('audio_chunk', (audioData) => {
        // Forward AI speech to Twilio (caller hears AI)
        this.forwardToTwilio(callSid, audioData.audio);
      });

      elevenlabs.on('user_transcript', (transcript) => {
        console.log(`User said: "${transcript.user_transcript}"`);
      });

      elevenlabs.on('agent_response', (response) => {
        console.log(`AI responded: "${response.agent_response}"`);
      });

      elevenlabs.on('error', (error) => {
        console.error(`ElevenLabs error for call ${callSid}:`, error);
        this.endConversation(callSid);
      });

      // Connect to ElevenLabs
      await elevenlabs.connect();
      
      // Store the conversation
      this.activeConversations.set(callSid, {
        elevenlabs,
        twilioWs: ws,
        startTime: new Date()
      });
      
    } catch (error) {
      console.error(`Failed to start conversation for call ${callSid}:`, error);
    }
  }

  forwardToElevenLabs(audioData) {
    const conversation = this.activeConversations.get(audioData.callSid);
    if (!conversation) {
      console.log(`Not connected to ElevenLabs`);
      return;
    }

    // Forward caller audio to ElevenLabs
    conversation.elevenlabs.sendAudio(audioData.audio);
  }

  forwardToTwilio(callSid, audioBase64) {
    const conversation = this.activeConversations.get(callSid);
    if (!conversation) {
      console.error(`No active conversation for call: ${callSid}`);
      return;
    }

    // Forward AI audio to Twilio (caller)
    TwilioMediaStreamService.sendAudio(callSid, audioBase64);
  }

  endConversation(callSid) {
    const conversation = this.activeConversations.get(callSid);
    if (!conversation) return;

    console.log(`Ending conversation for call: ${callSid}`);
    
    // Calculate duration
    const duration = Date.now() - conversation.startTime.getTime();
    console.log(`Conversation duration: ${duration}ms`);

    // Disconnect ElevenLabs
    conversation.elevenlabs.disconnect();
    
    // Remove from active conversations
    this.activeConversations.delete(callSid);
  }

  // Get conversation stats
  getStats() {
    return {
      activeConversations: this.activeConversations.size,
      conversations: Array.from(this.activeConversations.keys())
    };
  }
}

module.exports = new VoiceStreamOrchestrator();