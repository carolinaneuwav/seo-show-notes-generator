
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
      // Return demo content when quota exceeded
      const demoContent = `# SEO-Optimized Show Notes

## Title: 
Building Your First Online Business: 3 Creator Strategies That Actually Work

## Summary:
This episode dives into practical monetization strategies for creators, emphasizing the importance of focusing on one revenue stream and starting small to build sustainable income.

## Key Points:
• Focus on mastering one revenue stream before expanding
• Start small and scale gradually to avoid overwhelm
• Many creators fail by trying to do everything at once
• Three proven strategies work for any creator niche
• Building from zero to first $1000 requires focused approach

## Timestamps:
• 00:00 - Introduction to creator monetization challenges
• 02:30 - The biggest mistake creators make
• 05:15 - Strategy 1: Single revenue stream focus
• 08:45 - Strategy 2: Start small and iterate
• 12:20 - Strategy 3: Niche-agnostic approach

## SEO Tags:
online business, creator economy, monetization strategies, first revenue stream, indie creators, content creator tips, online income, creator business model

## Social Media Snippets:
• "The biggest mistake creators make? Trying to do everything at once instead of mastering one thing first 💡"
• "Focus on one revenue stream. Master it. Then expand. That's how you go from $0 to $1000+ 🚀"
• "Three strategies that work for ANY creator, regardless of niche 📈"

---
*⚠️ DEMO MODE: OpenAI quota exceeded. Add billing to your account for real AI generation.*`;

      return res.json({ 
        success: true, 
        content: demoContent,
        usage: { total_tokens: 250 },
        demo_mode: true
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
