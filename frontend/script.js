
// frontend/script.js - FIXED VERSION
console.log("🚀 Script loaded successfully!");

// Test function to check if everything is connected
async function testConnection() {
  try {
    console.log("Testing server connection...");
    const response = await fetch('/api/test');
    console.log("Response received:", response);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Test successful:", data);
    alert("✅ Server connection works!");
  } catch (error) {
    console.error("Test failed:", error);
    alert("❌ Server connection failed: " + error.message);
  }
}

// Main function to generate show notes
async function generateShowNotes() {
  console.log("🤖 Starting show notes generation...");

  const transcript = document.getElementById('transcript').value;
  const tone = document.getElementById('tone').value || 'casual';
  const generateButton = document.getElementById('generateBtn');
  const outputDiv = document.getElementById('output');

  // Validation
  if (!transcript.trim()) {
    alert('Please enter a transcript');
    return;
  }

  if (transcript.trim().length < 10) {
    alert('Please enter a longer transcript (at least 10 characters)');
    return;
  }

  // Show loading state
  generateButton.disabled = true;
  generateButton.textContent = 'Generating...';
  outputDiv.innerHTML = '<p>🤖 Generating your show notes... Please wait!</p>';

  try {
    console.log("Making API request...");
    console.log("Transcript length:", transcript.length);
    console.log("Selected tone:", tone);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        transcript: transcript,
        tone: tone 
      })
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("API response:", data);

    if (data.success) {
      // Display the generated content
      outputDiv.innerHTML = `
        <div class="result">
          <h3>✅ Generated Show Notes:</h3>
          <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 5px;">${data.content}</pre>
          <small style="color: #666;">Tokens used: ${data.usage?.total_tokens || 'N/A'}</small>
        </div>
      `;
    } else {
      throw new Error(data.error || 'Unknown error occurred');
    }

  } catch (error) {
    console.error("Generation failed:", error);
    outputDiv.innerHTML = `
      <div class="error">
        <h3>❌ Generation Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><small>Check the console (F12) for more details.</small></p>
      </div>
    `;
  } finally {
    // Reset button
    generateButton.disabled = false;
    generateButton.textContent = 'Generate Show Notes';
  }
}

// Add sample transcript function
function loadSample() {
  const sampleText = `Welcome to the Indie Creator Podcast! Today we're talking about building your first online business. Many creators struggle with monetization, but the key is starting small and focusing on one revenue stream. I've helped hundreds of creators go from zero to their first thousand dollars in revenue. The biggest mistake I see is trying to do everything at once instead of mastering one thing first. Today I'll share three specific strategies that work for any creator, regardless of your niche.`;

  document.getElementById('transcript').value = sampleText;
  alert('✅ Sample transcript loaded! Now click Generate Show Notes.');
}
