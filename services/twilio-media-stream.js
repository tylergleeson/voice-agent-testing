const WebSocket = require('ws');
const { EventEmitter } = require('events');

class TwilioMediaStreamService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // Track active connections by call SID
  }

  handleConnection(ws, req) {
    console.log('=== NEW TWILIO MEDIA STREAM CONNECTION ===');
    
    let connectionInfo = {
      callSid: null,
      streamSid: null,
      hasEmittedStart: false
    };

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Store connection info from start event FIRST
        if (data.event === 'start') {
          connectionInfo.callSid = data.start.callSid;
          connectionInfo.streamSid = data.start.streamSid;
          this.connections.set(connectionInfo.callSid, { ws, streamSid: connectionInfo.streamSid });
          console.log(`[Twilio] Stored connection info for call: ${connectionInfo.callSid}`);
        }
        
        // Then handle the message (which will emit events)
        this.handleTwilioMessage(ws, data, connectionInfo);
        
      } catch (error) {
        console.error('Error parsing Twilio message:', error);
        console.error('Raw message:', message.toString());
      }
    });

    ws.on('close', () => {
      console.log('Twilio Media Stream disconnected');
      if (connectionInfo.callSid) {
        this.connections.delete(connectionInfo.callSid);
        this.emit('call_ended', connectionInfo.callSid);
      }
    });

    ws.on('error', (error) => {
      console.error('Twilio Media Stream error:', error);
    });
  }

  handleTwilioMessage(ws, data, connectionInfo) {
    console.log(`[Twilio Event] ${data.event} (hasEmittedStart: ${connectionInfo.hasEmittedStart})`);
    
    switch (data.event) {
      case 'connected':
        console.log('[Twilio] WebSocket connected successfully');
        this.emit('connected', ws);
        break;
        
      case 'start':
        console.log('[Twilio] Media stream started');
        console.log(`[Twilio] CallSid: ${data.start.callSid}`);
        console.log(`[Twilio] Emitting stream_started event`);
        this.emit('stream_started', {
          callSid: data.start.callSid,
          streamSid: data.start.streamSid,
          ws: ws
        });
        break;
        
      case 'media':
        // Incoming audio from caller
        const audioPayload = data.media.payload;
        
        // If we're getting media but haven't started yet, create synthetic start
        if (!connectionInfo.hasEmittedStart) {
          console.log('*** [Twilio] CREATING SYNTHETIC START EVENT ***');
          
          // Use timestamp for unique IDs
          const timestamp = Date.now();
          connectionInfo.streamSid = `SYN${timestamp}`;
          connectionInfo.callSid = `CALL${timestamp}`;
          connectionInfo.hasEmittedStart = true;
          
          console.log(`[Twilio] Synthetic CallSid: ${connectionInfo.callSid}`);
          console.log(`[Twilio] Synthetic StreamSid: ${connectionInfo.streamSid}`);
          
          // Store connection
          this.connections.set(connectionInfo.callSid, { 
            ws, 
            streamSid: connectionInfo.streamSid 
          });
          
          // Emit synthetic start event
          console.log('[Twilio] Emitting synthetic stream_started event');
          this.emit('stream_started', {
            callSid: connectionInfo.callSid,
            streamSid: connectionInfo.streamSid,
            ws: ws
          });
        }
        
        // Use the connection info
        if (connectionInfo && connectionInfo.callSid) {
          this.emit('audio_received', {
            callSid: connectionInfo.callSid,
            audio: audioPayload,
            ws: ws
          });
        } else {
          console.log('[Twilio] Skipping audio - no callSid yet');
        }
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