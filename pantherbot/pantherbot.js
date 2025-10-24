// === PantherBot v6 — EXTRA SMART with Context Awareness ===
// Updated: 2025-10-24 - Added schedule/grade context, enhanced intelligence

// Lazy-load both handbooks
let studentHandbook = null, athleticsHandbook = null;
let studentHandbookUrl = null, athleticsHandbookUrl = null;
let handbooksLoading = false;

// ===== PORTLEDGE KNOWLEDGE BASE =====
// Updated with inclement weather policy and dress code (Oct 2025)
const PORTLEDGE_KB = {
  bellSchedule: {
    regular: "School runs 8:20 AM - 3:30 PM. Classes are 50 minutes each.",
    earlyDismissal: "Early dismissal days end at 12:30 PM.",
    lateStart: "Late start days begin at 10:00 AM.",
    delayedOpening: "On delayed opening days, periods are shortened but all classes and advisories meet in their usual order. Middle and Upper School follow the myPortledge schedule. Lower School and Early Childhood report to Homeroom.",
    classDurations: "MONDAY: All classes are 40 minutes. TUESDAY-FRIDAY: Most classes are 50 minutes, some are 70 minutes (typically major subjects like lab sciences, language classes, or PE)."
  },
  
  weatherPolicy: {
    notification: "School closures announced by 6 AM via email, text, phone, website banner, myPortledge, and News12 Long Island.",
    snowDays: "After the first 'grace' snow day, instruction continues online for grades 1-12. Pre-Nursery through Kindergarten receive educational activities. Lower School uses Google Classroom (grades 1-5).",
    afterSchool: "If inclement weather expected after 3:30 PM, families notified by 12 PM about cancellation of after-school activities, athletics, and games.",
    transportation: "If your district bus is delayed but Portledge is not, call your district to confirm pickup. No academic penalty for bus-related lateness.",
    localWeather: "If unsafe to travel due to local neighborhood weather conditions, no academic penalty for absence. Teachers should notify directors if unable to attend due to local weather."
  },
  
  dressCode9to12: {
    regularDays: {
      allowed: "Collared shirts (short/long sleeve), dresses (mid-thigh+, no bare shoulders), sweaters/cardigans over collared shirts, solid pants (no jeans), skorts/skirts (mid-thigh+), solid Bermuda shorts, leggings only with above items, dress shoes/sneakers",
      prohibited: "Political clothing, torn clothing, transparent clothing, military imagery, violence/illegal content, outerwear without clasps"
    },
    friday: "Dress-down Fridays allow Portledge athletic gear and casual attire. Must be in good repair. NO hats, torn clothing, pajamas, military imagery, political clothing, violence imagery.",
    formal: {
      eveningPerformances: "Navy pants/skirt with white Portledge shirt/blouse and dress shoes",
      awards: "Business casual - blazers, ties, button-downs with dress pants OR collared blouses with skirts/dresses",
      graduation: "Navy blazer with white pants and Portledge tie OR white dress OR navy/white pantsuit"
    },
    pantherDen: "The Panther Den sells approved items but not all Panther Den items are dress-code compliant. Questions go to Dean of Students."
  },
  
  contactInfo: {
    address: "355 Duck Pond Road, Locust Valley, NY 11560",
    phone: "516.750.3100",
    website: "www.portledge.org"
  }
};

