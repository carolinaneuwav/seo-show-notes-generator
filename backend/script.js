// Replit-Optimized Show Notes Generator with Usage Tracking and Stripe Integration
console.log("🚀 Script loaded successfully!");

// Configuration - Auto-detect Replit URL
const getApiUrl = () => {
  // In Replit, use the current origin
  if (window.location.hostname.includes('replit.dev') || window.location.hostname.includes('replit.co')) {
    return window.location.origin;
  }
  // Fallback to your hardcoded URL for development
  return "https://7de06961-fb38-46ac-b5c3-4706b659d4e6-00-153eza3xvs88e.worf.replit.dev";
};

const API_URL = getApiUrl();
console.log("🔗 API URL:", API_URL);

// ==========================
// Replit-compatible storage system
// ==========================
class ReplicStorage {
  constructor() {
    this.memoryStorage = new Map();
    this.useLocalStorage = this.checkLocalStorageSupport();
    console.log("💾 Storage mode:", this.useLocalStorage ? "localStorage" : "memory");
  }

  checkLocalStorageSupport() {
    try {
      const testKey = '__replit_storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('⚠️ localStorage not available in this environment, using memory storage');
      return false;
    }
  }

  getItem(key) {
    try {
      if (this.useLocalStorage) {
        return localStorage.getItem(key);
      }
      return this.memoryStorage.get(key) || null;
    } catch (e) {
      console.warn('Storage getItem failed:', e);
      return this.memoryStorage.get(key) || null;
    }
  }

  setItem(key, value) {
    try {
      if (this.useLocalStorage) {
        localStorage.setItem(key, value);
      }
      this.memoryStorage.set(key, value);
    } catch (e) {
      console.warn('Storage setItem failed:', e);
      this.memoryStorage.set(key, value);
    }
  }

  removeItem(key) {
    try {
      if (this.useLocalStorage) {
        localStorage.removeItem(key);
      }
      this.memoryStorage.delete(key);
    } catch (e) {
      console.warn('Storage removeItem failed:', e);
      this.memoryStorage.delete(key);
    }
  }
}

// Initialize storage
const storage = new ReplicStorage();

// ==========================
// Usage tracking system (Replit-optimized)
// ==========================
class UsageTracker {
  constructor() {
    this.storageKey = 'showNotesUsage';
    this.freeLimit = 5; // 5 free generations per month
    this.maxFreeGenerations = 5; // For backward compatibility
  }

  getCurrentUsage() {
    const usage = storage.getItem(this.storageKey);
    if (!usage) {
      return this.createDefaultUsage();
    }

    try {
      return JSON.parse(usage);
    } catch (e) {
      console.warn('Error parsing usage data:', e);
      return this.createDefaultUsage();
    }
  }

  createDefaultUsage() {
    return {
      count: 0,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      firstUse: null,
      isPaid: false
    };
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

    storage.setItem(this.storageKey, JSON.stringify(usage));

    // Track milestone with Google Analytics (with error handling)
    if (typeof gtag !== "undefined") {
      try {
        gtag("event", "usage_milestone", {
          generation_count: usage.count,
          is_paid: usage.isPaid,
        });
      } catch (e) {
        console.warn('Analytics tracking failed:', e);
      }
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
    const subscription = storage.getItem('userSubscription');
    if (!subscription) return false;

    try {
      const subData = JSON.parse(subscription);
      return subData.status === 'active' && subData.current_period_end > Date.now() / 1000;
    } catch (e) {
      console.warn('Error parsing subscription data:', e);
      return false;
    }
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
// Export functionality (Replit-optimized)
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
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Download failed. Please try copying the text manually.');
    }
  }

