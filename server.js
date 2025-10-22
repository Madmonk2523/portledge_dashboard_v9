// Simple Express server to proxy OpenAI API requests
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// OpenAI API proxy endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, max_tokens, temperature } = req.body;
    
    // Get API key from apiKey.js
    const apiKeyModule = await import('./pantherbot/apiKey.js');
    const API_KEY = apiKeyModule.OPENAI_API_KEY;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: max_tokens || 100,
        temperature: temperature || 0.1
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to connect to OpenAI' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📱 Open: http://localhost:${PORT}/main/index.html`);
});
