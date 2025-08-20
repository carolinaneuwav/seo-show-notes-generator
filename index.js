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
app.post("/api/generate", async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ success: false, error: "Please provide a transcript" });
  }
  res.json({ success: true, content: `Received transcript: ${transcript}` });
});

// Serve index.html for frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


