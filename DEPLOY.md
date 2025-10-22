# Portledge Dashboard - Vercel Deployment Guide

## ✅ Fixed Issues:
1. **Sign Out Button** - Now uses proper event listener
2. **PantherBot Send Button** - Works on both localhost and Vercel

## 🚀 How to Deploy to Vercel:

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add Vercel support"
git push
```

### Step 2: Add Environment Variable in Vercel
1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project → **Settings** → **Environment Variables**
3. Add new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (from `pantherbot/apiKey.js`)
   - **Environment:** Production, Preview, Development (select all)
4. Click **Save**

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**

## ✨ How It Works:

- **Localhost:** PantherBot calls `http://localhost:3000/api/chat` (your Python server)
- **Vercel:** PantherBot calls `/api/chat` (serverless function at `api/chat.js`)
- **Sign Out:** Fixed to use `addEventListener` instead of `onclick`

## 🧪 Test After Deployment:

1. Visit your Vercel URL
2. Login with the student email
3. Click **Sign Out** button - should reload page ✅
4. Login again and open PantherBot
5. Type "hi" and click **Send** - should get a response ✅

---

**Need help?** Check the Vercel deployment logs if PantherBot doesn't work.