// ===== QUICK CHAT PROMPTS =====
// 50 randomized questions users can ask (shuffled on page load)
const QUICK_PROMPTS = [
  // Policies & Rules (15)
  "Can I use my phone during class?",
  "What's the academic integrity policy?",
  "What happens if I'm caught cheating?",
  "What's the attendance policy?",
  "How many absences are allowed?",
  "What's the tardy policy?",
  "Can I leave campus during lunch?",
  "What's the parking policy?",
  "What are the consequences for plagiarism?",
  "What's the social media policy?",
  "Can I use my laptop in class?",
  "What's the honor code?",
  "What happens if I'm late?",
  "What's the policy on outside food?",
  "Can I bring guests to school?",
  
  // Dress Code (10)
  "What can I wear on Friday?",
  "Can I wear jeans?",
  "What shoes are allowed?",
  "Can I wear shorts?",
  "What's the dress code for awards night?",
  "Can I wear leggings?",
  "What's dress-down Friday?",
  "Can I wear a hoodie?",
  "What should I wear to graduation?",
  "Are hats allowed?",
  
  // Academics (10)
  "What are school hours?",
  "How long are classes?",
  "How long are Monday classes?",
  "How long are classes on Tuesday?",
  "What's the GPA scale?",
  "How do I check my grades?",
  "What's the homework policy?",
  "Can I get extra help?",
  "What's the make-up work policy?",
  "How do I request a transcript?",
  "What are the graduation requirements?",
  "Can I drop a class?",
  
  // Athletics & Activities (8)
  "What sports are offered?",
  "How do I try out for a team?",
  "What's the athletic eligibility policy?",
  "Can I play multiple sports?",
  "What's the concussion protocol?",
  "What clubs are available?",
  "How do I start a new club?",
  "What's the PE uniform?",
  
  // Schedule & Logistics (9)
  "When is early dismissal?",
  "What happens on a snow day?",
  "When is late start?",
  "What's a delayed opening?",
  "How do I get to school?",
  "What time does school end?",
  "When are parent-teacher conferences?",
  "Why are Monday classes shorter?",
  "What's my schedule today?"
];

// Shuffle array utility
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get 6 random prompts for display
function getRandomPrompts(count = 6) {
  const shuffled = shuffleArray(QUICK_PROMPTS);
  return shuffled.slice(0, count);
}

// ===== CONTEXT GATHERING =====
// Extract student's current schedule, grades, and real-time info
function getStudentContext() {
  const context = {
    currentTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    currentDate: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    schedule: null,
    nextClass: null,
    currentClass: null,
    grades: null,
    recentActivity: null
  };
  
  try {
    // Get current/next class from the Next chip
    const nextUpText = document.getElementById('nextUpText')?.textContent;
    if (nextUpText && !nextUpText.includes('—')) {
      if (nextUpText.startsWith('Now:')) {
        context.currentClass = nextUpText.replace('Now: ', '');
      } else if (nextUpText.startsWith('Next:')) {
        context.nextClass = nextUpText.replace('Next: ', '');
      }
    }
    
    // Get today's full schedule from the timeline
    const timeline = document.getElementById('s_timeline');
    if (timeline) {
      const slots = timeline.querySelectorAll('.slot');
      const scheduleItems = [];
      slots.forEach(slot => {
        const className = slot.querySelector('.cls')?.textContent;
        const time = slot.querySelector('.time')?.textContent;
        const teacher = slot.querySelector('.teach')?.textContent;
        const room = slot.querySelector('.rm')?.textContent;
        if (className && time) {
          scheduleItems.push({
            class: className,
            time: time,
            teacher: teacher || '',
            room: room || '',
            status: slot.classList.contains('now') ? 'current' : 
                    slot.classList.contains('up') ? 'upcoming' : 
                    slot.classList.contains('done') ? 'completed' : 'scheduled'
          });
        }
      });
      if (scheduleItems.length > 0) {
        context.schedule = scheduleItems;
      }
    }
    
    // Get grades from the grades page
    const gradesContainer = document.getElementById('s_grades_list');
    if (gradesContainer) {
      const gradeCards = gradesContainer.querySelectorAll('.gcard');
      const gradesList = [];
      gradeCards.forEach(card => {
        const subject = card.querySelector('.gtitle')?.textContent;
        const grade = card.querySelector('.gbig')?.textContent;
        if (subject && grade) {
          gradesList.push({ subject, grade });
        }
      });
      if (gradesList.length > 0) {
        context.grades = gradesList;
      }
    }
  } catch (err) {
    console.error('Error gathering student context:', err);
  }
  
  return context;
}

