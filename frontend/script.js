// ==========================
// Combined Show Notes Generator with Usage Tracking and Stripe Integration
// ==========================
console.log("🚀 Script loaded successfully!");

// --------------------------
// API Configuration
// --------------------------
const API_URL = "https://seo-show-notes-generator.vercel.app/"; // Empty = same domain as frontend on Vercel

// --------------------------
// Usage Tracker
// --------------------------
class UsageTracker {
  constructor() {
    this.storageKey = 'showNotesUsage';
    this.freeLimit = 5;
  }

  getCurrentUsage() {
    const usage = localStorage.getItem(this.storageKey);
    if (!usage) {
      return { count: 0, month: new Date().getMonth(), year: new Date().getFullYear(), firstUse: null, isPaid: false };
    }
    return JSON.parse(usage);
  }

  incrementUsage() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let usage = this.getCurrentUsage();

    if (usage.month !== currentMonth || usage.year !== currentYear) {
      usage = { count: 0, month: currentMonth, year: currentYear, firstUse: usage.firstUse || new Date().toISOString(), isPaid: usage.isPaid || false };
    }

    usage.count++;
    if (!usage.firstUse) usage.firstUse = new Date().toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(usage));
    return usage;
  }

  canGenerate() {
    const usage = this.getCurrentUsage();
    return usage.isPaid || usage.count < this.freeLimit;
  }

  getRemainingGenerations() {
    const usage = this.getCurrentUsage();
    if (usage.isPaid) return "Unlimited";
    return Math.max(0, this.freeLimit - usage.count);
  }

  setPaid() {
    const usage = this.getCurrentUsage();
    usage.isPaid = true;
    localStorage.setItem(this.storageKey, JSON.stringify(usage));
  }
}

const usageTracker = new UsageTracker();

// --------------------------
// Show Notes Exporter
// --------------------------
class ShowNotesExporter {
  constructor() {
    this.addExportButtons();
  }

  addExportButtons() {
    const exportHTML = `
      <div class="export-section">
        <h4>📥 Export Your Show Notes</h4>
        <button class="export-btn" onclick="showNotesExporter.exportTXT()">📄 Download TXT</button>
        <button class="export-btn" onclick="showNotesExporter.exportMarkdown()">📝 Download Markdown</button>
        <button class="export-btn" onclick="showNotesExporter.exportPDF()">📋 Download PDF</button>
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
    const preElement = document.getElementById("output")?.querySelector("pre");
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
    if (!showNotes) return alert("No show notes to export. Generate some first!");
    this.downloadFile(showNotes, "show-notes.txt", "text/plain");
  }

  exportMarkdown() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) return alert("No show notes to export. Generate some first!");
    this.downloadFile(showNotes, "show-notes.md", "text/markdown");
  }

  exportPDF() {
    const showNotes = this.getShowNotesContent();
    if (!showNotes) return alert("No show notes to export. Generate some first!");
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<pre>${showNotes}</pre>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }
}

const showNotesExporter = new ShowNotesExporter();

// --------------------------
// Generate Show Notes
// --------------------------
async function generateShowNotes() {
  if (!usageTracker.canGenerate()) {
    alert("⚠️ Free limit reached! Please upgrade to continue.");
    return;
  }

  const transcript = document.getElementById("transcript").value.trim();
  const tone = document.getElementById("tone").value || "casual";
  const contentType = document.getElementById("contentType").value || "show-notes";
  const generateBtn = document.getElementById("generateBtn");
  const outputDiv = document.getElementById("output");

  if (!transcript || transcript.length < 10) {
    return alert("Please enter a transcript of at least 10 characters.");
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  outputDiv.innerHTML = "<p>🤖 Generating your show notes...</p>";

  try {
    const response = await fetch(`${API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, tone, contentType })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();

    if (data.success) {
      usageTracker.incrementUsage();
      updateUsageDisplay();
      outputDiv.innerHTML = `<pre style="white-space: pre-wrap;">${data.content}</pre>`;
      document.dispatchEvent(new Event("results-generated"));
    } else {
      throw new Error(data.error || "Unknown error");
    }
  } catch (err) {
    console.error(err);
    outputDiv.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Show Notes";
  }
}

// --------------------------
// Usage Display
// --------------------------
function updateUsageDisplay() {
  const remaining = usageTracker.getRemainingGenerations();
  let usageEl = document.getElementById("usage-display");
  if (!usageEl) {
    usageEl = document.createElement("div");
    usageEl.id = "usage-display";
    const generateBtn = document.getElementById("generateBtn");
    generateBtn.parentNode.insertBefore(usageEl, generateBtn);
  }
  usageEl.innerHTML = (remaining === "Unlimited") ? "✨ Unlimited generations" : `${remaining} free generations remaining this month`;
}

// --------------------------
// Stripe Checkout (mock for now)
// --------------------------
async function subscribeTo(plan) {
  const priceIds = { creator: "price_creator_plan", pro: "price_pro_plan" };
  try {
    const response = await fetch(`${API_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planName: plan, priceId: priceIds[plan] })
    });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
  } catch (err) {
    console.error(err);
    alert("Something went wrong during checkout.");
  }
}

async function verifySubscription(sessionId) {
  try {
    const response = await fetch(`${API_URL}/api/verify-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    const data = await response.json();
    if (data.success) usageTracker.setPaid();
    updateUsageDisplay();
  } catch (err) { console.error(err); }
}

// --------------------------
// Load Sample Transcript
// --------------------------
function loadSample() {
  const sample = "Welcome to the Indie Creator Podcast! Today we're talking about building your first online business...";
  document.getElementById("transcript").value = sample;
  alert("✅ Sample transcript loaded! Click Generate Show Notes.");
}

// --------------------------
// Init
// --------------------------
document.addEventListener("DOMContentLoaded", () => {
  updateUsageDisplay();

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");
  if (sessionId) verifySubscription(sessionId);
});
