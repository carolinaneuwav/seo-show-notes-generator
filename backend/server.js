
const express = require('express');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

// Initialize OpenAI with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ 
    success: true, 
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY
  });
});

// Real OpenAI endpoint
app.post('/api/generate', async (req, res) => {
  console.log('Generate endpoint hit!');
  console.log('Request body:', req.body);

  const { transcript, tone = 'casual' } = req.body;

  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Please provide a transcript' 
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      success: false, 
      error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your Secrets.' 
    });
  }

  try {
    const prompt = `Create SEO-optimized show notes for this podcast/video transcript. Use a ${tone} tone.

Transcript:
${transcript}

Please format the response as:
# SEO-Optimized Show Notes

## Title: 
[Create an engaging, SEO-friendly title]

## Summary:
[2-3 sentence summary of the main topic]

## Key Points:
[3-5 bullet points of main takeaways]

## Timestamps: (if applicable)
[Key moments with rough timestamps]

## SEO Tags:
[Relevant keywords and tags for discoverability]

## Social Media Snippets:
[2-3 short, shareable quotes or insights]

Make it engaging and optimized for search engines while maintaining the ${tone} tone.`;

    console.log('Calling OpenAI API...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert content creator and SEO specialist who creates engaging, well-structured show notes that help content rank well in search engines."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const generatedContent = completion.choices[0].message.content;
    
    console.log('OpenAI response received');
    console.log('Tokens used:', completion.usage.total_tokens);

    res.json({ 
      success: true, 
      content: generatedContent,
      usage: completion.usage
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid OpenAI API key. Please check your OPENAI_API_KEY in Secrets.' 
      });
    }
    
    if (error.code === 'insufficient_quota') {
      return res.status(429).json({ 
        success: false, 
        error: 'OpenAI quota exceeded. Please check your OpenAI account billing.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate content: ' + error.message 
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Open your app at: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