// Format context into natural language for the AI
function formatContextForAI(context) {
  let text = `REAL-TIME STUDENT CONTEXT:\n`;
  text += `Current time: ${context.currentTime} on ${context.currentDate}\n\n`;
  
  if (context.currentClass) {
    text += `CURRENT CLASS: ${context.currentClass}\n`;
  }
  if (context.nextClass) {
    text += `NEXT CLASS: ${context.nextClass}\n`;
  }
  
  if (context.schedule && context.schedule.length > 0) {
    text += `\nTODAY'S SCHEDULE:\n`;
    context.schedule.forEach(item => {
      text += `  ${item.time} - ${item.class}`;
      if (item.teacher) text += ` (${item.teacher})`;
      if (item.room) text += ` [Room ${item.room}]`;
      text += ` [${item.status}]\n`;
    });
  }
  
  if (context.grades && context.grades.length > 0) {
    text += `\nCURRENT GRADES:\n`;
    context.grades.forEach(g => {
      text += `  ${g.subject}: ${g.grade}\n`;
    });
  }
  
  return text;
}

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
    athleticsHandbook = aModule.athleticsHandbookText || '';
  } catch (err) {
    console.error('Failed to load handbooks:', err);
    studentHandbook = athleticsHandbook = '';
  }
  handbooksLoading = false;
  return { studentHandbook, athleticsHandbook };
}

// ===== Fast retrieval - no citations needed =====
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
    while (CHUNKS_LOADING) await new Promise(r => setTimeout(r, 100));
    return ALL_CHUNKS || [];
  }
  
  CHUNKS_LOADING = true;
  
  try {
    const { studentHandbook, athleticsHandbook, studentHandbookUrl, athleticsHandbookUrl } = await loadHandbooks();
    const sParagraphs = studentHandbook.split(/\n\s*\n/g).filter(p => p && p.trim().length > 20);
    const aParagraphs = athleticsHandbook.split(/\n\s*\n/g).filter(p => p && p.trim().length > 20);
    const sJoined = sParagraphs.slice(0, 300).join('\n\n');
    const aJoined = aParagraphs.slice(0, 300).join('\n\n');
    const sChunks = chunkHandbook(sJoined, 'student', studentHandbookUrl);
    const aChunks = chunkHandbook(aJoined, 'athletics', athleticsHandbookUrl);
    ALL_CHUNKS = [...sChunks, ...aChunks];
  } catch (err) {
    console.error('Failed to chunk handbooks:', err);
    ALL_CHUNKS = [];
  } finally {
    CHUNKS_LOADING = false;
  }
  
  return ALL_CHUNKS;
}

