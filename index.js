const express = require("express");
const path = require("path");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Server is working!",
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
  });
});

// Example /api/generate endpoint (simplified for testing)
// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Updated /api/generate endpoint
app.post("/api/generate", async (req, res) => {
  try {
    const { transcript, tone = "professional" } = req.body;

    if (!transcript) {
      return res.status(400).json({ 
        success: false, 
        error: "Please provide a transcript" 
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: "OpenAI API key not configured" 
      });
    }

    // Create show notes prompt based on tone
    const prompts = {
      professional: `Create professional show notes from this podcast transcript. Include: 1) Executive Summary, 2) Key Topics, 3) Main Takeaways, 4) Action Items. Make it formal and business-focused.\\n\\nTranscript: ${transcript}`,
      casual: `Create casual, friendly show notes from this podcast transcript. Make it conversational and easy to read. Include the main points and key takeaways in a relaxed tone.\\n\\nTranscript: ${transcript}`,
      witty: `Create entertaining show notes from this podcast transcript. Use humor, clever observations, and engaging language while covering the main points and takeaways.\\n\\nTranscript: ${transcript}`
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompts[tone] }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const showNotes = completion.choices[0].message.content;

    // Generate social snippets
    const socialCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ 
        role: "user", 
        content: `Create 3 social media snippets (Twitter/LinkedIn style) from these show notes. Make them engaging and shareable:\\n\\n${showNotes}` 
      }],
      max_tokens: 300,
      temperature: 0.8,
    });

    const socialSnippets = socialCompletion.choices[0].message.content;

    res.json({
      success: true,
      showNotes,
      socialSnippets,
      tone,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate show notes. Please try again.",
      details: error.message
    });
  }
});

// Serve index.html for frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


