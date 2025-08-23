const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from current directory
app.use(express.static(__dirname));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes
app.get('/api/test', (req, res) => {
  console.log('✅ Test endpoint called successfully');
  res.json({
    success: true,
    message: 'Server is working perfectly!',
    timestamp: new Date().toISOString(),
    directory: __dirname
  });
});

app.post('/api/generate', async (req, res) => {
  console.log('🤖 Generate endpoint called with:', req.body);
  
  try {
    const { transcript, tone, contentType } = req.body;
    
    if (!transcript || transcript.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a transcript with at least 10 characters'
      });
    }

    const mockShowNotes = generateMockShowNotes(transcript, tone, contentType);
    
    res.json({
      success: true,
      content: mockShowNotes,
      usage: {
        total_tokens: Math.floor(transcript.length / 4)
      }
    });

  } catch (error) {
    console.error('❌ Generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate show notes: ' + error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function generateMockShowNotes(transcript, tone, contentType) {
  const toneStyles = {
    casual: "Hey everyone! Here's what we covered today:",
    formal: "This episode addressed the following key topics:",
    witty: "Buckle up! We dove deep into some fascinating stuff:",
    professional: "In today's episode, we explored:"
  };

  const intro = toneStyles[tone] || toneStyles.casual;
  const words = transcript.toLowerCase().split(/\s+/);
  const keyTopics = words
    .filter(word => word.length > 5)
    .slice(0, 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1));
  
  if (contentType === 'social') {
    return `🎙️ New podcast episode is live!

${intro}

🔥 Key highlights:
- ${keyTopics[0] || 'Main topic'} discussion
- ${keyTopics[1] || 'Actionable insights'} shared  
- ${keyTopics[2] || 'Expert tips'} revealed

Listen now! 🎧 

#podcast #business #entrepreneurship`;
  }

  return `${intro}

## 📝 Episode Summary
In this episode, we explore ${keyTopics[0] || 'key insights'} and discuss practical strategies for implementation.

## 🔥 Key Topics Covered
- ${keyTopics[0] || 'Main discussion point'} - Core insights
- ${keyTopics[1] || 'Secondary topic'} - Practical tips
- ${keyTopics[2] || 'Advanced concept'} - Next level thinking

## 💡 Key Quote
"${transcript.split('.')[0] || 'Important insight from this conversation'}..."

## 🎯 Main Takeaways
1. **Start Small**: Focus on one key area first
2. **Stay Consistent**: Regular action beats perfection
3. **Apply Learning**: Turn insights into action

## 📚 Next Steps
- Implement the strategies discussed
- Share your progress with the community
- Subscribe for more insights

---
*Generated from transcript on ${new Date().toLocaleDateString()}*
*Tokens used: ~${Math.floor(transcript.length / 4)}*`;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running successfully on port ${PORT}`);
  console.log(`📂 Serving from: ${__dirname}`);
  console.log(`🌐 Access your app in Replit's web view!`);
});
