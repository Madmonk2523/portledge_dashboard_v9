// Vercel Serverless Function for OpenAI API
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure JSON body is available (Vercel may not parse automatically)
    let body = req.body;
    if (!body) {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { messages, max_tokens, temperature } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid messages array' });
    }

    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Call OpenAI API
    // Call OpenAI API with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: max_tokens || 100,
        temperature: temperature || 0.1
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    let data;
    const text = await response.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    const isAbort = error && (error.name === 'AbortError' || String(error.message || '').includes('aborted'));
    console.error('Server error:', error);
    return res.status(500).json({ error: isAbort ? 'Upstream timeout' : (error.message || 'Unknown server error') });
  }
}
