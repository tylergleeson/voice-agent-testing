const WebSocket = require('ws');
const { EventEmitter } = require('events');

class TwilioMediaStreamService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // Track active connections by call SID
  }

  handleConnection(ws, req) {
    console.log('New Twilio Media Stream connection');
    
    let callSid = null;
    let streamSid = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleTwilioMessage(ws, data);
        
        // Store connection info
        if (data.event === 'start') {
          callSid = data.start.callSid;
          streamSid = data.start.streamSid;
          this.connections.set(callSid, { ws, streamSid });
          console.log(`Media stream started for call: ${callSid}`);
        }
        
      } catch (error) {
        console.error('Error parsing Twilio message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Twilio Media Stream disconnected');
      if (callSid) {
        this.connections.delete(callSid);
        this.emit('call_ended', callSid);
      }
    });

    ws.on('error', (error) => {
      console.error('Twilio Media Stream error:', error);
    });
  }

  handleTwilioMessage(ws, data) {
    switch (data.event) {
      case 'connected':
        console.log('Twilio Media Stream connected');
        this.emit('connected', ws);
        break;
        
      case 'start':
        console.log('Media stream started:', data.start);
        this.emit('stream_started', {
          callSid: data.start.callSid,
          streamSid: data.start.streamSid,
          ws: ws
        });
        break;
        
      case 'media':
        // Incoming audio from caller
        const audioPayload = data.media.payload;
        this.emit('audio_received', {
          callSid: data.start?.callSid,
          audio: audioPayload,
          ws: ws
        });
        break;
        
      case 'stop':
        console.log('Media stream stopped');
        this.emit('stream_stopped', data.stop);
        break;
        
      default:
        console.log('Unknown Twilio event:', data.event);
    }
  }

  // Send audio back to Twilio (to caller)
  sendAudio(callSid, audioBase64) {
    const connection = this.connections.get(callSid);
    if (!connection) {
      console.error(`No connection found for call: ${callSid}`);
      return;
    }

    const message = {
      event: 'media',
      streamSid: connection.streamSid,
      media: {
        payload: audioBase64
      }
    };

    connection.ws.send(JSON.stringify(message));
  }

  // Send clear audio buffer
  sendClear(callSid) {
    const connection = this.connections.get(callSid);
    if (!connection) return;

    const message = {
      event: 'clear',
      streamSid: connection.streamSid
    };

    connection.ws.send(JSON.stringify(message));
  }
}

module.exports = new TwilioMediaStreamService();