// === PantherBot v4  Citations, Related Questions, Dual Handbooks ===

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
async function getChunks(){
  if (!ALL_CHUNKS){
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
      console.error('Failed to chunk handbooks:', err);
      ALL_CHUNKS = [];
    }
  }
  return ALL_CHUNKS;
}

async function getRelevantContextWithCitations(userText, recentHistory, maxChars = 1500){
  const chunks = await getChunks();
  const allQueries = [userText, ...recentHistory.filter(m=>m.role==='user').map(m=>m.content)];
  const combinedQ = allQueries.join(' ');
  const qTokens = normalize(combinedQ);
  
  const ranked = chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(qTokens, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  let out = '';
  const citations = [];
  for (const r of ranked){
    if ((out + '\n\n' + r.text).length > maxChars) break;
    out += (out ? '\n\n' : '') + r.text;
    citations.push(r);
  }
  return { context: out || '', citations };
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
    addMessage('bot', ' Hi, I am PantherBot  your Portledge assistant. Ask me anything about school rules, athletics, dress code, or policies!');
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
  
  if (/dress code|uniform|attire/i.test(lower)) {
    suggestions.push('What are the consequences for dress code violations?', 'Can I wear sneakers?');
  }
  if (/attendance|absent|late/i.test(lower)) {
    suggestions.push('What happens if I am late to school?', 'How do I report an absence?');
  }
  if (/phone|device|electronic/i.test(lower)) {
    suggestions.push('When can I use my phone?', 'What is the policy on laptops in class?');
  }
  if (/sports|athletics|team|practice/i.test(lower)) {
    suggestions.push('What sports are offered?', 'How do I try out for a team?', 'What if I miss practice?');
  }
  if (/pe|physical education|gym/i.test(lower)) {
    suggestions.push('What is the PE uniform?', 'Can I be exempted from PE?');
  }
  if (/concussion|injury/i.test(lower)) {
    suggestions.push('What is the return-to-play protocol?', 'Who do I contact if I am injured?');
  }
  if (/grade|academic|homework/i.test(lower)) {
    suggestions.push('What are the academic eligibility requirements?', 'What is the homework policy?');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Tell me about school hours', 'What are the Portledge Pillars?');
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
  el.appendChild(span);
  el.appendChild(copy);
}

function addMessage(role, text) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;
  const el = document.createElement('div');
  el.className = chat-message ;
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
  if (!userInput || !chatMessages) return;

  const userText = userInput.value.trim();
  if (!userText) return;

  if (handleSend.__pending) return;
  handleSend.__pending = true;
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
  }
  userInput.disabled = true;

  addMessage('user', userText);
  userInput.value = '';

  try {
    const thinkingEl = showThinking();
    const historyMsgs = getRecentHistory(3);
    const { context, citations } = await getRelevantContextWithCitations(userText, historyMsgs, 1500);
    
    const systemPrompt = [
      'You are PantherBot, a friendly, knowledgeable assistant for Portledge students.',
      'Use the handbook excerpts below to answer. If the answer is not clearly supported, say you could not find it or ask a brief clarifying question.',
      'Respond in a conversational, natural tone. Keep it concise (25 short sentences) or use tight bullet points when listing steps.',
      'Avoid repeating the question or adding filler. Do not invent details outside the excerpts.',
      'If helpful, end with one short follow-up question.',
      '\nHandbook excerpts:\n\n' + context
    ].join(' ');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    const apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api/chat'
      : '/api/chat';
    
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
        max_tokens: 220,
        temperature: 0.35,
        presence_penalty: 0.15,
        frequency_penalty: 0.2
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      const text = await res.text();
      console.error('/api/chat HTTP', res.status, text);
      throw new Error(`Server error ${res.status}: ${text}`);
    }
    const data = await res.json();

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
    console.error('PantherBot error:', err);
    const isAbort = (err && (err.name === 'AbortError' || err.message?.includes('aborted')));
    const msg = isAbort ? 'Request timed out. Please try again.' : `⚠️ Server error. ${err.message?.slice(0,140)}`;
    const chatMessages = document.getElementById('chatMessages');
    const lastTyping = chatMessages?.querySelector('.chat-message.bot.typing');
    if (lastTyping) {
      if (lastTyping._ticker) { try { clearInterval(lastTyping._ticker); } catch{} }
      decorateBotMessageElement(lastTyping, msg);
    } else {
      addMessage('bot', msg);
    }
  } finally {
    handleSend.__pending = false;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
    const userInput = document.getElementById('userInput');
    if (userInput) {
      userInput.disabled = false;
      userInput.focus();
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
  
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn && !newChatBtn.__bound){
    newChatBtn.addEventListener('click', resetPantherBot);
    newChatBtn.__bound = true;
  }
  
  loadHandbooks().then(() => getChunks());
}

document.addEventListener('DOMContentLoaded', () => { loadHistory(); initPantherBot(); });
