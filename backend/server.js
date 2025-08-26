const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();

// Initialize Stripe - only if key exists
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe initialized successfully');
} else {
  console.log('⚠️ STRIPE_SECRET_KEY not found - Stripe features disabled');
}

// MongoDB connection
let db = null;
let usersCollection = null;
const userUsage = new Map(); // Fallback storage

// FIXED: Initialize MongoDB connection
async function initDB() {
  console.log('🔄 Initializing MongoDB connection...');

  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI environment variable not found!');
    return;
  }

  console.log('✅ MONGODB_URI found');

  try {
    console.log('🔗 Attempting to connect to MongoDB Atlas...');

    // Create MongoDB client with Stable API version
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      // Add these options for better reliability
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });

    // Connect to MongoDB
    await client.connect();
    console.log('🎯 MongoDB client connected successfully');

    // Test the connection with ping
    await client.db('admin').command({ ping: 1 });
    console.log('🏓 Pinged your deployment. You successfully connected to MongoDB!');

    // FIXED: Use correct database and collection names
    db = client.db('shownotes');  // Database name
    console.log('📂 Database "shownotes" selected');

    usersCollection = db.collection('users');  // Collection name for users
    console.log('📋 Collection "users" selected');

    // Test collection access
    const testCount = await usersCollection.countDocuments();
    console.log(`📊 Users collection accessible - ${testCount} documents found`);

    console.log('✅ MongoDB fully initialized and ready!');

  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error type:', error.name);
    console.error('   Error message:', error.message);

    if (error.message.includes('authentication')) {
      console.error('🔐 Authentication issue - check your username/password in MONGODB_URI');
    }
    if (error.message.includes('network')) {
      console.error('🌐 Network issue - check your IP whitelist in MongoDB Atlas');
    }
    if (error.message.includes('timeout')) {
      console.error('⏱️  Timeout issue - check your network connection');
    }

    console.log('⚠️  Falling back to in-memory storage');
  }
}

// FIXED: Helper functions for usage tracking
async function getUserUsage(userIP) {
  console.log(`🔍 getUserUsage called for IP: ${userIP}`);

  if (usersCollection) {
    try {
      console.log('📊 Querying MongoDB for user...');
      const user = await usersCollection.findOne({ ip: userIP });
      console.log('📊 MongoDB query result:', user ? `Found user with ${user.usageCount} uses` : 'No user found');
      return user ? user.usageCount : 0;
    } catch (error) {
      console.error('❌ Error querying MongoDB:', error.message);
      console.log('🔄 Falling back to in-memory storage');
      const memoryUsage = userUsage.get(userIP) || 0;
      console.log(`💾 In-memory storage result: ${memoryUsage} uses`);
      return memoryUsage;
    }
  } else {
    console.log('⚠️  No MongoDB connection - using in-memory storage');
    const memoryUsage = userUsage.get(userIP) || 0;
    console.log(`💾 In-memory storage result: ${memoryUsage} uses`);
    return memoryUsage;
  }
}

async function incrementUserUsage(userIP) {
  const currentCount = await getUserUsage(userIP);
  const newCount = currentCount + 1;
  console.log(`📈 Incrementing usage for ${userIP}: ${currentCount} → ${newCount}`);

  if (usersCollection) {
    try {
      console.log('💾 Updating MongoDB...');
      const result = await usersCollection.updateOne(
        { ip: userIP },
        { 
          $set: { 
            usageCount: newCount, 
            lastUsed: new Date(),
            ip: userIP 
          } 
        },
        { upsert: true }
      );
      console.log('✅ MongoDB update result:', {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: !!result.upsertedId
      });
    } catch (error) {
      console.error('❌ Error updating MongoDB:', error.message);
      console.log('🔄 Falling back to in-memory storage');
      userUsage.set(userIP, newCount);
      console.log(`💾 Updated in-memory storage: ${userIP} → ${newCount}`);
    }
  } else {
    console.log('⚠️  No MongoDB connection - using in-memory storage');
    userUsage.set(userIP, newCount);
    console.log(`💾 Updated in-memory storage: ${userIP} → ${newCount}`);
  }

  return newCount;
}

// Enhanced CORS configuration for Replit
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// IMPORTANT: Serve static files from the parent directory (project root)
app.use(express.static(path.join(__dirname, '..')));

// Enhanced request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body keys:', Object.keys(req.body));
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    host: '0.0.0.0',
    directory: __dirname,
    staticPath: path.join(__dirname, '..'),
    stripe_enabled: !!stripe,
    mongodb_connected: !!usersCollection
  });
});

