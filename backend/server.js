
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

  const { transcript, tone = 'casual', contentType = 'show-notes' } = req.body;

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
    let prompt;
    
    if (contentType === 'social-media') {
      prompt = `Create social media content from this transcript for English-speaking indie creators:

1. Instagram caption (150 chars) + 5 trending hashtags
2. Twitter thread (3 tweets, 280 chars each)
3. LinkedIn post (professional tone, 200 chars)
4. YouTube description (SEO optimized, 300 chars)

Tone: ${tone} | Focus: English-speaking creators
Make content engaging and shareable for indie podcasters/YouTubers.

Transcript: ${transcript}`;
    } else {
      // Enhanced show notes prompt
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
Transcript: ${transcript}

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
      let demoContent;
      
      if (contentType === 'social-media') {
        demoContent = `# Social Media Content Pack

## Instagram Caption:
"3 strategies every creator needs to know! 💪 Building from zero to $1000 requires focus, not complexity. Start with ONE revenue stream first! 🚀"

**Hashtags:** #creatoreconomy #onlinebusiness #contentcreator #entrepreneurship #sidehustle

## Twitter Thread:
🧵 1/3: The biggest mistake creators make? Trying everything at once instead of mastering ONE thing first. Focus beats overwhelm every time.

2/3: Three strategies that work for ANY creator: 1) Pick one revenue stream 2) Start small and iterate 3) Build from zero to $1000 with intention

3/3: Success isn't about doing more—it's about doing the RIGHT things consistently. What's your first revenue stream? 👇

## LinkedIn Post:
"Many creators fail because they spread themselves too thin. The key to sustainable income? Master one revenue stream first, then expand strategically."

## YouTube Description:
Learn 3 proven monetization strategies for creators. This episode covers practical steps to go from zero to your first $1000 in revenue by focusing on one stream.

---
*⚠️ DEMO MODE: Add billing for real AI generation.*`;
      } else {
        demoContent = `# Enhanced Show Notes

## SEO Title (60 chars):
Building Your First Online Business: 3 Creator Strategies

## Executive Summary:
This episode dives into practical monetization strategies for creators, emphasizing the importance of focusing on one revenue stream first. Learn three proven approaches that work regardless of your niche.

## Key Takeaways:
• Focus on mastering one revenue stream before expanding
• Start small and scale gradually to avoid overwhelm  
• Many creators fail by trying to do everything at once
• Three strategies work for any creator niche
• Building from zero to first $1000 requires focused approach

## Notable Quotes:
• "The biggest mistake I see is trying to do everything at once instead of mastering one thing first"
• "I've helped hundreds of creators go from zero to their first thousand dollars in revenue"
• "The key is starting small and focusing on one revenue stream"

## SEO Tags:
creator monetization, online business, first revenue stream, indie creators, content creator tips, creator economy, digital entrepreneurship

## Discussion Questions:
1. What's the first revenue stream you want to focus on?
2. How has trying to do "everything at once" held you back?
3. What would reaching your first $1000 mean to you?

## Call-to-Action Ideas:
• Share your chosen revenue stream in the comments
• Subscribe for more creator business strategies
• Download our free creator monetization checklist

## Related Topic Ideas:
• Deep dive into each of the 3 strategies
• Creator tax tips for new entrepreneurs  
• Building an email list as a creator
• Pricing strategies for creator services

## Guest Interview Questions:
• What was your first successful revenue stream?
• What mistake do you see new creators making most often?
• How did you validate your first business idea?

---
*⚠️ DEMO MODE: OpenAI quota exceeded. Add billing to your account for real AI generation.*`;
      }

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

// server.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // Allow requests from your frontend (Vercel)
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("✅ Backend is running!");
});

// Main generation route
app.post("/generate", (req, res) => {
  const { transcript, tone, contentType } = req.body;

  // For now just return a fake result
  res.json({
    result: `✨ [Demo] Generated ${contentType} in ${tone} tone for transcript: "${transcript.substring(0, 60)}..."`
  });
});

// Use Replit's PORT or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
