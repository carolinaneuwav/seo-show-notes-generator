export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return res.status(200).json({
    success: true,
    message: 'Server is running on Vercel!',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    environment: process.env.VERCEL_ENV || 'development'
  });
}
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');