// ADDED: MongoDB connection test endpoint
app.get('/api/test-mongo', async (req, res) => {
  console.log('🧪 Testing MongoDB connection...');

  const result = {
    step1_env_check: !!process.env.MONGODB_URI,
    step2_uri_format: null,
    step3_connection: null,
    step4_database: null,
    step5_collection: null,
    step6_write_test: null,
    step7_read_test: null,
    errors: []
  };

  try {
    // Step 1: Check environment variable
    if (!process.env.MONGODB_URI) {
      result.errors.push('MONGODB_URI environment variable not set');
      return res.json(result);
    }

    // Step 2: Check URI format
    const uri = process.env.MONGODB_URI;
    result.step2_uri_format = uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://');
    if (!result.step2_uri_format) {
      result.errors.push('MONGODB_URI should start with mongodb+srv:// or mongodb://');
    }

    // Step 3: Test connection
    console.log('🔗 Attempting MongoDB connection...');
    const testClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await testClient.connect();
    result.step3_connection = true;
    console.log('✅ MongoDB connection successful');

    // Step 4: Test database access
    const testDb = testClient.db('shownotes');
    await testDb.admin().ping();
    result.step4_database = true;
    console.log('✅ Database access successful');

    // Step 5: Test collection access
    const testCollection = testDb.collection('users');
    const count = await testCollection.countDocuments();
    result.step5_collection = true;
    result.collection_count = count;
    console.log(`✅ Collection access successful - ${count} documents`);

    // Step 6: Test write
    const testDoc = {
      ip: 'test-' + Date.now(),
      usageCount: 1,
      lastUsed: new Date(),
      test: true
    };
    await testCollection.insertOne(testDoc);
    result.step6_write_test = true;
    console.log('✅ Write test successful');

    // Step 7: Test read
    const readDoc = await testCollection.findOne({ _id: testDoc._id });
    result.step7_read_test = !!readDoc;
    console.log('✅ Read test successful');

    // Cleanup
    await testCollection.deleteOne({ _id: testDoc._id });
    await testClient.close();

    result.status = 'ALL_TESTS_PASSED';
    console.log('🎉 All MongoDB tests passed!');

  } catch (error) {
    result.errors.push(`Error: ${error.message}`);
    result.error_details = {
      name: error.name,
      code: error.code,
      codeName: error.codeName
    };
    console.error('❌ MongoDB test failed:', error);
  }

  res.json(result);
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('✅ Test endpoint called successfully');
  res.json({
    success: true,
    message: 'Server is working perfectly!',
    timestamp: new Date().toISOString(),
    directory: __dirname,
    staticDirectory: path.join(__dirname, '..'),
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    host: '0.0.0.0',
    stripe_enabled: !!stripe,
    mongodb_connected: !!usersCollection
  });
});

// Usage check endpoint
app.get('/api/usage', async (req, res) => {
  try {
    const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const currentUsage = await getUserUsage(userIP);

    res.json({
      success: true,
      usageInfo: {
        currentUsage: currentUsage,
        freeLimit: 5,
        remainingFree: Math.max(0, 5 - currentUsage),
        requiresPayment: currentUsage >= 5
      }
    });
  } catch (error) {
    console.error('Error checking usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check usage'
    });
  }
});

// STRIPE CHECKOUT ENDPOINT
app.post('/create-checkout-session', async (req, res) => {
  console.log('💳 Stripe checkout session requested');

  if (!stripe) {
    return res.status(500).json({
      error: 'Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.'
    });
  }

  try {
    const { plan } = req.body;
    console.log('Plan requested:', plan);

    // Define your plans - YOU NEED TO REPLACE THESE WITH REAL STRIPE PRICE IDs
    const plans = {
      creator: {
        price_id: process.env.STRIPE_CREATOR_PRICE_ID || "price_1RyHyIDF11JZQS5lv1GdG3Ef", // Replace with real Stripe Price ID
        name: 'Creator Plan - €5/month'
      },
      pro: {
        price_id: process.env.STRIPE_PRO_PRICE_ID || 'price_1RyI0IDF11JZQS5l914rSyO0', // Replace with real Stripe Price ID
        name: 'Pro Plan - €15/month'
      }
    };

    if (!plans[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Get the base URL for redirects
    const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    console.log('Base URL for redirects:', baseUrl);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plans[plan].price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: {
        plan: plan,
        created_at: new Date().toISOString()
      }
    });

    console.log('✅ Stripe session created:', session.id);
    console.log('Redirect URL:', session.url);

    res.json({ 
      success: true,
      url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message,
      success: false
    });
  }
});

