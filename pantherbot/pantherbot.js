// === PantherBot v4 — Citations, Related Questions, Dual Handbooks ===
// Updated: 2025-10-23 - Fixed template literal bug
console.log('🔥 PantherBot v4.2 LOADED - MUCH SMARTER & MORE NATURAL! 🧠');

// Lazy-load both handbooks
let studentHandbook = null, athleticsHandbook = null;
let studentHandbookUrl = null, athleticsHandbookUrl = null;
let handbooksLoading = false;

async function loadHandbooks() {
  if (studentHandbook && athleticsHandbook) return { studentHandbook, athleticsHandbook, studentHandbookUrl, athleticsHandbookUrl };
  if (handbooksLoading) {
    while (handbooksLoading) await new Promise(r => setTimeout(r, 100));
    return { studentHandbook, athleticsHandbook, studentHandbookUrl, athleticsHandbookUrl };
  }
  handbooksLoading = true;
  try {
    const [hModule, aModule] = await Promise.all([
      import('./handbook.js'),
      import('./athleticsHandbook.js')
    ]);
    studentHandbook = hModule.handbookText || '';
    studentHandbookUrl = hModule.handbookDocUrl || '';
    athleticsHandbook = aModule.athleticsHandbookText || '';
    athleticsHandbookUrl = aModule.athleticsHandbookDocUrl || '';
    console.log(' Loaded student + athletics handbooks');
  } catch (err) {
    console.error('Failed to load handbooks:', err);
    studentHandbook = athleticsHandbook = '';
  }
  handbooksLoading = false;
  return { studentHandbook, athleticsHandbook, studentHandbookUrl, athleticsHandbookUrl };
}

// ===== Enhanced retrieval with citations =====
const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','about','is','are','was','were','be','as','by','it','that','this','at','from','your','you'
]);

function normalize(text){
  return (text||'')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w));
}

function chunkHandbook(text, source, docUrl, chunkSize = 800, overlap = 100){
  const chunks = [];
  let i = 0, chunkId = 0;
  const maxChunks = 500;
  while (i < text.length && chunks.length < maxChunks){
    const end = Math.min(text.length, i + chunkSize);
    const chunk = text.slice(i, end).trim();
    if (chunk) {
      chunks.push({
        id: `${source}-${chunkId++}`,
        text: chunk,
        source,
        docUrl
      });
    }
    i += (chunkSize - overlap);
  }
  return chunks;
}

function scoreChunk(queryTokens, chunk){
  const tokens = normalize(chunk);
  if (!tokens.length) return 0;
  let score = 0;
  const set = new Set(tokens);
  for (const t of queryTokens){
    if (set.has(t)) score += 1;
  }
  return score + Math.min(0.5, 50 / (tokens.length + 1));
}

let ALL_CHUNKS = null;
let CHUNKS_LOADING = false;

async function getChunks(){
  if (ALL_CHUNKS) return ALL_CHUNKS;
  
  if (CHUNKS_LOADING) {
    console.log('⏳ Waiting for chunks to load...');
    while (CHUNKS_LOADING) await new Promise(r => setTimeout(r, 100));
    return ALL_CHUNKS || [];
  }
  
  CHUNKS_LOADING = true;
  console.log('🔨 Building chunks...');
  
  try {
    const { studentHandbook, athleticsHandbook, studentHandbookUrl, athleticsHandbookUrl } = await loadHandbooks();
    const sParagraphs = studentHandbook.split(/\n\s*\n/g).filter(p => p && p.trim().length > 20);
    const aParagraphs = athleticsHandbook.split(/\n\s*\n/g).filter(p => p && p.trim().length > 20);
    const sJoined = sParagraphs.slice(0, 300).join('\n\n');
    const aJoined = aParagraphs.slice(0, 300).join('\n\n');
    const sChunks = chunkHandbook(sJoined, 'student', studentHandbookUrl);
    const aChunks = chunkHandbook(aJoined, 'athletics', athleticsHandbookUrl);
    ALL_CHUNKS = [...sChunks, ...aChunks];
    console.log(`✅ Built ${ALL_CHUNKS.length} chunks (${sChunks.length} student + ${aChunks.length} athletics)`);
  } catch (err) {
    console.error('❌ Failed to chunk handbooks:', err);
    ALL_CHUNKS = [];
  } finally {
    CHUNKS_LOADING = false;
  }
  
  return ALL_CHUNKS;
}

