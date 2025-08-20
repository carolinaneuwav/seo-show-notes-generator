
// frontend/script.js - WITH USAGE TRACKING
console.log("🚀 Script loaded successfully!");

// Usage Tracker Class
class UsageTracker {
  constructor() {
    this.maxFreeGenerations = 5;
    this.storageKey = 'showNotesUsage';
  }

  getUsage() {
    const usage = localStorage.getItem(this.storageKey);
    return usage ? JSON.parse(usage) : { count: 0, firstUse: null, isPaid: false };
  }

  canGenerate() {
    const usage = this.getUsage();
    return usage.isPaid || usage.count < this.maxFreeGenerations;
  }

  recordGeneration() {
    const usage = this.getUsage();
    if (!usage.firstUse) {
      usage.firstUse = new Date().toISOString();
    }
    usage.count += 1;
    localStorage.setItem(this.storageKey, JSON.stringify(usage));

    // Track milestone with Google Analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'usage_milestone', {
        'generation_count': usage.count,
        'is_paid': usage.isPaid
      });
    }
    
    return usage;
  }

  getRemainingGenerations() {
    const usage = this.getUsage();
    if (usage.isPaid) return 'Unlimited';
    return Math.max(0, this.maxFreeGenerations - usage.count);
  }

  showUpgradePrompt() {
    const remaining = this.getRemainingGenerations();
    if (remaining === 0) {
      this.displayUpgradeModal();
      return true;
    }
    return false;
  }

  displayUpgradeModal() {
    const modal = document.createElement('div');
    modal.className = 'upgrade-modal';
    modal.innerHTML = `
      <div class="upgrade-content">
        <h3>🚀 Ready to unlock unlimited show notes?</h3>
        <p>You've used all 5 free generations!</p>
        <div class="upgrade-options">
          <button class="upgrade-btn" onclick="window.open('mailto:upgrade@yourapp.com?subject=Creator Plan Upgrade', '_blank')">
            Upgrade to Creator Plan - €9/month
          </button>
          <button class="maybe-later-btn" onclick="this.closest('.upgrade-modal').remove()">
            Maybe Later
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    // Track upgrade prompt shown
    if (typeof gtag !== 'undefined') {
      gtag('event', 'upgrade_prompt_shown', {
        'trigger': 'limit_reached'
      });
    }
  }
}

// Initialize usage tracker
const usageTracker = new UsageTracker();

// Update usage display
function updateUsageDisplay(usage) {
  const remaining = usageTracker.getRemainingGenerations();
  let usageEl = document.getElementById('usage-display');
  
  if (!usageEl) {
    usageEl = document.createElement('div');
    usageEl.id = 'usage-display';
    usageEl.className = 'usage-display';
    
    // Insert before the generate button
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.parentNode.insertBefore(usageEl, generateBtn);
  }

  if (usage.isPaid) {
    usageEl.innerHTML = '✨ Unlimited generations';
    usageEl.className = 'usage-display premium';
  } else {
    usageEl.innerHTML = `${remaining} free generations remaining`;
    usageEl.className = remaining <= 2 ? 'usage-display warning' : 'usage-display';
  }
}

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

  // Check usage limits first
  if (!usageTracker.canGenerate()) {
    usageTracker.showUpgradePrompt();
    return;
  }

  const transcript = document.getElementById('transcript').value;
  const tone = document.getElementById('tone').value || 'casual';
  const contentType = document.getElementById('contentType').value || 'show-notes';
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
        tone: tone,
        contentType: contentType
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
      // Record the generation and update usage display
      const usage = usageTracker.recordGeneration();
      updateUsageDisplay(usage);
      
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

// Initialize usage display when page loads
document.addEventListener('DOMContentLoaded', function() {
  updateUsageDisplay(usageTracker.getUsage());
});

