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
const userUsage = new Map(); // Fallback storage - ALWAYS initialize this

// FIXED: Better IP extraction function
function getUserIP(req) {
  // Get IP from various possible headers (in order of preference)
  const possibleIPs = [
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['x-client-ip'],
    req.connection.remoteAddress,
    req.socket.remoteAddress,
    req.ip
  ].filter(ip => ip && ip !== 'unknown');

  let userIP = possibleIPs[0] || 'fallback-ip';

  // Clean up the IP (remove port if present, take first IP if comma-separated)
  if (userIP.includes(',')) {
    userIP = userIP.split(',')[0].trim();
  }
  if (userIP.includes(':') && userIP.split(':').length === 2) {
    userIP = userIP.split(':')[0];
  }

  // For development, create unique session identifiers
  if (userIP === '::1' || userIP === '127.0.0.1' || userIP.startsWith('10.') || userIP.startsWith('192.168.')) {
    // In development, use a combination of IP and user agent for uniqueness
    const userAgent = req.headers['user-agent'] || 'unknown';
    userIP = `dev-${userIP}-${Buffer.from(userAgent).toString('base64').slice(0, 8)}`;
  }

  console.log(`🔍 User IP resolved: ${userIP} (from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'})`);
  return userIP;
}

// FIXED: Initialize MongoDB connection
async function initDB() {
  console.log('🔄 Initializing MongoDB connection...');

  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI environment variable not found! Using in-memory storage.');
    return;
  }

  console.log('✅ MONGODB_URI found, attempting connection...');

  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });

    await client.connect();
    console.log('🎯 MongoDB client connected successfully');

    await client.db('admin').command({ ping: 1 });
    console.log('🏓 MongoDB ping successful!');

    db = client.db('shownotes');
    usersCollection = db.collection('users');

    const testCount = await usersCollection.countDocuments();
    console.log(`📊 Users collection accessible - ${testCount} documents found`);
    console.log('✅ MongoDB fully initialized and ready!');

  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error:', error.message);
    console.log('⚠️  Falling back to in-memory storage');
    // Don't set usersCollection, let it remain null for fallback
  }
}

// FIXED: Helper functions for usage tracking with better logging
async function getUserUsage(userIP) {
  console.log(`🔍 getUserUsage called for IP: ${userIP}`);

  try {
    if (usersCollection) {
      console.log('📊 Querying MongoDB for user...');
      const user = await usersCollection.findOne({ ip: userIP });
      const usage = user ? user.usageCount : 0;
      console.log(`📊 MongoDB result for ${userIP}: ${usage} uses`);
      return usage;
    } else {
      console.log('⚠️  No MongoDB connection - using in-memory storage');
      const memoryUsage = userUsage.get(userIP) || 0;
      console.log(`💾 In-memory storage result for ${userIP}: ${memoryUsage} uses`);
      return memoryUsage;
    }
  } catch (error) {
    console.error('❌ Error getting user usage:', error.message);
    console.log('🔄 Falling back to in-memory storage');
    const memoryUsage = userUsage.get(userIP) || 0;
    console.log(`💾 Fallback in-memory storage result for ${userIP}: ${memoryUsage} uses`);
    return memoryUsage;
  }
}

async function incrementUserUsage(userIP) {
  const currentCount = await getUserUsage(userIP);
  const newCount = currentCount + 1;
  console.log(`📈 Incrementing usage for ${userIP}: ${currentCount} → ${newCount}`);

  try {
    if (usersCollection) {
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
      console.log(`✅ MongoDB update successful for ${userIP}: ${newCount} uses`);
    } else {
      throw new Error('No MongoDB connection');
    }
  } catch (error) {
    console.error('❌ Error updating MongoDB:', error.message);
    console.log('🔄 Using in-memory storage for increment');
    userUsage.set(userIP, newCount);
    console.log(`💾 Updated in-memory storage: ${userIP} → ${newCount} uses`);
  }

  return newCount;
}