async function getRelevantContextWithCitations(userText, recentHistory, maxChars = 3500){
  const chunks = await getChunks();
  const allQueries = [userText, ...recentHistory.filter(m=>m.role==='user').map(m=>m.content)];
  const combinedQ = allQueries.join(' ');
  const qTokens = normalize(combinedQ);
  
  const ranked = chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(qTokens, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Increased from 8 to 10 for maximum coverage

  let out = '';
  const citations = [];
  for (const r of ranked){
    if ((out + "\n\n" + r.text).length > maxChars) break;
    out += (out ? "\n\n" : "") + r.text;
    citations.push(r);
  }
  return { context: out || "", citations };
}

// ===== Chat memory =====
const HISTORY_KEY = 'pd_pb_history_v1';
let chatHistory = [];

function loadHistory(){
  try { chatHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { chatHistory = []; }
}

function saveHistory(){
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory.slice(-40))); } catch{}
}

function addToHistory(role, content){
  if (!content) return;
  chatHistory.push({ role, content: String(content).slice(0, 2000) });
  saveHistory();
}

function getRecentHistory(maxPairs = 3){
  const msgs = [];
  for (let i = chatHistory.length - 1; i >= 0 && msgs.length < maxPairs * 2; i--){
    const m = chatHistory[i];
    if (m.role === 'user' || m.role === 'assistant') msgs.unshift(m);
  }
  return msgs;
}

function resetPantherBot(){
  chatHistory = [];
  saveHistory();
  const cm = document.getElementById('chatMessages');
  if (cm) {
    cm.innerHTML = '';
    addMessage('bot', '👋 Hey there! I\'m PantherBot, your friendly Portledge assistant. Ask me anything about:\n• School rules & policies 📚\n• Athletics & sports 🏀\n• Dress code 👕\n• Academic requirements 📝\n\nWhat can I help you with today?');
  }
}

function clampSentences(text, maxSentences = 3){
  const parts = (text||'').split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, maxSentences).join(' ');
}

// ===== Related questions =====
function generateRelatedQuestions(userText, botReply){
  const lower = (userText + ' ' + botReply).toLowerCase();
  const suggestions = [];
  
  // More comprehensive topic matching
  if (/dress code|uniform|attire|clothing|wear/i.test(lower)) {
    suggestions.push('What are the consequences for dress code violations?', 'What can I wear?', 'Is there a formal dress day?');
  }
  if (/attendance|absent|late|tardy|miss|skip/i.test(lower)) {
    suggestions.push('What happens if I\'m late?', 'How do I report an absence?', 'What\'s the attendance policy?');
  }
  if (/phone|device|electronic|laptop|ipad|computer|technology/i.test(lower)) {
    suggestions.push('When can I use my phone?', 'What devices are allowed?', 'Is there a technology policy?');
  }
  if (/sports|athletics|team|practice|game|coach/i.test(lower)) {
    suggestions.push('What sports are offered?', 'How do I try out?', 'What if I miss practice?');
  }
  if (/pe|physical education|gym|fitness/i.test(lower)) {
    suggestions.push('What is the PE uniform?', 'What are PE requirements?', 'Can I be exempted from PE?');
  }
  if (/concussion|injury|hurt|medical|health/i.test(lower)) {
    suggestions.push('What\'s the return-to-play protocol?', 'Who handles injuries?', 'What if I get hurt?');
  }
  if (/grade|academic|homework|assignment|test|exam/i.test(lower)) {
    suggestions.push('What are academic eligibility requirements?', 'What\'s the homework policy?', 'How is grading done?');
  }
  if (/lunch|food|cafeteria|meal|eat/i.test(lower)) {
    suggestions.push('What are lunch options?', 'Can I leave for lunch?', 'Is there a cafeteria?');
  }
  if (/parking|drive|car|vehicle|transportation/i.test(lower)) {
    suggestions.push('Can I drive to school?', 'Is there student parking?', 'What are transportation options?');
  }
  if (/hi|hello|hey|greet/i.test(lower)) {
    suggestions.push('What are school hours?', 'Tell me about dress code', 'What sports are available?');
  }
  
  // Default suggestions if nothing matches
  if (suggestions.length === 0) {
    suggestions.push('What are school hours?', 'Tell me about dress code', 'What sports are offered?');
  }
  
  return suggestions.slice(0, 3);
}

