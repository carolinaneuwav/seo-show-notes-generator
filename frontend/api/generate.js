function getApiUrl() {
  return "/api"; // Vercel automatically routes /api/* to serverless functions
}

async function generateShowNotes() {
  const transcript = document.getElementById("transcript").value;
  const tone = document.getElementById("tone").value || "casual";
  const contentType = document.getElementById("contentType").value || "show-notes";
  const outputDiv = document.getElementById("output");
  const generateButton = document.getElementById("generateBtn");

  if (!transcript.trim()) {
    outputDiv.innerHTML = `<div class="error">❌ Please enter a transcript</div>`;
    return;
  }

  try {
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";
    outputDiv.innerHTML = "<div class='loading'>🤖 Generating your show notes...</div>";

    const res = await fetch(`${getApiUrl()}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, tone, contentType }),
    });

    const data = await res.json();

    if (data.success) {
      outputDiv.innerHTML = `
        <div class="result">
          <h3>✅ Generated Show Notes:</h3>
          <pre style="white-space: pre-wrap;">${data.content}</pre>
          <small>Tokens used: ${data.usage.total_tokens}</small>
        </div>
      `;
    } else {
      outputDiv.innerHTML = `<div class="error">❌ ${data.error}</div>`;
    }
  } catch (err) {
    outputDiv.innerHTML = `<div class="error">❌ ${err.message}</div>`;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate Show Notes";
  }
  
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { transcript, tone = 'casual', contentType = 'show-notes' } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid transcript is required' 
      });
    }

    if (transcript.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transcript must be at least 10 characters long' 
      });
    }

    // Your existing OpenAI logic here
    let systemPrompt = '';
    let userPrompt = '';

    if (contentType === 'show-notes') {
      systemPrompt = `You are an expert podcast show notes writer. Create comprehensive, well-structured show notes that would be valuable for listeners and content creators. Use a ${tone} tone throughout.

Structure your response with:
1. Episode Summary (2-3 sentences)
2. Key Topics Discussed (bullet points)
3. Main Takeaways (numbered list)
4. Timestamps (if applicable)
5. Resources Mentioned (if any)
6. Quote Highlights (1-2 memorable quotes)

Make it engaging, scannable, and valuable for the audience.`;

      userPrompt = `Create show notes for this podcast transcript:\n\n${transcript}`;
    } else if (contentType === 'social') {
      systemPrompt = `You are a social media content creator. Create engaging social media content based on the podcast transcript. Use a ${tone} tone.

Create:
1. 3 Twitter/X posts (280 characters max each)
2. 1 LinkedIn post
3. 1 Instagram caption with hashtags
4. 3 key quotes for social sharing

Make it engaging and shareable.`;

      userPrompt = `Create social media content for this podcast transcript:\n\n${transcript}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    return res.status(200).json({
      success: true,
      content: content.trim(),
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0,
      }
    });

  } catch (error) {
    console.error('Error in generate API:', error);

    let errorMessage = 'Internal server error';
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please try again later.';
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'Rate limit exceeded. Please try again in a moment.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'OpenAI API configuration error';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}