  exportTXT() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) {
      alert("No show notes to export. Generate some first!");
      return;
    }
    this.downloadFile(showNotes, "show-notes.txt", "text/plain");

    // Analytics tracking with error handling
    if (typeof gtag !== "undefined") {
      try {
        gtag("event", "export_downloaded", { format: "txt" });
      } catch (e) {
        console.warn('Analytics tracking failed:', e);
      }
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
      try {
        gtag("event", "export_downloaded", { format: "markdown" });
      } catch (e) {
        console.warn('Analytics tracking failed:', e);
      }
    }
  }

  exportPDF() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) {
      alert("No show notes to export. Generate some first!");
      return;
    }

    try {
      // Create a new window with the show notes content for printing
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Show Notes</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
            pre { white-space: pre-wrap; font-family: inherit; }
            h1, h2, h3 { color: #333; }
            @media print {
              body { margin: 20px; }
            }
          </style>
        </head>
        <body>
          <pre>${showNotes.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for content to load, then trigger print dialog
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
        }, 500);
      }, 250);
    } catch (e) {
      console.error('PDF export failed:', e);
      alert('PDF export failed. Please try copying the text and printing manually.');
    }

    if (typeof gtag !== "undefined") {
      try {
        gtag("event", "export_downloaded", { format: "pdf" });
      } catch (e) {
        console.warn('Analytics tracking failed:', e);
      }
    }
  }
}

// Initialize classes
const usageTracker = new UsageTracker();
const showNotesExporter = new ShowNotesExporter();

