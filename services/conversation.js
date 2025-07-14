const OpenAI = require('openai');

class ConversationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateResponse(userMessage, conversationHistory = []) {
    try {
      console.log(`Generating AI response for: "${userMessage}"`);
      
      // System prompt for the AI assistant
      const systemPrompt = `You are a friendly, professional voice assistant conducting a brief phone conversation. 

Guidelines:
- Keep responses under 30 seconds when spoken
- Be conversational and natural
- Ask engaging follow-up questions 
- Show genuine interest in the person
- Keep the conversation flowing smoothly
- If they seem done talking, politely wrap up the conversation

Your goal is to have a pleasant 2-3 minute conversation, then thank them and end the call.`;

      // Build conversation history
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.7,
        max_tokens: 150, // Keep responses concise for voice
      });

      const response = completion.choices[0].message.content;
      
      console.log('AI Response:', response);
      
      return {
        response,
        shouldEndCall: this.shouldEndConversation(response, conversationHistory)
      };
      
    } catch (error) {
      console.error('Conversation AI error:', error);
      return {
        response: "I'm sorry, I'm having trouble understanding. Could you repeat that?",
        shouldEndCall: false
      };
    }
  }

  shouldEndConversation(response, history) {
    // End conversation if:
    // 1. Too many exchanges (limit to ~5-6 back and forth)
    // 2. AI says goodbye/thank you phrases
    const exchangeCount = history.length / 2;
    const goodbyePhrases = ['thank you', 'goodbye', 'have a great', 'take care', 'end our conversation'];
    
    if (exchangeCount >= 5) return true;
    if (goodbyePhrases.some(phrase => response.toLowerCase().includes(phrase))) return true;
    
    return false;
  }

  getWelcomeMessage() {
    return "Hello! Thanks for taking my call. I'm an AI assistant and I'd love to have a quick chat with you. How are you doing today?";
  }

  getGoodbyeMessage() {
    return "Thank you so much for chatting with me! Have a wonderful day!";
  }
}

module.exports = new ConversationService();