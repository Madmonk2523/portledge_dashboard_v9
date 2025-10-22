# Local Development

## Run Locally with Live Server + Python API:

1. **Start Python Server** (Terminal 1):
```bash
cd C:\Users\chase\OneDrive\Desktop\schoolappproject\portledge_dashboard_v9
python server.py
```

2. **Start Live Server** (VS Code):
   - Right-click `main/index.html`
   - Click "Open with Live Server"

3. **Test**:
   - Site opens at `http://127.0.0.1:5500/main/index.html`
   - PantherBot automatically uses `http://localhost:3000/api/chat`
   - Sign Out button works!

## Files Changed:

### ✅ `pantherbot/pantherbot.js`
- Auto-detects localhost vs Vercel
- Uses correct API endpoint for each environment

### ✅ `main/index.html`
- Fixed Sign Out button to use `addEventListener`
- Waits for DOM before attaching event

### ✅ `api/chat.js` (NEW)
- Vercel serverless function
- Proxies OpenAI API calls securely

### ✅ `vercel.json` (NEW)
- Configures Vercel routing and caching

### ✅ `.gitignore` (NEW)
- Protects API keys from being committed