// SUCCESS PAGE
app.get('/success', (req, res) => {
  const sessionId = req.query.session_id;
  console.log('✅ Payment successful, session:', sessionId);

  res.send(`
    <html>
      <head>
        <title>Payment Success - Show Notes Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            text-align: center; 
            padding: 50px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            color: white;
          }
          .success-container {
            background: white;
            color: #333;
            padding: 40px;
            border-radius: 15px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .btn {
            background: #667eea; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 8px;
            display: inline-block;
            margin-top: 20px;
            font-weight: 600;
          }
          .btn:hover { background: #5a6fd8; }
        </style>
      </head>
      <body>
        <div class="success-container">
          <h1>🎉 Welcome to Premium!</h1>
          <p>Your payment was successful! You now have unlimited access to our show notes generator.</p>
          <p><small>Session ID: ${sessionId || 'N/A'}</small></p>
          <a href="/" class="btn">Start Creating Show Notes</a>
        </div>
      </body>
    </html>
  `);
});

// CANCEL PAGE  
app.get('/cancel', (req, res) => {
  console.log('❌ Payment cancelled by user');

  res.send(`
    <html>
      <head>
        <title>Payment Cancelled - Show Notes Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            text-align: center; 
            padding: 50px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            color: white;
          }
          .cancel-container {
            background: white;
            color: #333;
            padding: 40px;
            border-radius: 15px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .btn {
            background: #667eea; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 8px;
            display: inline-block;
            margin-top: 20px;
            font-weight: 600;
          }
          .btn:hover { background: #5a6fd8; }
        </style>
      </head>
      <body>
        <div class="cancel-container">
          <h1>Payment Cancelled</h1>
          <p>No problem! You can always upgrade later when you're ready.</p>
          <p>You still have access to your free generations for this month.</p>
          <a href="/" class="btn">Back to Generator</a>
        </div>
      </body>
    </html>
  `);
});

// FIXED: Main generation endpoint with proper usage limiting
app.post('/api/generate', async (req, res) => {
  console.log('🤖 Generate endpoint called');

  try {
    const { transcript, tone, contentType } = req.body;

    // Get user identifier
    const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    console.log('User IP:', userIP);

    // FIXED: Get current usage count FIRST
    const currentUsage = await getUserUsage(userIP);
    console.log(`User ${userIP} current usage: ${currentUsage}`);

    // FIXED: Check if user has ALREADY exceeded free limit (check BEFORE incrementing)
    if (currentUsage >= 5) {
      console.log('❌ User exceeded free limit, payment required');
      return res.status(429).json({
        success: false,
        error: 'FREE_LIMIT_EXCEEDED',
        message: 'You have used your 5 free generations. Please upgrade to continue.',
        usageCount: currentUsage,
        freeLimit: 5
      });
    }

    // Enhanced validation
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }

    if (typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript must be a string'
      });
    }

    if (transcript.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a transcript with at least 10 characters'
      });
    }

    // FIXED: Increment usage count AFTER validation and limit check
    const newUsageCount = await incrementUserUsage(userIP);
    console.log(`✅ Usage updated: ${userIP} now has ${newUsageCount} uses`);

    // Generate mock show notes
    const mockShowNotes = generateMockShowNotes(transcript, tone || 'casual', contentType || 'show-notes');

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = {
      success: true,
      content: mockShowNotes,
      usage: {
        total_tokens: Math.floor(transcript.length / 4),
        prompt_tokens: Math.floor(transcript.length / 5),
        completion_tokens: Math.floor(mockShowNotes.length / 4)
      },
      usageInfo: {
        currentUsage: newUsageCount,
        freeLimit: 5,
        remainingFree: Math.max(0, 5 - newUsageCount),
        requiresPayment: newUsageCount >= 5
      },
      metadata: {
        tone: tone || 'casual',
        contentType: contentType || 'show-notes',
        generated_at: new Date().toISOString()
      }
    };

    console.log('✅ Generation successful, remaining free uses:', 5 - newUsageCount);
    res.json(response);

  } catch (error) {
    console.error('❌ Generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate show notes: ' + error.message,
      details: error.stack
    });
  }
});

// Root endpoint - serve the HTML from parent directory
app.get('/', (req, res) => {
  console.log('📄 Serving index.html from parent directory');
  const htmlPath = path.join(__dirname, '..', 'index.html');
  console.log('HTML file path:', htmlPath);
  res.sendFile(htmlPath);
});

