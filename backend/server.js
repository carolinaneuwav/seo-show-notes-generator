
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
app.use(express.static(path.join(__dirname, '../frontend')));

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

  const { transcript, tone = 'casual', contentType = 'show-notes' } = req.body || {};

  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Please provide a transcript with at least 10 characters' 
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      success: false, 
      error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your Secrets.' 
    });
  }

  try {
    const trimmedTranscript = transcript.trim();
    let prompt;

    if (contentType === 'social-media') {
      prompt = `Create social media content from this transcript for English-speaking indie creators:

1. Instagram caption (150 chars) + 5 trending hashtags
2. Twitter thread (3 tweets, 280 chars each)
3. LinkedIn post (professional tone, 200 chars)
4. YouTube description (SEO optimized, 300 chars)

Tone: ${tone} | Focus: English-speaking creators
Make content engaging and shareable for indie podcasters/YouTubers.

Transcript: ${trimmedTranscript}`;
    } else {
      prompt = `You are an expert content creator specializing in SEO-optimized show notes for English-speaking indie creators.

Transform this transcript into:
1. Catchy SEO title (60 chars max)
2. Executive summary (2-3 sentences)
3. Key takeaways (3-5 bullet points)
4. Notable quotes (2-3 best quotes)
5. SEO tags (5-7 relevant keywords)
6. 3 discussion questions for audience engagement
7. Call-to-action suggestions for next episode
8. Related topic ideas for future content
9. Guest interview questions (if applicable)

Tone: ${tone} | Target: English-speaking indie podcasters
Transcript: ${trimmedTranscript}

Format the response with clear sections and make it engaging and actionable for content creators.`;
    }

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

    const generatedContent = completion.choices[0]?.message?.content || '';

    console.log('OpenAI response received');
    console.log('Tokens used:', completion?.usage?.total_tokens || 'N/A');

    // Attempt to parse into structured sections if possible
    const structuredOutput = {
      raw: generatedContent,
      sections: {}
    };

    const sectionMatches = generatedContent.match(/##\s*(.+?)\n([\s\S]*?)(?=(\n##|$))/g);
    if (sectionMatches) {
      sectionMatches.forEach(section => {
        const parts = section.split('\n');
        const title = parts[0].replace('##', '').trim();
        const body = parts.slice(1).join('\n').trim();
        structuredOutput.sections[title] = body;
      });
    }

    res.json({ 
      success: true, 
      content: structuredOutput,
      usage: completion.usage
    });

  } catch (error) {
    console.error('OpenAI API error:', error.stack || error);

    // Safer error checks
    const status = error.response?.status;

    if (status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid OpenAI API key. Please check your OPENAI_API_KEY in Secrets.' 
      });
    }

    if (status === 429) {
      // Return demo content when quota exceeded
      let demoContent = contentType === 'social-media' ? `# Social Media Content Pack\n...DEMO MODE...` : `# Enhanced Show Notes\n...DEMO MODE...`;

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

