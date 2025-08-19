// backend/server.js - FIXED VERSION
const express = require('express');
const path = require('path');
const cors = require('cors');

// For now, let's test without OpenAI first
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Test endpoint - let's make sure this works first
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ 
    success: true, 
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// Temporary mock endpoint (we'll add OpenAI later)
app.post('/api/generate', (req, res) => {
  console.log('Generate endpoint hit!');
  console.log('Request body:', req.body);

  const { transcript, tone = 'casual' } = req.body;

  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Please provide a transcript' 
    });
  }

  // Mock response for now - we'll add real OpenAI integration next
  const mockResponse = `# SEO-Optimized Show Notes

## Title: 
${transcript.substring(0, 60)}...

## Summary:
This episode covers key insights about content creation and building an online business.

## Key Points:
• Focus on one revenue stream first
• Start small and iterate quickly  
• Consistency beats perfection
• Build genuine connections with your audience

## SEO Tags:
content creation, online business, podcasting, creator economy, monetization

---
*Generated in ${tone} tone*
*This is a MOCK response - OpenAI integration coming next!*`;

  res.json({ 
    success: true, 
    content: mockResponse,
    usage: { total_tokens: 150 }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Open your app at: http://localhost:${PORT}`);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});