function showRelatedQuestions(questions){
  const container = document.getElementById('chatMessages');
  if (!container || !questions || questions.length === 0) return;
  
  const wrap = document.createElement('div');
  wrap.className = 'related-questions';
  wrap.innerHTML = '<div class=\"rq-label\">Related:</div>';
  
  questions.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'rq-btn';
    btn.textContent = q;
    btn.addEventListener('click', () => {
      const input = document.getElementById('userInput');
      const send = document.getElementById('sendBtn');
      if (input && send) {
        input.value = q;
        send.click();
      }
    });
    wrap.appendChild(btn);
  });
  
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

// ===== Citations display =====
function showCitations(citations){
  if (!citations || citations.length === 0) return;
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const wrap = document.createElement('div');
  wrap.className = 'citations';
  wrap.innerHTML = '<div class=\"cite-label\">Sources:</div>';
  
  citations.forEach((cite, idx) => {
    const link = document.createElement('a');
    link.className = 'cite-link';
    link.href = cite.docUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = [] ;
    link.title = cite.text.slice(0, 100) + '...';
    wrap.appendChild(link);
  });
  
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

// ===== Message helpers =====
function decorateBotMessageElement(el, text){
  while (el.firstChild) el.removeChild(el.firstChild);
  el.classList.remove('typing');
  const span = document.createElement('span');
  span.className = 'msg-text';
  span.textContent = text;
  const copy = document.createElement('button');
  copy.className = 'copy-btn';
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(span.textContent || '');
      const old = copy.textContent;
      copy.textContent = 'Copied!';
      setTimeout(()=> copy.textContent = old, 1000);
    } catch {}
  });
  
  // Add reaction buttons
  const reactions = document.createElement('span');
  reactions.className = 'reactions';
  reactions.style.cssText = 'margin-left: 12px; opacity: 0.7;';
  
  const thumbsUp = document.createElement('button');
  thumbsUp.className = 'reaction-btn';
  thumbsUp.textContent = '👍';
  thumbsUp.title = 'Helpful';
  thumbsUp.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 6px; opacity: 0.6; transition: all 0.2s;';
  thumbsUp.addEventListener('click', () => {
    thumbsUp.style.cssText += 'opacity: 1; transform: scale(1.3);';
    thumbsDown.style.opacity = '0.3';
    console.log('👍 Positive feedback:', text.slice(0, 50));
  });
  thumbsUp.addEventListener('mouseenter', () => thumbsUp.style.opacity = '1');
  thumbsUp.addEventListener('mouseleave', () => { if (!thumbsUp.style.transform.includes('scale')) thumbsUp.style.opacity = '0.6'; });
  
  const thumbsDown = document.createElement('button');
  thumbsDown.className = 'reaction-btn';
  thumbsDown.textContent = '👎';
  thumbsDown.title = 'Not helpful';
  thumbsDown.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 6px; opacity: 0.6; transition: all 0.2s;';
  thumbsDown.addEventListener('click', () => {
    thumbsDown.style.cssText += 'opacity: 1; transform: scale(1.3);';
    thumbsUp.style.opacity = '0.3';
    console.log('👎 Negative feedback:', text.slice(0, 50));
  });
  thumbsDown.addEventListener('mouseenter', () => thumbsDown.style.opacity = '1');
  thumbsDown.addEventListener('mouseleave', () => { if (!thumbsDown.style.transform.includes('scale')) thumbsDown.style.opacity = '0.6'; });
  
  reactions.appendChild(thumbsUp);
  reactions.appendChild(thumbsDown);
  
  el.appendChild(span);
  el.appendChild(copy);
  el.appendChild(reactions);
}

function addMessage(role, text) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;
  const el = document.createElement('div');
  el.className = `chat-message ${role}`;
  if (role === 'bot') {
    decorateBotMessageElement(el, text);
  } else {
    el.textContent = text;
  }
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (role === 'user') addToHistory('user', text);
  if (role === 'bot') addToHistory('assistant', text);
}

