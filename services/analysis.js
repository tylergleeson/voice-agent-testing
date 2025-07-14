const OpenAI = require('openai');

class AnalysisService {
  constructor() {
    this.openai = null;
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async analyzeResponse(responseText, question) {
    try {
      // If OpenAI is not configured, return fallback immediately
      if (!this.openai) {
        console.log('OpenAI not configured, using fallback analysis');
        return {
          qualityScore: 5,
          wordCount: responseText.split(' ').length,
          sentiment: 'neutral',
          emotion: 'neutral',
          specificity: 5,
          relevance: 5,
          insights: ['Response recorded'],
          summary: 'Basic response provided',
          note: 'OpenAI analysis not available'
        };
      }
      const prompt = `
Analyze this survey response for quality and insights:

Question: "${question.text}"
Response: "${responseText}"

Provide analysis in this exact JSON format:
{
  "qualityScore": [1-10 integer],
  "wordCount": [number of words],
  "sentiment": "positive|neutral|negative",
  "emotion": "excited|satisfied|concerned|neutral|frustrated",
  "specificity": [1-10 integer, how specific/detailed],
  "relevance": [1-10 integer, how relevant to question],
  "insights": ["key insight 1", "key insight 2"],
  "summary": "brief 1-sentence summary"
}

Rate based on:
- Length and detail (more words = higher score)
- Specificity (examples, details = higher score) 
- Emotional expression (shows engagement)
- Direct relevance to the question asked
`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      // Add computed metrics
      analysis.timestamp = new Date();
      analysis.processingTime = Date.now();
      
      console.log('LLM Analysis:', {
        question: question.text.substring(0, 50) + '...',
        response: responseText.substring(0, 100) + '...',
        score: analysis.qualityScore,
        sentiment: analysis.sentiment
      });
      
      return analysis;
      
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Fallback analysis
      return {
        qualityScore: 5,
        wordCount: responseText.split(' ').length,
        sentiment: 'neutral',
        emotion: 'neutral',
        specificity: 5,
        relevance: 5,
        insights: ['Response recorded'],
        summary: 'Basic response provided',
        error: 'LLM analysis failed'
      };
    }
  }
}

module.exports = new AnalysisService();