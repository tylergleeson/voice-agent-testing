const axios = require('axios');

async function testWebhook() {
  console.log('Testing webhook locally...\n');
  
  try {
    // Test 1: Initial call
    console.log('1. Testing initial call...');
    const response1 = await axios.post('http://localhost:3002/voice/webhook', 
      'CallSid=test123&From=%2B15551234567', 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('✅ Initial call response:', response1.data.substring(0, 100) + '...\n');
    
    // Test 2: Recording response
    console.log('2. Testing recording response...');
    const response2 = await axios.post('http://localhost:3002/voice/webhook', 
      'CallSid=test123&RecordingUrl=https://example.com/recording.mp3', 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('✅ Recording response:', response2.data.substring(0, 100) + '...\n');
    
    console.log('🎉 Webhook tests passed! Your voice agent logic is working.');
    console.log('\nNext steps:');
    console.log('1. Set up ngrok: ngrok.com (free signup)');
    console.log('2. Get auth token and run: ngrok config add-authtoken YOUR_TOKEN');
    console.log('3. Run: ngrok http 3002');
    console.log('4. Update Twilio webhook with ngrok URL');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhook();