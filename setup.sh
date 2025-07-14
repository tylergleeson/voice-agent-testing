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