// FIXED: Add debug endpoint to check current storage state
app.get('/api/debug-usage', async (req, res) => {
  const userIP = getUserIP(req);

  try {
    const currentUsage = await getUserUsage(userIP);

    // Get all users from memory for debugging
    const memoryUsers = Array.from(userUsage.entries()).map(([ip, count]) => ({ ip, count }));

    // Try to get MongoDB users
    let mongoUsers = [];
    if (usersCollection) {
      try {
        mongoUsers = await usersCollection.find({}).toArray();
      } catch (e) {
        mongoUsers = [{ error: e.message }];
      }
    }

    res.json({
      success: true,
      debug: {
        yourIP: userIP,
        yourCurrentUsage: currentUsage,
        mongoDBConnected: !!usersCollection,
        inMemoryUsers: memoryUsers,
        mongoUsers: mongoUsers.slice(0, 10), // Limit to first 10 for debugging
        headers: {
          'x-forwarded-for': req.headers['x-forwarded-for'],
          'x-real-ip': req.headers['x-real-ip'],
          'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      yourIP: userIP
    });
  }
});

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

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    host: HOST,
    directory: __dirname,
    staticPath: path.join(__dirname, '..'),
    stripe_enabled: !!stripe,
    mongodb_connected: !!usersCollection,
    inMemoryUsers: userUsage.size
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('✅ Test endpoint called successfully');
  const userIP = getUserIP(req);

  res.json({
    success: true,
    message: 'Server is working perfectly!',
    timestamp: new Date().toISOString(),
    yourIP: userIP,
    directory: __dirname,
    staticDirectory: path.join(__dirname, '..'),
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    host: HOST,
    stripe_enabled: !!stripe,
    mongodb_connected: !!usersCollection,
    inMemoryUsersCount: userUsage.size
  });
});

// FIXED: Usage check endpoint with better error handling
app.get('/api/usage', async (req, res) => {
  try {
    const userIP = getUserIP(req);
    console.log(`📊 Usage check requested for IP: ${userIP}`);

    const currentUsage = await getUserUsage(userIP);
    console.log(`📊 Current usage for ${userIP}: ${currentUsage}/5`);

    const usageInfo = {
      currentUsage: currentUsage,
      freeLimit: 5,
      remainingFree: Math.max(0, 5 - currentUsage),
      requiresPayment: currentUsage >= 5
    };

    console.log(`📊 Usage info for ${userIP}:`, usageInfo);

    res.json({
      success: true,
      usageInfo: usageInfo,
      debug: {
        userIP: userIP,
        mongoConnected: !!usersCollection,
        storageType: usersCollection ? 'mongodb' : 'memory'
      }
    });
  } catch (error) {
    console.error('❌ Error checking usage:', error);

    // Return safe defaults
    res.json({
      success: true,
      usageInfo: {
        currentUsage: 0,
        freeLimit: 5,
        remainingFree: 5,
        requiresPayment: false
      },
      error: error.message,
      note: 'Returned default values due to error'
    });
  }
});

// FIXED: Main generation endpoint with better usage tracking
app.post('/api/generate', async (req, res) => {
  console.log('🤖 Generate endpoint called');

  try {
    const { transcript, tone, contentType } = req.body;
    const userIP = getUserIP(req);

    console.log(`🤖 Generation request from IP: ${userIP}`);

    // Enhanced validation
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }

    if (typeof transcript !== 'string' || transcript.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a transcript with at least 10 characters'
      });
    }

    // Get current usage count BEFORE incrementing
    const currentUsage = await getUserUsage(userIP);
    console.log(`🔍 Pre-generation usage check for ${userIP}: ${currentUsage}/5`);

    // Check if user has exceeded free limit
    if (currentUsage >= 5) {
      console.log(`❌ User ${userIP} exceeded free limit (${currentUsage}/5)`);
      return res.status(429).json({
        success: false,
        error: 'FREE_LIMIT_EXCEEDED',
        message: 'You have used all 5 free show note generations. Upgrade for unlimited access!',
        usageCount: currentUsage,
        freeLimit: 5,
        remainingFree: 0,
        requiresPayment: true,
        redirectTo: '/upgrade'
      });
    }

    // Increment usage count AFTER validation and limit check
    const newUsageCount = await incrementUserUsage(userIP);
    console.log(`✅ Usage incremented for ${userIP}: ${currentUsage} → ${newUsageCount}`);

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
        generated_at: new Date().toISOString(),
        userIP: userIP // For debugging
      }
    };

    console.log(`✅ Generation successful for ${userIP}. Remaining: ${5 - newUsageCount}`);
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