function showThinking() {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return null;
  const el = document.createElement('div');
  el.className = 'chat-message bot typing';
  el.textContent = 'Thinking';
  let tick = 0;
  el._ticker = setInterval(() => {
    tick = (tick + 1) % 4;
    el.textContent = 'Thinking' + '.'.repeat(tick);
  }, 400);
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

// ===== Main handler =====
async function handleSend() {
  const userInput = document.getElementById('userInput');
  const chatMessages = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('sendBtn');
  
  if (!userInput || !chatMessages) {
    console.error('❌ Missing DOM elements');
    return;
  }

  const userText = userInput.value.trim();
  if (!userText) return;

  if (handleSend.__pending) {
    console.log('⏸️ Already sending...');
    return;
  }
  
  handleSend.__pending = true;
  
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
  }
  userInput.disabled = true;

  // Safety timeout - force re-enable after 20 seconds no matter what
  const safetyTimeout = setTimeout(() => {
    console.warn('⚠️ Safety timeout triggered - forcing re-enable');
    handleSend.__pending = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
    if (userInput) {
      userInput.disabled = false;
    }
  }, 20000);

  addMessage('user', userText);
  userInput.value = '';

  try {
    const thinkingEl = showThinking();
    console.log('📝 User asked:', userText);
    
    const historyMsgs = getRecentHistory(3);
    console.log('🔍 Getting context...');
    
    const { context, citations } = await getRelevantContextWithCitations(userText, historyMsgs, 1500).catch(err => {
      console.error('Context retrieval error:', err);
      return { context: '', citations: [] };
    });
    
    console.log('✅ Got context, calling API...');
    
    const systemPrompt = `You are PantherBot, Portledge School's highly intelligent and helpful AI assistant. You're an expert on everything Portledge - from daily schedules to complex policies.

CORE MISSION:
Your job is to give THOROUGH, THOUGHTFUL, and COMPLETE answers. Never give up too easily. Always search carefully through the information provided.

PERSONALITY & TONE:
- Professional yet warm and approachable
- Confident when you have information, humble when you don't
- Use natural, conversational language
- Be enthusiastic about helping students succeed
- Use emojis sparingly but effectively (1-2 per response max)

HOW TO GIVE THOUGHTFUL ANSWERS:
1. **READ CAREFULLY**: Study ALL the handbook excerpts provided thoroughly
2. **SYNTHESIZE**: Combine related information from multiple sections
3. **BE SPECIFIC**: Give exact times, numbers, procedures - not vague answers
4. **ADD CONTEXT**: Explain WHY policies exist when relevant
5. **BE COMPLETE**: Don't leave out important details
6. **STRUCTURE**: Use bullet points for lists of 3+ items, otherwise use flowing sentences

EXAMPLES OF GREAT ANSWERS:

❌ BAD: "Classes start at 8:20 a.m."
✅ GOOD: "School runs from 8:20 a.m. to 3:30 p.m. Classes start at 8:20 a.m., so you should arrive a bit early to get settled. The buses leave promptly at 3:40 p.m. after classes end at 3:30 p.m. 📚"

❌ BAD: "I couldn't find information about PE uniforms."
✅ GOOD: "I don't see specific PE uniform details in the sections I have access to, but this would typically be covered in the athletics or dress code sections. I'd recommend checking with your PE teacher or the athletics office for the exact requirements. Want to know about the general dress code instead? 👕"

HANDLING GREETINGS:
- "hi/hello/hey" → Warm greeting + brief intro + "What can I help you with?"
- Be friendly but get to the point quickly

WHEN INFORMATION IS MISSING:
1. First, check if related information exists and share it
2. Suggest specific people/offices to contact
3. Offer to help with a related topic
4. NEVER just say "I don't know" without trying to be helpful

CRITICAL RULES:
- Base ALL factual claims on the handbook excerpts below
- If you're not 100% certain, say so
- Never make up policies, times, or procedures
- Always aim for completeness over brevity
- Think step-by-step before answering

HANDBOOK EXCERPTS (READ CAREFULLY):
${context}

Remember: Your goal is to give the MOST helpful, complete, and thoughtful answer possible. Take your time and be thorough!`;


    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.error('⏰ API timeout after 15s');
      controller.abort();
    }, 15000);
    
    const apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api/chat'
      : '/api/chat';
    
    console.log('🌐 API URL:', apiUrl);
    
    const shortHistory = historyMsgs.map(m=>({ role: m.role, content: clampSentences(m.content, 4) }));

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...shortHistory,
          { role: 'user', content: userText }
        ],
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.3,
        frequency_penalty: 0.3
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    console.log('📡 Response status:', res.status);
    
    if (!res.ok) {
      const text = await res.text();
      console.error('❌ /api/chat HTTP', res.status, text);
      throw new Error(`Server error ${res.status}: ${text}`);
    }
    const data = await res.json();
    console.log('✅ Got API response');

    let reply = 'Sorry, I could not find that in the handbook.';
    if (data.choices && data.choices[0].message && data.choices[0].message.content) {
      reply = data.choices[0].message.content.trim();
    }

    if (thinkingEl) {
      if (thinkingEl._ticker) { try { clearInterval(thinkingEl._ticker); } catch{} }
      decorateBotMessageElement(thinkingEl, reply);
      addToHistory('assistant', reply);
    } else {
      addMessage('bot', reply);
    }
    
    showCitations(citations);
    const related = generateRelatedQuestions(userText, reply);
    showRelatedQuestions(related);
    
  } catch (err) {
    console.error('❌ PantherBot error:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 3)
    });
    
    const isAbort = (err && (err.name === 'AbortError' || err.message?.includes('aborted')));
    const msg = isAbort ? 'Request timed out. Please try again.' : `⚠️ Error: ${err.message?.slice(0, 100)}`;
    const chatMessages = document.getElementById('chatMessages');
    const lastTyping = chatMessages?.querySelector('.chat-message.bot.typing');
    if (lastTyping) {
      if (lastTyping._ticker) { try { clearInterval(lastTyping._ticker); } catch{} }
      decorateBotMessageElement(lastTyping, msg);
    } else {
      addMessage('bot', msg);
    }
  } finally {
    console.log('🔓 Cleanup: Re-enabling input');
    
    // Clear safety timeout
    clearTimeout(safetyTimeout);
    
    // Always reset state
    handleSend.__pending = false;
    
    // Re-enable send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      console.log('✅ Send button re-enabled');
    } else {
      console.error('❌ Send button not found in cleanup');
    }
    
    // Re-enable input
    const userInput = document.getElementById('userInput');
    if (userInput) {
      userInput.disabled = false;
      userInput.focus();
      console.log('✅ Input re-enabled');
    } else {
      console.error('❌ Input not found in cleanup');
    }
  }
}

