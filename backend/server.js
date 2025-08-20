const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('frontend'));

/**
 * Create checkout session endpoint
 * Creates a new Stripe checkout session for subscription payment
 */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, planName } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.com/cancel',
      metadata: {
        plan_name: planName
      }
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify subscription status endpoint
 * Verifies if a subscription payment was successful
 */
app.post('/verify-subscription', async (req, res) => {
  try {
    const { sessionId } = req.body;

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription);

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: session.metadata.plan_name,
          current_period_end: subscription.current_period_end
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not completed'
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Webhook endpoint for Stripe events
 * Handles real-time notifications from Stripe about subscription changes
 */
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.status(400).send('Webhook signature verification failed.');
  }

  // Handle different event types
  switch (event.type) {
    case 'customer.subscription.created':
      console.log('New subscription created:', event.data.object);
      break;

    case 'customer.subscription.deleted':
      console.log('Subscription cancelled:', event.data.object);
      break;

    default:
      console.log('Unhandled event type:', event.type);
  }

  res.json({ received: true });
});

/**
 * Test endpoint to verify server is working
 */
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

/**
 * Generate show notes endpoint (demo version)
 * In production, this would connect to OpenAI or another AI service
 */
app.post('/api/generate', (req, res) => {
  try {
    const { transcript, tone = 'casual', contentType = 'show-notes' } = req.body;

    if (!transcript || transcript.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a transcript with at least 10 characters' 
      });
    }

    // Demo response - replace with actual AI generation
    const mockContent = `# Enhanced Show Notes

## Episode Summary
${transcript.substring(0, 200)}...

## Key Takeaways
• Focus on one main topic at a time
• Build genuine connections with your audience
• Consistency is key to long-term success

## Main Topics Discussed
1. **Introduction & Overview**
   - Setting the stage for today's discussion
   - Why this topic matters for creators

2. **Core Strategies**
   - Practical approaches that work
   - Real-world examples and case studies

3. **Implementation Tips**
   - How to get started today
   - Common pitfalls to avoid

## Action Items for Listeners
- Take one concrete step within 24 hours
- Share your progress with the community
- Apply these concepts to your own projects

## Resources Mentioned
- Links to tools and resources discussed
- Additional reading materials
- Community support channels

---
*Generated with ${tone} tone | Content type: ${contentType}*
*Character count: ${transcript.length} | Generated: ${new Date().toISOString()}*`;

    res.json({
      success: true,
      content: mockContent,
      usage: {
        total_tokens: Math.floor(transcript.length / 4), // Rough estimate
        prompt_tokens: Math.floor(transcript.length / 5),
        completion_tokens: Math.floor(mockContent.length / 4)
      }
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate show notes' 
    });
  }
});

/**
 * Create subscription endpoint
 */
app.post('/api/create-subscription', async (req, res) => {
  try {
    const { plan } = req.body;

    const priceIds = {
      creator: 'price_1234567890abcdef', // Replace with your actual Stripe price IDs
      pro: 'price_0987654321fedcba'
    };

    if (!priceIds[plan]) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid plan selected' 
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceIds[plan],
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?cancelled=true`,
      metadata: {
        plan_name: plan
      }
    });

    res.json({
      success: true,
      checkout_url: session.url
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create subscription' 
    });
  }
});

/**
 * Check subscription status endpoint
 */
app.get('/api/subscription-status', (req, res) => {
  // In a real app, you'd check the user's subscription from your database
  // For demo purposes, always return not subscribed
  res.json({
    success: true,
    isPaid: false,
    plan: null
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Available endpoints:');
  console.log('  GET  /api/test - Test server connection');
  console.log('  POST /api/generate - Generate show notes');
  console.log('  POST /api/create-subscription - Create Stripe subscription');
  console.log('  GET  /api/subscription-status - Check subscription status');
  console.log('  POST /create-checkout-session - Create checkout session');
  console.log('  POST /verify-subscription - Verify subscription');
  console.log('  POST /webhook - Stripe webhook');
});