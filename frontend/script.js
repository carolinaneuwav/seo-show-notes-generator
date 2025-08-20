const API_URL = "https://7de06961-fb38-46ac-b5c3-4706b659d4e6-00-153eza3xvs88e.worf.replit.dev";

console.log("🚀 Script loaded successfully!");

// Usage Tracker Class
class UsageTracker {
  constructor() {
    this.maxFreeGenerations = 5;
    this.storageKey = "showNotesUsage";
  }

  getUsage() {
    const usage = localStorage.getItem(this.storageKey);
    return usage
      ? JSON.parse(usage)
      : { count: 0, firstUse: null, isPaid: false };
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

    if (typeof gtag !== "undefined") {
      gtag("event", "usage_milestone", {
        generation_count: usage.count,
        is_paid: usage.isPaid,
      });
    }

    return usage;
  }

  getRemainingGenerations() {
    const usage = this.getUsage();
    if (usage.isPaid) return "Unlimited";
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
    const modalHTML = `
      <div class="upgrade-modal">
        <div class="modal-content">
          <h2>🚀 Upgrade to Premium</h2>
          <p>You've used all your free generations! Upgrade for unlimited access.</p>
          <button class="upgrade-btn" onclick="window.open('https://your-payment-link.com', '_blank')">
            Upgrade Now - $9/month
          </button>
          <button class="close-btn" onclick="this.closest('.upgrade-modal').remove()">
            Maybe Later
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

// Export functionality
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
    this.downloadFile(showNotes, 'show-notes.txt', 'text/plain');
    if (typeof gtag !== "undefined") {
      gtag('event', 'export_downloaded', { 'format': 'txt' });
    }
  }

  exportMarkdown() {
    const showNotes = this.getShowNotesContent();
    this.downloadFile(showNotes, 'show-notes.md', 'text/markdown');
    if (typeof gtag !== "undefined") {
      gtag('event', 'export_downloaded', { 'format': 'markdown' });
    }
  }

  exportPDF() {
    const printWindow = window.open('', '_blank');
    const showNotes = this.getShowNotesContent();
    printWindow.document.write(`
      <html>
        <head><title>Show Notes</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <pre style="white-space: pre-wrap;">${showNotes}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    if (typeof gtag !== "undefined") {
      gtag('event', 'export_downloaded', { 'format': 'pdf' });
    }
  }
}

// Initialize classes
const usageTracker = new UsageTracker();
const showNotesExporter = new ShowNotesExporter();

// Main generation function
async function generateShowNotes() {
  console.log("🤖 Starting show notes generation...");

  if (!usageTracker.canGenerate()) {
    usageTracker.showUpgradePrompt();
    return;
  }

  const transcript = document.getElementById("transcript").value;
  const tone = document.getElementById("tone").value || "casual";
  const contentType = document.getElementById("contentType").value || "show-notes";
  const generateButton = document.getElementById("generateBtn");
  const outputDiv = document.getElementById("output");

  if (!transcript.trim()) {
    alert("Please enter a transcript");
    return;
  }

  if (transcript.trim().length < 10) {
    alert("Please enter a longer transcript (at least 10 characters)");
    return;
  }

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
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log("API response:", data);

    if (data.success) {
      const usage = usageTracker.recordGeneration();

      let displayContent = typeof data.content === 'string' ? data.content : data.content.raw;

      outputDiv.innerHTML = `
        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <strong>✅ Generated successfully!</strong>
          ${data.demo_mode ? '<span style="color: #ff6600;"> (Demo Mode - Add OpenAI key for full features)</span>' : ''}
          <br>Remaining free generations: ${usageTracker.getRemainingGenerations()}
          ${data.usage ? `<br>Tokens used: ${data.usage.total_tokens}` : ''}
        </div>
        <pre style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 8px;">${displayContent}</pre>
      `;

      document.dispatchEvent(new CustomEvent("results-generated"));

      if (typeof gtag !== "undefined") {
        gtag('event', 'generation_success', {
          'content_type': contentType,
          'tone': tone,
          'demo_mode': !!data.demo_mode
        });
      }
    } else {
      throw new Error(data.error || 'Unknown error occurred');
    }

  } catch (error) {
    console.error("Generation failed:", error);
    outputDiv.innerHTML = `
      <div style="background: #ffe6e6; padding: 15px; border-radius: 8px; color: #d8000c;">
        <strong>❌ Generation Failed</strong><br>
        Error: ${error.message}<br><br>
        Check the console (F12) for more details.
      </div>
    `;

    if (typeof gtag !== "undefined") {
      gtag('event', 'generation_error', {
        'error': error.message
      });
    }
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate Show Notes";
  }
}

// Test connection function
async function testConnection() {
  console.log("Testing server connection...");
  try {
    const response = await fetch(`${API_URL}/api/test`);
    console.log("Response received:", response.headers);

    const data = await response.json();
    console.log("Test successful:", data);

    alert(`✅ Connection successful!\nServer: ${data.message}\nOpenAI: ${data.openai_configured ? 'Configured' : 'Not configured'}`);
  } catch (error) {
    console.error("Test failed:", error);
    alert(`❌ Connection failed: ${error.message}`);
  }
}

// Load sample function
function loadSample() {
  const sampleTranscript = `Hey everyone, welcome back to the Creator Economy Podcast. I'm your host and today we're diving deep into monetizing your content as a creator. 

Now, I've been helping creators for the past five years, and I've helped hundreds of creators go from zero to their first thousand dollars in revenue. And today I want to share with you the three strategies that work no matter what your niche is.

The first strategy is focusing on one revenue stream. The biggest mistake I see is trying to do everything at once instead of mastering one thing first. Whether that's affiliate marketing, courses, or sponsored content - pick one and get really good at it.

The second strategy is starting small. You don't need to launch a $2000 course on day one. Start with a $29 digital product, validate your audience wants it, then scale up.

The third strategy is consistency over perfection. I see so many creators waiting for the perfect moment, the perfect content, the perfect launch. But the key is starting small and focusing on one revenue stream, then expanding from there.

Those are the three strategies that have worked for every single creator I've worked with. If you implement just these three things, you'll be well on your way to building a sustainable creator business.`;

  document.getElementById("transcript").value = sampleTranscript;
  alert("✅ Sample transcript loaded! Click 'Generate Show Notes' to see it in action.");
}

// Initialize usage display when page loads
document.addEventListener("DOMContentLoaded", function () {
  updateUsageDisplay(usageTracker.getUsage());
});

function updateUsageDisplay(usage) {
  const remaining = usageTracker.getRemainingGenerations();
  let usageEl = document.getElementById("usage-display");

  if (!usageEl) {
    usageEl = document.createElement("div");
    usageEl.id = "usage-display";
    usageEl.className = "usage-display";

    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn && generateBtn.parentNode) {
      generateBtn.parentNode.insertBefore(usageEl, generateBtn);
    } else {
      document.body.appendChild(usageEl); // Fallback if generateBtn not found
    }
  }

  if (usage.isPaid) {
    usageEl.innerHTML = "✨ Unlimited generations";
    usageEl.className = "usage-display premium";
  } else {
    usageEl.innerHTML = `${remaining} free generations remaining`;
    usageEl.className =
      remaining <= 2 ? "usage-display warning" : "usage-display";
  }
}