// ===== Init =====
function initPantherBot() {
  const sendBtn = document.getElementById('sendBtn');
  const userInput = document.getElementById('userInput');
  if (!sendBtn || !userInput) {
    setTimeout(initPantherBot, 500);
    return;
  }
  
  sendBtn.onclick = handleSend;
  userInput.onkeypress = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Add subtle character counter
  userInput.addEventListener('input', () => {
    const len = userInput.value.length;
    if (len > 100) {
      userInput.style.borderColor = '#f59e0b';
    } else {
      userInput.style.borderColor = '';
    }
  });
  
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn && !newChatBtn.__bound){
    newChatBtn.addEventListener('click', resetPantherBot);
    newChatBtn.__bound = true;
  }
  
  // Voice input
  const voiceBtn = document.getElementById('voiceBtn');
  if (voiceBtn && 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    voiceBtn.addEventListener('click', () => {
      voiceBtn.classList.add('listening');
      voiceBtn.textContent = '🔴';
      try {
        recognition.start();
      } catch (e) {
        console.log('Recognition already started');
      }
    });
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = transcript;
      voiceBtn.classList.remove('listening');
      voiceBtn.textContent = '🎤';
    };
    
    recognition.onerror = () => {
      voiceBtn.classList.remove('listening');
      voiceBtn.textContent = '🎤';
    };
    
    recognition.onend = () => {
      voiceBtn.classList.remove('listening');
      voiceBtn.textContent = '🎤';
    };
  } else if (voiceBtn) {
    voiceBtn.style.display = 'none';
  }
  
  loadHandbooks().then(() => getChunks());
}

document.addEventListener('DOMContentLoaded', () => { loadHistory(); initPantherBot(); });
