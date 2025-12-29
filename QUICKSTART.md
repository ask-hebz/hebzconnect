# 🚀 HebzConnect - Quick Start Guide

Get HebzConnect running in 10 minutes!

## ⚡ Step 1: Setup Firebase (5 minutes)

1. Go to https://console.firebase.google.com
2. Click "Add project" → Name it "HebzConnect" → Continue
3. Disable Google Analytics → Create project
4. In left menu: Build → Realtime Database → Create Database
5. Choose location → Start in **test mode** → Enable
6. Copy your database URL (looks like: `https://hebzconnect-xxxxx.firebaseio.com`)
7. Go to Project Settings (⚙️ icon) → General tab
8. Scroll to "Your apps" → Click Web icon `</>`
9. App nickname: "HebzConnect Web" → Register app
10. Copy all the config values (apiKey, authDomain, etc.)

## 🔐 Step 2: Generate Secrets (2 minutes)

### JWT_SECRET
Visit: https://generate-random.org/api-token-generator
- Set length: 64
- Click "Generate"
- Copy the result

### Password Hash
Visit: https://bcrypt-generator.com/
- Type your desired password (e.g., "heber123")
- Cost: 10
- Click "Generate Hash"
- Copy the hash (starts with `$2a$10$`)
- **REMEMBER YOUR PASSWORD!**

## 📦 Step 3: Deploy to Vercel (3 minutes)

1. Extract `hebzconnect-complete.zip`
2. Open terminal in the `web` folder
3. Run:
```bash
npm install
```

4. Deploy:
```bash
npx vercel
```

Follow prompts:
- Setup and deploy? **Y**
- Which scope? (select your account)
- Link to existing project? **N**
- Project name? **hebzconnect**
- Directory? **./** (press Enter)
- Override settings? **N**

5. After deployment, go to: https://vercel.com/dashboard
6. Select your project → Settings → Environment Variables
7. Add these variables (one by one):

```
NEXT_PUBLIC_FIREBASE_API_KEY = (your Firebase apiKey)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = (your Firebase authDomain)
NEXT_PUBLIC_FIREBASE_DATABASE_URL = (your Firebase databaseURL)
NEXT_PUBLIC_FIREBASE_PROJECT_ID = (your Firebase projectId)
JWT_SECRET = (generated from step 2)
MASTER_PASSWORD_HASH = (generated from step 2)
```

8. Go to Deployments → Click latest → Redeploy

## 🖥️ Step 4: Setup Agent (Optional)

```bash
cd agent
npm install
cp .env.example .env
```

Edit `.env`:
```
SERVER_URL=https://your-app.vercel.app
```

Run:
```bash
npm start
```

## ✅ Test It!

1. Visit: `https://your-app.vercel.app`
2. Login with the password from Step 2
3. If agent is running, you'll see it in dashboard!

---

**Need help?** See `SETUP-GUIDE.md` for detailed instructions.

Powered by **Godmisoft** 🚀
