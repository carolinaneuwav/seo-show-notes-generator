// Combined Show Notes Generator with Usage Tracking and Stripe Integration
console.log("🚀 Script loaded successfully!");

// Configuration
const API_URL = "https://7de06961-fb38-46ac-b5c3-4706b659d4e6-00-153eza3xvs88e.worf.replit.dev";

// ==========================
// Usage tracking system
// ==========================
class UsageTracker {
  constructor() {
    this.storageKey = 'showNotesUsage';
    this.freeLimit = 5; // 5 free generations per month
    this.maxFreeGenerations = 5; // For backward compatibility
  }

  getCurrentUsage() {
    const usage = localStorage.getItem(this.storageKey);
    if (!usage) {
      return {
        count: 0,
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        firstUse: null,
        isPaid: false
      };
    }
    return JSON.parse(usage);
  }

  getUsage() {
    return this.getCurrentUsage();
  }

  incrementUsage() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let usage = this.getCurrentUsage();

    // Reset if new month
    if (usage.month !== currentMonth || usage.year !== currentYear) {
      usage = {
        count: 0,
        month: currentMonth,
        year: currentYear,
        firstUse: usage.firstUse || new Date().toISOString(),
        isPaid: usage.isPaid || false
      };
    }

    usage.count++;
    if (!usage.firstUse) {
      usage.firstUse = new Date().toISOString();
    }

    localStorage.setItem(this.storageKey, JSON.stringify(usage));

    // Track milestone with Google Analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "usage_milestone", {
        generation_count: usage.count,
        is_paid: usage.isPaid,
      });
    }

    return usage;
  }

  recordGeneration() {
    return this.incrementUsage();
  }

  canGenerate() {
    const usage = this.getCurrentUsage();
    const isSubscribed = this.isUserSubscribed();
    return isSubscribed || usage.isPaid || usage.count < this.freeLimit;
  }

  getRemainingGenerations() {
    const usage = this.getCurrentUsage();
    if (usage.isPaid || this.isUserSubscribed()) return "Unlimited";
    return Math.max(0, this.freeLimit - usage.count);
  }

  isUserSubscribed() {
    const subscription = localStorage.getItem('userSubscription');
    if (!subscription) return false;

    const subData = JSON.parse(subscription);
    return subData.status === 'active' && subData.current_period_end > Date.now() / 1000;
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
    showUpgradeModal();
  }
}

// ==========================
// Export functionality
// ==========================
class ShowNotesExporter {
  constructor() {
    this.addExportButtons();
  }

  addExportButtons() {
    const exportHTML = `
      <div class="export-section">
        <h4>📥 Export Your Show Notes</h4>
        <div class="export-buttons">
          <button class="export-btn" onclick="showNotesExporter.exportTXT()">📄 Download TXT</button>
          <button class="export-btn" onclick="showNotesExporter.exportMarkdown()">📝 Download Markdown</button>
          <button class="export-btn" onclick="showNotesExporter.exportPDF()">📋 Download PDF</button>
        </div>
      </div>
    `;

    // Listen for when results are generated
    document.addEventListener("results-generated", () => {
      const outputDiv = document.getElementById("output");
      if (outputDiv && !outputDiv.querySelector(".export-section")) {
        outputDiv.insertAdjacentHTML("beforeend", exportHTML);
      }
    });
  }

  getShowNotesContent() {
    const outputDiv = document.getElementById("output");
    const preElement = outputDiv?.querySelector("pre");
    return preElement ? preElement.textContent : "";
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  exportTXT() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) {
      alert("No show notes to export. Generate some first!");
      return;
    }
    this.downloadFile(showNotes, "show-notes.txt", "text/plain");

