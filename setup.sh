#!/bin/bash

# HebzConnect Complete Setup Script
# This script creates all remaining files for the project

cd "$(dirname "$0")"

echo "🚀 Creating HebzConnect files..."

# Create README
cat > README.md << 'EOF'
# HebzConnect - Remote Desktop Access

Professional remote desktop control application for computers, tablets, and mobile devices.

## Features

- 🖥️ Remote desktop control (mouse & keyboard)
- 📱 Progressive Web App (PWA) - works on all devices
- 🔒 Secure authentication with JWT
- 🌐 WebRTC peer-to-peer connection
- ⚡ Real-time screen streaming
- 📲 Installable on mobile, tablet, and desktop
- 🎨 Professional UI with HebzConnect branding

## Quick Start

### Web Application

1. Install dependencies:
```bash
cd web
npm install
```

2. Configure environment:
```bash
cp .env.local.example .env.local
# Edit .env.local with your Firebase credentials
```

3. Generate password hash:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
# Add the hash to .env.local as MASTER_PASSWORD_HASH
```

4. Run development server:
```bash
npm run dev
```

5. Deploy to Vercel:
```bash
npm run build
vercel --prod
```

### Desktop Agent

1. Install dependencies:
```bash
cd agent
npm install
```

2. Configure:
```bash
cp .env.example .env
# Edit .env with your Vercel URL
```

3. Build executable:
```bash
npm run build
# Output: dist/hebzconnect-agent.exe
```

4. Run on target PC:
```bash
./dist/hebzconnect-agent.exe
```

## Installation (PWA)

### Desktop (Chrome/Edge)
1. Visit your deployed site
2. Click install icon in address bar
3. Or Menu → Install HebzConnect

### Mobile (iOS)
1. Open in Safari
2. Tap Share button
3. Tap "Add to Home Screen"

### Mobile (Android)
1. Open in Chrome
2. Tap "Add to Home Screen" banner
3. Or Menu → Install app

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **PWA**: next-pwa, Service Workers
- **Real-time**: Firebase Realtime Database
- **P2P**: WebRTC (simple-peer)
- **Security**: JWT, bcryptjs
- **Desktop Agent**: Node.js, robotjs, screenshot-desktop

## Project Structure

```
hebzconnect/
├── web/                  # Web application (Vercel)
│   ├── pages/           # Next.js pages
│   ├── components/      # React components
│   ├── lib/             # Utilities
│   ├── public/          # Static files & PWA assets
│   └── styles/          # CSS files
└── agent/               # Desktop agent
    └── src/             # Agent source code
```

## Environment Variables

### Web (.env.local)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `JWT_SECRET`
- `MASTER_PASSWORD_HASH`

### Agent (.env)
- `SERVER_URL` - Your Vercel deployment URL
- `QUALITY` - Screen quality (high/medium/low)

## Security Notes

- Always use HTTPS in production
- Keep JWT_SECRET secure and random (32+ characters)
- Use strong master password
- Never commit .env files to git

## License

© 2024 Godmisoft. All rights reserved.

## Support

For issues or questions, contact support@godmisoft.com
EOF

echo "✅ README.md created"

# Create .gitignore
cat > web/.gitignore << 'EOF'
# Dependencies
node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build
/dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# PWA files
**/public/sw.js
**/public/workbox-*.js
**/public/worker-*.js
**/public/sw.js.map
**/public/workbox-*.js.map
**/public/worker-*.js.map
EOF

echo "✅ .gitignore created"

echo "✨ All setup files created!"
echo ""
echo "Next steps:"
echo "1. cd web && npm install"
echo "2. Configure .env.local with Firebase credentials"
echo "3. npm run dev"
