# HebzConnect Installation Guide

## Complete Step-by-Step Setup

### Prerequisites
- Node.js 18+ installed
- Firebase account (free tier)
- Vercel account (free tier)
- Git installed

### Step 1: Extract Files
```bash
unzip hebzconnect-complete.zip
cd hebzconnect-complete
```

### Step 2: Setup Firebase
1. Go to https://console.firebase.google.com
2. Create new project: "HebzConnect"
3. Enable Realtime Database:
   - Go to "Realtime Database"
   - Click "Create Database"
   - Start in test mode
   - Copy database URL

4. Get your config:
   - Project Settings → General
   - Scroll to "Your apps"
   - Click Web app icon (</>) 
   - Register app: "HebzConnect Web"
   - Copy the firebaseConfig values

### Step 3: Configure Web App
```bash
cd web
cp .env.local.example .env.local
nano .env.local  # or use any text editor
```

Fill in your Firebase values:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hebzconnect.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://hebzconnect-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=hebzconnect

NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change after deployment

JWT_SECRET=your_random_32_character_secret_key_here
MASTER_PASSWORD_HASH=  # Generate below
```

### Step 4: Generate Password Hash
```bash
# Install bcryptjs temporarily
npm install bcryptjs

# Generate hash (replace 'your-password' with your actual password)
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"

# Copy the output and paste as MASTER_PASSWORD_HASH in .env.local
```

### Step 5: Install Dependencies
```bash
npm install
```

### Step 6: Test Locally
```bash
npm run dev
# Visit http://localhost:3000
# Login with the password you used in Step 4
```

### Step 7: Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Build and deploy
npm run build
vercel --prod

# Follow the prompts:
# - Link to existing project? No
# - Project name: hebzconnect
# - Directory: ./
```

### Step 8: Configure Vercel Environment Variables
1. Go to https://vercel.com/dashboard
2. Select your hebzconnect project
3. Go to Settings → Environment Variables
4. Add these variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `JWT_SECRET`
   - `MASTER_PASSWORD_HASH`

5. Redeploy: `vercel --prod`

### Step 9: Setup Desktop Agent
```bash
cd ../agent
cp .env.example .env
nano .env
```

Update with your Vercel URL:
```env
SERVER_URL=https://your-app.vercel.app
QUALITY=high
```

Install dependencies:
```bash
npm install
```

Build executable:
```bash
npm run build
# Output: dist/hebzconnect-agent.exe (Windows)
```

### Step 10: Deploy Agent
1. Copy `dist/hebzconnect-agent.exe` to target PC
2. Run the executable
3. (Optional) Add to Windows Startup:
   - Press `Win + R`
   - Type: `shell:startup`
   - Create shortcut to hebzconnect-agent.exe

### Testing
1. Run agent on target PC
2. Open web app: https://your-app.vercel.app
3. Login with your password
4. You should see the target PC in dashboard
5. Click to connect

## PWA Installation

### Desktop (Chrome/Edge/Brave)
1. Visit your deployed site
2. Look for install icon in address bar (⊕)
3. Click "Install HebzConnect"

### Mobile iOS (Safari)
1. Open site in Safari
2. Tap Share button (⬆️)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"

### Mobile Android (Chrome)
1. Visit site in Chrome
2. Tap banner "Add HebzConnect to Home screen"
3. Or: Menu (⋮) → "Install app"

## Troubleshooting

### Cannot connect to Firebase
- Check Firebase Database rules are set to test mode
- Verify all Firebase config values in .env.local
- Check Firebase console for errors

### Agent not showing in dashboard
- Ensure agent is running on target PC
- Check SERVER_URL matches your Vercel deployment
- Verify firewall isn't blocking connections
- Check Firebase Realtime Database for entries under `/peers`

### PWA not installing
- Must be served over HTTPS (Vercel provides this)
- Check manifest.json is accessible
- Clear browser cache and try again

### Connection fails between controller and agent
- Both need internet connection
- Some corporate firewalls block WebRTC
- Try different network if possible

## Security Recommendations

1. Use strong master password (16+ characters)
2. Keep JWT_SECRET truly random and secret
3. Never commit .env files to git
4. Regularly update dependencies: `npm update`
5. Enable Firebase security rules in production
6. Use Vercel's password protection for extra security

## Updating

### Web App
```bash
cd web
git pull  # if using git
npm install
vercel --prod
```

### Agent
```bash
cd agent
git pull
npm install
npm run build
# Replace exe on target PCs
```

## Support

For issues:
1. Check this installation guide
2. Review Firebase and Vercel logs
3. Test locally first: `npm run dev`
4. Contact: support@godmisoft.com

---
Powered by **Godmisoft** 🚀