// STRIPE CHECKOUT ENDPOINT
app.post('/create-checkout-session', async (req, res) => {
  console.log('💳 Stripe checkout session requested');

  if (!stripe) {
    return res.status(500).json({
      success: false,
      error: 'Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.'
    });
  }

  try {
    const { plan } = req.body;
    console.log('Plan requested:', plan);

    const plans = {
      creator: {
        price_id: process.env.STRIPE_CREATOR_PRICE_ID || "price_1RyHyIDF11JZQS5lv1GdG3Ef",
        name: 'Creator Plan - €5/month'
      },
      pro: {
        price_id: process.env.STRIPE_PRO_PRICE_ID || 'price_1RyI0IDF11JZQS5l914rSyO0',
        name: 'Pro Plan - €15/month'
      }
    };

    if (!plans[plan]) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid plan selected' 
      });
    }

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
      cancel_url: `${baseUrl}/upgrade`,
      metadata: {
        plan: plan,
        created_at: new Date().toISOString()
      }
    });

    console.log('✅ Stripe session created:', session.id);

    res.json({ 
      success: true,
      url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

// Upgrade page route - keep existing implementation
app.get('/upgrade', (req, res) => {
  console.log('💳 Upgrade page requested');
  // [Previous upgrade page HTML code stays the same]
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upgrade to Premium - Show Notes Generator</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 800px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            text-align: center;
        }
        .title {
            color: #333;
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .subtitle {
            color: #666;
            font-size: 1.2rem;
            margin-bottom: 40px;
        }
        .limit-message {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 40px;
            font-size: 1.1rem;
        }
        .plans {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        @media (max-width: 768px) {
            .plans { grid-template-columns: 1fr; }
            .title { font-size: 2rem; }
        }
        .plan {
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            padding: 30px;
            transition: all 0.3s ease;
            position: relative;
        }
        .plan:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.15);
        }
        .plan.popular {
            border-color: #667eea;
            transform: scale(1.05);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.2);
        }
        .popular-badge {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .plan-name {
            font-size: 1.5rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        .plan-price {
            font-size: 2rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 20px;
        }
        .plan-features {
            list-style: none;
            margin-bottom: 30px;
        }
        .plan-features li {
            padding: 8px 0;
            color: #666;
            position: relative;
            padding-left: 25px;
        }
        .plan-features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #4CAF50;
            font-weight: bold;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .back-link {
            color: #667eea;
            text-decoration: none;
            margin-top: 20px;
            display: inline-block;
            font-weight: 500;
        }
        .back-link:hover {
            text-decoration: underline;
        }
        .loading {
            display: none;
            color: #667eea;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">Upgrade to Premium</h1>
        <p class="subtitle">Unlock unlimited show notes generation</p>

        <div class="limit-message">
            <strong>You've reached your free limit!</strong><br>
            You've used all 5 free generations. Choose a plan to continue creating amazing show notes.
        </div>

        <div class="plans">
            <div class="plan">
                <h3 class="plan-name">Creator Plan</h3>
                <div class="plan-price">€5<span style="font-size: 1rem; font-weight: 400;">/month</span></div>
                <ul class="plan-features">
                    <li>Unlimited show notes generation</li>
                    <li>All tone options</li>
                    <li>Social media snippets</li>
                    <li>Priority support</li>
                    <li>Advanced formatting</li>
                </ul>
                <button class="btn" onclick="subscribeToPlan('creator')" id="creator-btn">
                    Choose Creator Plan
                </button>
            </div>

            <div class="plan popular">
                <div class="popular-badge">Most Popular</div>
                <h3 class="plan-name">Pro Plan</h3>
                <div class="plan-price">€15<span style="font-size: 1rem; font-weight: 400;">/month</span></div>
                <ul class="plan-features">
                    <li>Everything in Creator</li>
                    <li>Custom templates</li>
                    <li>API access</li>
                    <li>White-label options</li>
                    <li>Priority processing</li>
                    <li>Advanced analytics</li>
                </ul>
                <button class="btn" onclick="subscribeToPlan('pro')" id="pro-btn">
                    Choose Pro Plan
                </button>
            </div>
        </div>

        <p class="loading" id="loading">Creating secure checkout session...</p>

        <a href="/" class="back-link">← Back to Generator</a>
    </div>

    <script>
        async function subscribeToPlan(plan) {
            console.log('Subscribing to plan:', plan);

            document.getElementById('loading').style.display = 'block';
            document.getElementById(plan + '-btn').disabled = true;
            document.getElementById(plan + '-btn').textContent = 'Processing...';

            try {
                const response = await fetch('/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ plan: plan })
                });

                const data = await response.json();
                console.log('Checkout response:', data);

                if (data.success && data.url) {
                    console.log('Redirecting to:', data.url);
                    window.location.href = data.url;
                } else {
                    throw new Error(data.error || 'Failed to create checkout session');
                }
            } catch (error) {
                console.error('Subscription error:', error);
                alert('Sorry, there was an error processing your request. Please try again.');

                document.getElementById('loading').style.display = 'none';
                document.getElementById(plan + '-btn').disabled = false;
                document.getElementById(plan + '-btn').textContent = plan === 'creator' ? 'Choose Creator Plan' : 'Choose Pro Plan';
            }
        }
    </script>
</body>
</html>`);
});

// SUCCESS PAGE - keep existing
app.get('/success', (req, res) => {
  const sessionId = req.query.session_id;
  console.log('✅ Payment successful, session:', sessionId);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Success - Show Notes Generator</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            text-align: center; 
            padding: 50px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .success-container {
            background: white;
            color: #333;
            padding: 60px 40px;
            border-radius: 20px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        .success-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        .title {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 20px;
            color: #333;
        }
        .message {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .session-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 0.9rem;
            color: #666;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 10px;
            display: inline-block;
            margin-top: 20px;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s ease;
        }
        .btn:hover { 
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .features {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .features h4 {
            margin-bottom: 15px;
            color: #333;
        }
        .features ul {
            list-style: none;
            padding: 0;
        }
        .features li {
            padding: 5px 0;
            color: #666;
            position: relative;
            padding-left: 25px;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #4CAF50;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">🎉</div>
        <h1 class="title">Welcome to Premium!</h1>
        <p class="message">Your payment was successful! You now have unlimited access to our show notes generator with all premium features.</p>

        <div class="features">
            <h4>What you get:</h4>
            <ul>
                <li>Unlimited show notes generation</li>
                <li>All tone and format options</li>
                <li>Social media snippets</li>
                <li>Priority support</li>
                <li>Advanced formatting options</li>
            </ul>
        </div>

        <div class="session-info">
            <strong>Order Details:</strong><br>
            Session ID: ${sessionId || 'N/A'}<br>
            Date: ${new Date().toLocaleDateString()}
        </div>

        <a href="/" class="btn">Start Creating Show Notes</a>
    </div>
</body>
</html>`);
});

// CANCEL PAGE  
app.get('/cancel', (req, res) => {
  console.log('Payment cancelled by user');
  res.redirect('/upgrade');
});

// Root endpoint - serve the HTML from parent directory
app.get('/', (req, res) => {
  console.log('Serving index.html from parent directory');
  const htmlPath = path.join(__dirname, '..', 'index.html');
  console.log('HTML file path:', htmlPath);
  res.sendFile(htmlPath);
});

// Enhanced mock show notes generator - keep existing implementation
function generateMockShowNotes(transcript, tone, contentType) {
  const toneStyles = {
    casual: "Hey everyone! Here's what we covered today:",
    formal: "This episode addressed the following key topics:",
    witty: "Buckle up! We dove deep into some fascinating stuff:",
    professional: "In today's episode, we explored:"
  };

  const intro = toneStyles[tone] || toneStyles.casual;

  const words = transcript.toLowerCase().split(/\s+/);
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);

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
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.url);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// Initialize database and start server
async function startServer() {
  await initDB();

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running successfully on ${HOST}:${PORT}`);
    console.log(`📂 Backend directory: ${__dirname}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, '..')}`);
    console.log(`🌐 Access your app in Replit's web view!`);
    console.log(`🔗 API endpoints available:`);
    console.log(`   GET  /api/test - Test server connection`);
    console.log(`   GET  /api/debug-usage - Debug usage tracking (NEW)`);
    console.log(`   GET  /api/usage - Check usage count`);
    console.log(`   POST /api/generate - Generate show notes (with usage tracking)`);
    console.log(`   GET  /upgrade - Payment/upgrade page`);
    console.log(`   POST /create-checkout-session - Create Stripe checkout`);
    console.log(`   GET  /success - Payment success page`);
    console.log(`   GET  /cancel - Payment cancel page (redirects to upgrade)`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  / - Main application`);
    console.log(`💳 Stripe status: ${stripe ? 'Enabled' : 'Disabled (add STRIPE_SECRET_KEY)'}`);
    console.log(`🗄️  MongoDB status: ${usersCollection ? 'Connected' : 'Disconnected (using fallback storage)'}`);
    console.log(`\n🐛 DEBUGGING: Visit /api/debug-usage to see usage tracking details`);
  });
}

startServer().catch(console.error);