    if (typeof gtag !== "undefined") {
      gtag("event", "export_downloaded", { format: "txt" });
    }
  }

  exportMarkdown() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) {
      alert("No show notes to export. Generate some first!");
      return;
    }
    this.downloadFile(showNotes, "show-notes.md", "text/markdown");

    if (typeof gtag !== "undefined") {
      gtag("event", "export_downloaded", { format: "markdown" });
    }
  }

  exportPDF() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) {
      alert("No show notes to export. Generate some first!");
      return;
    }

    // Create a new window with the show notes content for printing
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Show Notes</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
          pre { white-space: pre-wrap; font-family: inherit; }
          h1, h2, h3 { color: #333; }
        </style>
      </head>
      <body>
        <pre>${showNotes}</pre>
      </body>
      </html>
    `);
    printWindow.document.close();

    // Wait for content to load, then trigger print dialog
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    if (typeof gtag !== "undefined") {
      gtag("event", "export_downloaded", { format: "pdf" });
    }
  }
}

// Initialize classes
const usageTracker = new UsageTracker();
const showNotesExporter = new ShowNotesExporter();

// ==========================
// Main generation function
// ==========================
async function generateShowNotes() {
  console.log("🤖 Starting show notes generation...");

  // Check usage limits first
  if (!usageTracker.canGenerate()) {
    usageTracker.showUpgradePrompt();
    return;
  }

  const transcript = document.getElementById("transcript").value;
  const tone = document.getElementById("tone").value || "casual";
  const contentType = document.getElementById("contentType").value || "show-notes";
  const generateButton = document.getElementById("generateBtn");
  const outputDiv = document.getElementById("output");

  // Validation
  if (!transcript.trim()) {
    alert("Please enter a transcript");
    return;
  }

  if (transcript.trim().length < 10) {
    alert("Please enter a longer transcript (at least 10 characters)");
    return;
  }

  // Show loading state
  generateButton.disabled = true;
  generateButton.textContent = "Generating...";
  outputDiv.innerHTML = "<p>🤖 Generating your show notes... Please wait!</p>";

  try {
    console.log("Making API request...");
    console.log("Transcript length:", transcript.length);
    console.log("Selected tone:", tone);

    const response = await fetch(`${API_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: transcript,
        tone: tone,
        contentType: contentType,
      }),
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
          <small style="color: #666;">Tokens used: ${data.usage?.total_tokens || "N/A"}</small>
        </div>
      `;

      // Trigger event for export buttons
      document.dispatchEvent(new Event("results-generated"));
    } else {
      throw new Error(data.error || "Unknown error occurred");
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
    generateButton.textContent = "Generate Show Notes";
  }
}

// ==========================
// UI Updates
// ==========================
function updateUsageDisplay(usage) {
  const remaining = usageTracker.getRemainingGenerations();
  let usageEl = document.getElementById("usage-display");

  if (!usageEl) {
    usageEl = document.createElement("div");
    usageEl.id = "usage-display";
    usageEl.className = "usage-display";

    // Insert before the generate button
    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn) {
      generateBtn.parentNode.insertBefore(usageEl, generateBtn);
    }
  }

  if (usage && (usage.isPaid || usageTracker.isUserSubscribed())) {
    usageEl.innerHTML = "✨ Unlimited generations";
    usageEl.className = "usage-display premium";
  } else {
    usageEl.innerHTML = `${remaining} free generations remaining this month`;
    usageEl.className = remaining <= 2 ? "usage-display warning" : "usage-display";
  }
}

// ==========================
// Upgrade Modal
// ==========================
function showUpgradeModal() {
  closeModal();

  const modal = document.createElement('div');
  modal.className = 'upgrade-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()"></div>
    <div class="modal-content">
      <h3>🚀 Ready to unlock unlimited show notes?</h3>
      <p>You've used all 5 free generations this month! Upgrade to continue creating amazing content.</p>
      <div class="modal-buttons">
        <button onclick="subscribeTo('creator')" class="btn-primary">
          Creator Plan - €9/month
        </button>
        <button onclick="subscribeTo('pro')" class="btn-secondary">
          Pro Plan - €15/month
        </button>
        <button onclick="closeModal()" class="btn-cancel">
          Maybe Later
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Track upgrade prompt shown
  if (typeof gtag !== "undefined") {
    gtag("event", "upgrade_prompt_shown", {
      trigger: "limit_reached",
    });
  }
}

function closeModal() {
  const modal = document.querySelector('.upgrade-modal');
  if (modal) modal.remove();
}

// ==========================
// Stripe Subscriptions
// ==========================
async function subscribeTo(plan) {
  const priceIds = {
    creator: process.env.CREATOR_PRICE_ID || 'price_creator_plan_id', // 🔑 replace with real Stripe price IDs
    pro: process.env.PRO_PRICE_ID || 'price_pro_plan_id'
  };

  try {
    const response = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: priceIds[plan],
        planName: plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan'
      }),
    });

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('Something went wrong. Please try again.');
  }
}

// ==========================
// Subscription Verification
// ==========================
async function verifySubscription(sessionId) {
  try {
    const response = await fetch(`${API_URL}/verify-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const data = await response.json();
    if (data.success) {
      localStorage.setItem('userSubscription', JSON.stringify(data.subscription));
      updateUsageDisplay(usageTracker.getUsage());
      alert('Subscription activated! You now have unlimited generations.');
    }
  } catch (error) {
    console.error('Error verifying subscription:', error);
  }
}

// ==========================
// Utility Functions
// ==========================
// Test function to check if everything is connected
async function testConnection() {
  try {
    console.log("Testing server connection...");
    const response = await fetch(`${API_URL}/api/test`);
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

// Add sample transcript function
function loadSample() {
  const sampleText = `Welcome to the Indie Creator Podcast! Today we're talking about building your first online business. Many creators struggle with monetization, but the key is starting small and focusing on one revenue stream. I've helped hundreds of creators go from zero to their first thousand dollars in revenue. The biggest mistake I see is trying to do everything at once instead of mastering one thing first. Today I'll share three specific strategies that work for any creator, regardless of your niche.`;

  document.getElementById("transcript").value = sampleText;
  alert("✅ Sample transcript loaded! Now click Generate Show Notes.");
}

// ==========================
// Init on page load
// ==========================
document.addEventListener('DOMContentLoaded', function() {
  updateUsageDisplay(usageTracker.getUsage());

  // Check for successful Stripe checkout
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  if (sessionId) {
    verifySubscription(sessionId);
  }
});