async function getRelevantContext(userText, recentHistory, maxChars = 3500){
  const chunks = await getChunks();
  const allQueries = [userText, ...recentHistory.filter(m=>m.role==='user').map(m=>m.content)];
  const combinedQ = allQueries.join(' ');
  const qTokens = normalize(combinedQ);
  
  const ranked = chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(qTokens, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let out = '';
  for (const r of ranked){
    if ((out + "\n\n" + r.text).length > maxChars) break;
    out += (out ? "\n\n" : "") + r.text;
  }
  return out || "";
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
    // Refresh quick prompts with new random ones
    showQuickPrompts();
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
  // Reactions removed per request
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
    console.error('Missing DOM elements');
    return;
  }

  const userText = userInput.value.trim();
  if (!userText) return;

  if (handleSend.__pending) return;
  
  handleSend.__pending = true;
  
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
  }
  userInput.disabled = true;

  // Safety timeout - force re-enable after 20 seconds no matter what
  const safetyTimeout = setTimeout(() => {
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
    
    const historyMsgs = getRecentHistory(3);
    
    const context = await getRelevantContext(userText, historyMsgs, 3500).catch(err => {
      console.error('Context retrieval error:', err);
      return '';
    });
    
    // Gather real-time student context
    const studentContext = getStudentContext();
    const contextText = formatContextForAI(studentContext);
    
    const systemPrompt = `You are PantherBot, Portledge School's intelligent AI assistant with access to the student's REAL-TIME schedule and grades.

${contextText}

PORTLEDGE HANDBOOK KNOWLEDGE:
${context}

SCHEDULE TIMING RULES (CRITICAL):
• MONDAY: All classes are 40 minutes long
• TUESDAY-FRIDAY: Most classes are 50 minutes, some are 70 minutes (major subjects like lab sciences, languages, PE)
• When answering schedule questions, ALWAYS reference the REAL-TIME CONTEXT above which shows exact times
• For class duration questions, cite the Monday=40min, Tues-Fri=50/70min rule

INTELLIGENCE RULES:
- For "my next class" or "my schedule" questions → Use REAL-TIME CONTEXT above with exact times
- For "how long is class" or duration questions → Use SCHEDULE TIMING RULES (40min Monday, 50/70min Tues-Fri)
- For "my grades" or "how am I doing" questions → Reference their actual CURRENT GRADES
- For handbook/policy questions → Use PORTLEDGE HANDBOOK KNOWLEDGE
- Always consider current time and what's happening NOW

ANSWER STYLE:
- Match question complexity: Short Q = Short A (1-2 sentences), Complex Q = Detailed A
- When using student's real data, be SPECIFIC (exact times, class names, actual grades)
- Be conversational and helpful, use 1-2 emojis naturally

EXAMPLES:
❓ "What's my next class?" → Check NEXT CLASS and give specific answer with time
❓ "How am I doing in Math?" → Check CURRENT GRADES and give their actual grade
❓ "What are school hours?" → "School runs 8:20 AM - 3:30 PM."
❓ "How long are classes on Monday?" → "All Monday classes are 40 minutes."
❓ "How long are classes?" → "Monday classes are 40 minutes. Tuesday-Friday classes are 50 or 70 minutes."

You're not just a handbook - you're a SMART assistant who knows THIS student's live info!`;


    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);
    
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
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.3,
        frequency_penalty: 0.3
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      const text = await res.text();
      console.error('/api/chat error:', res.status, text);
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
    
    const related = generateRelatedQuestions(userText, reply);
    showRelatedQuestions(related);
    
  } catch (err) {
    console.error('PantherBot error:', err);
    
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
    // Clear safety timeout
    clearTimeout(safetyTimeout);
    
    // Always reset state
    handleSend.__pending = false;
    
    // Re-enable send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
    
    // Re-enable input
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
      } catch {}
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
  
  // Show quick prompts on load
  showQuickPrompts();
  
  loadHandbooks().then(() => getChunks());
}

// Display quick chat prompts
function showQuickPrompts() {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;
  
  // Clear existing prompts
  const existing = chatMessages.querySelector('.quick-prompts-container');
  if (existing) existing.remove();
  
  const container = document.createElement('div');
  container.className = 'quick-prompts-container';
  container.innerHTML = '<div class="quick-prompts-label">💡 Quick questions:</div>';
  
  const prompts = getRandomPrompts(6);
  prompts.forEach(prompt => {
    const btn = document.createElement('button');
    btn.className = 'quick-prompt-btn';
    btn.textContent = prompt;
    btn.addEventListener('click', () => {
      const input = document.getElementById('userInput');
      const send = document.getElementById('sendBtn');
      if (input && send) {
        input.value = prompt;
        send.click();
      }
    });
    container.appendChild(btn);
  });
  
  chatMessages.insertBefore(container, chatMessages.firstChild);
}

document.addEventListener('DOMContentLoaded', () => { loadHistory(); initPantherBot(); });
