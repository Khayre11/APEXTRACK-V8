# APEXTRACK — Deploy to iPhone in 10 Minutes

## What you need
- A free Vercel account (vercel.com)
- An Anthropic account with API key (console.anthropic.com) — ~$1-2/month usage

---

## Step 1 — Get your Anthropic API key
1. Go to console.anthropic.com
2. Sign up / log in
3. Click "API Keys" → "Create Key"
4. Copy the key (starts with `sk-ant-...`) — save it somewhere safe

---

## Step 2 — Deploy to Vercel
1. Go to vercel.com → Sign up free with GitHub or email
2. Click "Add New Project"
3. Click "Upload" (you don't need GitHub)
4. Drag the entire `apextrack-pwa` folder onto the upload area
5. Click Deploy
6. Wait ~60 seconds — you'll get a URL like `apextrack-abc123.vercel.app`

---

## Step 3 — Add your API key to Vercel
1. In your Vercel project, go to Settings → Environment Variables
2. Add a new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from Step 1
3. Click Save
4. Go to Deployments → click the 3 dots on your latest deploy → Redeploy

---

## Step 4 — Add to iPhone home screen
1. Open Safari on your iPhone (must be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the Share button (box with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add"
6. APEXTRACK icon now lives on your home screen — opens full screen like a real app

---

## Updating the app
When you want changes:
1. Chat with Claude, describe what you want
2. Download the updated App.jsx file Claude gives you
3. Replace `src/App.jsx` in your apextrack-pwa folder with the new file
4. Go to Vercel → drag the updated folder → redeploy
5. Done — update is live in ~60 seconds

---

## File structure
```
apextrack-pwa/
├── api/
│   └── coach.js        ← AI coach backend (holds API key securely)
├── public/
│   ├── index.html      ← PWA entry point
│   ├── manifest.json   ← App name, icon, display settings
│   ├── sw.js           ← Service worker (offline support)
│   ├── icon-192.png    ← App icon
│   └── icon-512.png    ← App icon (large)
├── src/
│   ├── App.jsx         ← The entire app (update this for new features)
│   └── index.js        ← Entry point
├── package.json
└── vercel.json
```

---

## Cost breakdown
- Vercel hosting: FREE
- Anthropic API: ~$0.003 per coach query
- At 10 queries/day: ~$1/month
- Apple Developer account (App Store): NOT needed for PWA

---

## Troubleshooting
- **AI coach not working**: Check Vercel → Settings → Environment Variables → make sure ANTHROPIC_API_KEY is set and you redeployed
- **Not installing on iPhone**: Must use Safari. Chrome on iOS doesn't support PWA install
- **App looks like a website**: Make sure you tapped "Add to Home Screen" and opened from the home screen icon, not Safari
