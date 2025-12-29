# HebzConnect Complete Setup Guide

## Prerequisites
- Node.js 18+
- Firebase account (free)
- Vercel account (free)

## Step 1: Firebase Setup

1. Go to https://console.firebase.google.com
2. Create project: "HebzConnect"
3. Enable Realtime Database (test mode)
4. Get credentials:
   - Project Settings → General
   - Your apps → Web app
   - Copy config values

## Step 2: Generate Secrets

### JWT_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Or visit: https://generate-random.org/api-token-generator

### MASTER_PASSWORD_HASH
```bash
# Type your password (e.g., "heber123")
node -e "console.log(require('bcryptjs').hashSync('heber123', 10))"
```
Or visit: https://bcrypt-generator.com/

## Step 3: Configure Environment

```bash
cd web
cp .env.local.example .env.local
nano .env.local
```

Fill in all values from Steps 1 & 2.

## Step 4: Deploy

```bash
npm install
npm run build
vercel --prod
```

## Step 5: Set Vercel Environment Variables

Dashboard → Settings → Environment Variables:
- Add all values from .env.local
- Redeploy

## Step 6: Setup Agent

```bash
cd agent
npm install
npm run build
# Copy dist/hebzconnect-agent.exe to target PC
```

## Testing

1. Run agent on target PC
2. Visit your Vercel URL
3. Login with your password
4. Connect to PC

Done! 🎉
