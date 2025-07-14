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

// Sessions endpoint (placeholder for now)
router.get('/sessions', (req, res) => {
  // In a real implementation, you'd retrieve from database
  res.json([]);
});

module.exports = router;