// ==========================
// Main generation function (Replit-optimized)
// ==========================
async function generateShowNotes() {
  console.log("🤖 Starting show notes generation...");

  // Check usage limits first
  if (!usageTracker.canGenerate()) {
    usageTracker.showUpgradePrompt();
    return;
  }

  const transcript = document.getElementById("transcript")?.value;
  const tone = document.getElementById("tone")?.value || "casual";
  const contentType = document.getElementById("contentType")?.value || "show-notes";
  const generateButton = document.getElementById("generateBtn");
  const outputDiv = document.getElementById("output");

  // Enhanced validation
  if (!transcript || !transcript.trim()) {
    alert("Please enter a transcript");
    return;
  }

  if (transcript.trim().length < 10) {
    alert("Please enter a longer transcript (at least 10 characters)");
    return;
  }

  // Show loading state
  if (generateButton) {
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";
  }

  if (outputDiv) {
    outputDiv.innerHTML = "<p>🤖 Generating your show notes... Please wait!</p>";
  }

  try {
    console.log("Making API request to:", `${API_URL}/api/generate`);
    console.log("Transcript length:", transcript.length);
    console.log("Selected tone:", tone);

    const requestBody = {
      transcript: transcript.trim(),
      tone: tone,
      contentType: contentType,
    };

    const response = await fetch(`${API_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("API response:", data);

    if (data.success && data.content) {
      // Record the generation and update usage display
      const usage = usageTracker.recordGeneration();
      updateUsageDisplay(usage);

      // Display the generated content
      if (outputDiv) {
        outputDiv.innerHTML = `
          <div class="result">
            <h3>✅ Generated Show Notes:</h3>
            <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #e9ecef; overflow-wrap: break-word;">${data.content}</pre>
            <small style="color: #666; margin-top: 10px; display: block;">Tokens used: ${data.usage?.total_tokens || "N/A"}</small>
          </div>
        `;

        // Trigger event for export buttons
        document.dispatchEvent(new Event("results-generated"));
      }
    } else {
      throw new Error(data.error || "No content generated");
    }
  } catch (error) {
    console.error("Generation failed:", error);
    if (outputDiv) {
      outputDiv.innerHTML = `
        <div class="error" style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; border: 1px solid #f5c6cb;">
          <h3>❌ Generation Failed</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><small>Check the browser console (F12) for more details.</small></p>
          <p><small>API URL: ${API_URL}</small></p>
        </div>
      `;
    }
  } finally {
    // Reset button
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.textContent = "Generate Show Notes";
    }
  }
}

// ==========================
// UI Updates (Replit-optimized)
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
    if (generateBtn && generateBtn.parentNode) {
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
// Upgrade Modal (Replit-optimized)
// ==========================
function showUpgradeModal() {
  closeModal();

  const modal = document.createElement('div');
  modal.className = 'upgrade-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()"></div>
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
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
    try {
      gtag("event", "upgrade_prompt_shown", {
        trigger: "limit_reached",
      });
    } catch (e) {
      console.warn('Analytics tracking failed:', e);
    }
  }
}

function closeModal() {
  const modal = document.querySelector('.upgrade-modal');
  if (modal) {
    modal.remove();
  }
}

// ==========================
// Stripe Subscriptions (Replit-optimized)
// ==========================
async function subscribeTo(plan) {
  // In Replit, environment variables are accessed differently
  const priceIds = {
    creator: 'price_creator_plan_id', // Replace with actual Stripe price IDs
    pro: 'price_pro_plan_id'
  };

  try {
    const response = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        priceId: priceIds[plan],
        planName: plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    } else {
      throw new Error('No checkout URL received');
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('Something went wrong. Please try again or contact support.');
  }
}

// ==========================
// Subscription Verification (Replit-optimized)
// ==========================
async function verifySubscription(sessionId) {
  try {
    const response = await fetch(`${API_URL}/verify-subscription`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      storage.setItem('userSubscription', JSON.stringify(data.subscription));
      updateUsageDisplay(usageTracker.getUsage());
      alert('Subscription activated! You now have unlimited generations.');
    }
  } catch (error) {
    console.error('Error verifying subscription:', error);
    alert('There was an issue verifying your subscription. Please contact support.');
  }
}

// ==========================
// Utility Functions (Replit-optimized)
// ==========================
// Test function to check if everything is connected
async function testConnection() {
  try {
    console.log("Testing server connection to:", `${API_URL}/api/test`);
    const response = await fetch(`${API_URL}/api/test`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log("Response received:", response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Test successful:", data);
    alert("✅ Server connection works! Response: " + JSON.stringify(data));
  } catch (error) {
    console.error("Test failed:", error);
    alert("❌ Server connection failed: " + error.message + "\nAPI URL: " + API_URL);
  }
}

// Add sample transcript function
function loadSample() {
  const sampleText = `Welcome to the Indie Creator Podcast! Today we're talking about building your first online business. Many creators struggle with monetization, but the key is starting small and focusing on one revenue stream. I've helped hundreds of creators go from zero to their first thousand dollars in revenue. The biggest mistake I see is trying to do everything at once instead of mastering one thing first. Today I'll share three specific strategies that work for any creator, regardless of your niche.`;

  const transcriptEl = document.getElementById("transcript");
  if (transcriptEl) {
    transcriptEl.value = sampleText;
    alert("✅ Sample transcript loaded! Now click Generate Show Notes.");
  } else {
    alert("❌ Transcript field not found. Please check your HTML.");
  }
}

// ==========================
// Initialize on page load (Replit-optimized)
// ==========================
function initializeApp() {
  console.log("🚀 Initializing Show Notes Generator...");

  // Update usage display
  updateUsageDisplay(usageTracker.getUsage());

  // Check for successful Stripe checkout
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      console.log("Found session ID, verifying subscription...");
      verifySubscription(sessionId);
    }
  } catch (e) {
    console.warn('Error checking URL parameters:', e);
  }

  // Add event listeners
  const generateBtn = document.getElementById("generateBtn");
  if (generateBtn) {
    generateBtn.addEventListener('click', generateShowNotes);
  }

  console.log("✅ App initialized successfully!");
}

// Multiple initialization strategies for Replit
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded
  initializeApp();
}

// Also try after a short delay as fallback
setTimeout(initializeApp, 100);

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

// Make functions available globally for HTML onclick handlers
window.generateShowNotes = generateShowNotes;
window.loadSample = loadSample;
window.testConnection = testConnection;
window.closeModal = closeModal;
window.subscribeTo = subscribeTo;
window.showNotesExporter = showNotesExporter;