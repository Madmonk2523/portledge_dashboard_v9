// === PantherBot v3 — Fixed Send + Enter events ===
import { OPENAI_API_KEY } from "./apiKey.js";

// Lazy load handbook only when needed (handbook.js is 214KB!)
let handbookText = null;
let handbookLoading = false;
async function loadHandbook() {
  if (handbookText) return handbookText;
  if (handbookLoading) {
    // Wait for existing load to complete
    while (handbookLoading) await new Promise(r => setTimeout(r, 100));
    return handbookText;
  }
  handbookLoading = true;
  try {
    const module = await import("./handbook.js");
    handbookText = module.handbookText;
  } catch (err) {
    console.error("Failed to load handbook:", err);
    handbookText = "";
  }
  handbookLoading = false;
  return handbookText;
}


// ===== Lightweight local retrieval to minimize tokens =====
// Split handbook into small chunks and score them against the user's query.
// We then send ONLY the top few chunks to the model instead of the entire handbook.
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","about","is","are","was","were","be","as","by","it","that","this","at","from","your","you"
]);

function normalize(text){
  return (text||"")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w));
}

function chunkHandbook(text, chunkSize = 800, overlap = 100){
  const chunks = [];
  let i = 0;
  const maxChunks = 500; // Limit to prevent memory overflow
  while (i < text.length && chunks.length < maxChunks){
    const end = Math.min(text.length, i + chunkSize);
    const chunk = text.slice(i, end).trim();
    if (chunk) chunks.push(chunk);
    i += (chunkSize - overlap);
  }
  return chunks;
}

// Simple keyword overlap score
function scoreChunk(queryTokens, chunk){
  const tokens = normalize(chunk);
  if (!tokens.length) return 0;
  let score = 0;
  const set = new Set(tokens);
  for (const t of queryTokens){
    if (set.has(t)) score += 1;
  }
  // Prefer shorter chunks slightly
  return score + Math.min(0.5, 50 / (tokens.length + 1));
}

// Build chunks once and reuse (memoized)
let HB_CHUNKS = null;
async function getChunks(){
  if (!HB_CHUNKS){
    try {
      const text = await loadHandbook();
      if (!text || text.length < 100) {
        console.error("Handbook is empty or too short");
        HB_CHUNKS = [];
        return HB_CHUNKS;
      }
      // Split on paragraphs for better context
      const paragraphs = text.split(/\n\s*\n/g).filter(p => p && p.trim().length > 20);
      const joined = paragraphs.slice(0, 300).join("\n\n"); // Limit paragraphs to prevent overflow
      HB_CHUNKS = chunkHandbook(joined);
      console.log(`✅ Loaded ${HB_CHUNKS.length} chunks from handbook`);
    } catch (err) {
      console.error("Failed to chunk handbook:", err);
      HB_CHUNKS = [];
    }
  }
  return HB_CHUNKS;
}

async function getRelevantContext(userText, maxChars = 900){
  const chunks = await getChunks();
  const qTokens = normalize(userText);
  const ranked = chunks
    .map((c, idx) => ({ idx, c, s: scoreChunk(qTokens, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 2); // top 2 chunks for faster response

  // Concatenate while staying under maxChars
  let out = "";
  for (const r of ranked){
    if ((out + "\n\n" + r.c).length > maxChars) break;
    out += (out ? "\n\n" : "") + r.c;
  }
  return out || "";
}

function clampSentences(text, maxSentences = 3){
  const parts = (text||"").split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, maxSentences).join(" ");
}


function addMessage(role, text) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;
  const el = document.createElement("div");
  el.className = `chat-message ${role}`;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Minimal typing indicator that we can replace with the final answer
function showThinking() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return null;
  const el = document.createElement("div");
  el.className = "chat-message bot typing";
  el.textContent = "Thinking…"; // simple, lightweight indicator
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

async function handleSend() {
  const userInput = document.getElementById("userInput");
  const chatMessages = document.getElementById("chatMessages");
  if (!userInput || !chatMessages) return;

  const userText = userInput.value.trim();
  if (!userText) return;

  // Prevent duplicate requests and UI jank
  if (handleSend.__pending) return;
  handleSend.__pending = true;
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending..."; // Visual feedback
  }
  userInput.disabled = true;

  addMessage("user", userText);
  userInput.value = "";

  try {
  // Show a temporary typing indicator and replace it later
  const thinkingEl = showThinking();
  // Build a minimal context: short instruction + only relevant handbook excerpts
  const relevant = await getRelevantContext(userText);
  const context = `PantherBot. Answer in 1-2 sentences using handbook only.\n\n${relevant}`;

    // Abort if request takes too long
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    // Use Vercel serverless function if deployed, otherwise localhost
    const apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api/chat'
      : '/api/chat';
    
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: context },
          { role: "user", content: userText }
        ],
        max_tokens: 80,
        temperature: 0
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      console.error("/api/chat HTTP", res.status, text);
      throw new Error(`Server error ${res.status}: ${text}`);
    }
    const data = await res.json();

    let reply = null;
    if (data.choices && data.choices[0].message && data.choices[0].message.content) {
      reply = data.choices[0].message.content.trim();
    } else {
      reply = "Sorry, I couldn't find that in the handbook.";
    }

    if (thinkingEl) {
      thinkingEl.textContent = reply;
      thinkingEl.classList.remove('typing');
    } else {
      addMessage("bot", reply);
    }
  } catch (err) {
  console.error("PantherBot error:", err);
    const isAbort = (err && (err.name === 'AbortError' || err.message?.includes('aborted')));
    const msg = isAbort ? "Request timed out. Please try again." : `⚠️ Server error. ${err.message?.slice(0,140)}`;
    // If typing indicator exists, reuse it; else add a new message
    const chatMessages = document.getElementById("chatMessages");
    const lastTyping = chatMessages?.querySelector('.chat-message.bot.typing');
    if (lastTyping) {
      lastTyping.textContent = msg;
      lastTyping.classList.remove('typing');
    } else {
      addMessage("bot", msg);
    }
  }
  finally {
    handleSend.__pending = false;
    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send"; // Restore button text
    }
    const userInput = document.getElementById("userInput");
    if (userInput) {
      userInput.disabled = false;
      userInput.focus();
    }
  }
}


// === PantherBot DOM initializer ===
function initPantherBot() {
  const sendBtn = document.getElementById("sendBtn");
  const userInput = document.getElementById("userInput");
  if (!sendBtn || !userInput) {
    setTimeout(initPantherBot, 500);
    return;
  }
  
  sendBtn.onclick = handleSend;
  userInput.onkeypress = e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };
  // Preload handbook immediately for faster first response
  loadHandbook().then(() => getChunks());
}

document.addEventListener("DOMContentLoaded", initPantherBot);
