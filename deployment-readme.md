# Voice Agent Testing System

A standalone voice survey system built with Twilio, ElevenLabs, and OpenAI.

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## Features
- 📞 Twilio voice integration
- 🎤 ElevenLabs high-quality TTS
- 🗣️ OpenAI Whisper transcription
- 🧠 GPT-4 response analysis
- 📊 Real-time survey management

## Environment Variables
Set these in Railway:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN` 
- `TWILIO_PHONE_NUMBER`
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY`

## Webhook URL
After deployment, update your Twilio phone number webhook to:
`https://your-app-name.up.railway.app/voice/webhook`