// Enhanced mock show notes generator
function generateMockShowNotes(transcript, tone, contentType) {
  const toneStyles = {
    casual: "Hey everyone! Here's what we covered today:",
    formal: "This episode addressed the following key topics:",
    witty: "Buckle up! We dove deep into some fascinating stuff:",
    professional: "In today's episode, we explored:"
  };

  const intro = toneStyles[tone] || toneStyles.casual;

  // Enhanced content extraction
  const words = transcript.toLowerCase().split(/\s+/);
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Extract key topics (longer words that appear multiple times or are particularly long)
  const wordFreq = {};
  words.forEach(word => {
    if (word.length > 4 && !['that', 'this', 'with', 'have', 'they', 'were', 'been', 'their', 'there', 'would', 'could', 'should'].includes(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const keyWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  // Get a meaningful quote (first complete sentence that's not too short)
  const meaningfulQuote = sentences.find(s => s.trim().length > 20 && s.trim().length < 150) || sentences[0] || "Key insights shared in this episode";

  if (contentType === 'social') {
    return `🎙️ New podcast episode is live!

${intro}

🔥 Key highlights:
- ${keyWords[0] || 'Main topic'} discussion and insights
- ${keyWords[1] || 'Actionable strategies'} for implementation  
- ${keyWords[2] || 'Expert tips'} and real-world examples

💡 Key insight: "${meaningfulQuote.trim()}"

Listen now and transform your approach! 🎧 

#podcast #business #entrepreneurship #growth #insights`;
  }

  // Enhanced show notes format
  return `${intro}

## 📝 Episode Summary
In this engaging episode, we dive deep into ${keyWords[0] || 'key insights'} and explore practical strategies for ${keyWords[1] || 'implementation'}. Our discussion covers essential concepts around ${keyWords[2] || 'growth'} and provides actionable takeaways for listeners.

## 🔥 Key Topics Covered
- **${keyWords[0] || 'Core Discussion'}**: Deep dive into fundamental concepts and frameworks
- **${keyWords[1] || 'Practical Application'}**: Real-world strategies and implementation tips  
- **${keyWords[2] || 'Advanced Insights'}**: Next-level thinking and expert perspectives
- **${keyWords[3] || 'Common Challenges'}**: Obstacles to avoid and how to overcome them
- **${keyWords[4] || 'Success Stories'}**: Examples and case studies from the field

## 💡 Key Quote
> "${meaningfulQuote.trim()}"

## 🎯 Main Takeaways
1. **Start with Foundation**: Build solid groundwork before advancing to complex strategies
2. **Focus on Implementation**: Theory without action leads nowhere - take consistent steps
3. **Learn from Others**: Study successful examples and adapt them to your situation
4. **Stay Patient**: Meaningful results take time - trust the process and keep going
5. **Measure Progress**: Track your improvements and adjust your approach as needed

## 📚 Action Steps
- [ ] Review the key concepts discussed in this episode
- [ ] Choose one strategy to implement this week
- [ ] Share your progress with our community
- [ ] Subscribe for more valuable insights and updates

## 🔗 Resources Mentioned
- Episode transcript available on our website
- Connect with us on social media for updates
- Join our community for ongoing discussions

## 📊 Episode Stats
- **Duration**: Approximately ${Math.ceil(transcript.length / 150)} minutes
- **Key Topics**: ${keyWords.length} major themes covered
- **Actionable Items**: 5+ specific takeaways provided

---
*Show notes generated on ${new Date().toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}*

*Processing details: ~${Math.floor(transcript.length / 4)} tokens analyzed*

---

## 💬 Continue the Conversation
What resonated most with you from this episode? Share your thoughts and questions in the comments below!

**Don't forget to subscribe and hit the notification bell for more valuable content!**`;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❓ 404 - Route not found:', req.url);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// CRITICAL: Replit requires specific port and host configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Initialize database and start server
async function startServer() {
  await initDB(); // Initialize MongoDB first

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running successfully on ${HOST}:${PORT}`);
    console.log(`📂 Backend directory: ${__dirname}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, '..')}`);
    console.log(`🌐 Access your app in Replit's web view!`);
    console.log(`🔗 API endpoints available:`);
    console.log(`   GET  /api/test - Test server connection`);
    console.log(`   GET  /api/test-mongo - Test MongoDB connection`);
    console.log(`   GET  /api/usage - Check usage count`);
    console.log(`   POST /api/generate - Generate show notes (with usage tracking)`);
    console.log(`   POST /create-checkout-session - Create Stripe checkout`);
    console.log(`   GET  /success - Payment success page`);
    console.log(`   GET  /cancel - Payment cancel page`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  / - Main application`);
    console.log(`\n⚠️  IMPORTANT: Make sure index.html is in the project root directory`);
    console.log(`💳 Stripe status: ${stripe ? 'Enabled' : 'Disabled (add STRIPE_SECRET_KEY)'}`);
    console.log(`🗄️  MongoDB status: ${usersCollection ? 'Connected' : 'Disconnected (using fallback storage)'}`);
  });
}

// Start the server
startServer().catch(console.error);