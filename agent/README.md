# HebzConnect Desktop Agent

This agent runs on target computers to enable remote access.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env - set SERVER_URL to your Vercel deployment
```

### 3. Run
```bash
npm start
```

### 4. Build Executable (Optional)
```bash
npm run build
# Output: dist/hebzconnect-agent.exe
```

## Auto-Start on Windows

1. Press `Win + R`
2. Type: `shell:startup`
3. Copy shortcut of `hebzconnect-agent.exe` to the folder

## Troubleshooting

**Agent not appearing in dashboard:**
- Check SERVER_URL is correct
- Verify server is running
- Check firewall settings
- Ensure internet connection

**Connection errors:**
- Server must be HTTPS (Vercel provides this)
- Check console for error messages

Powered by Godmisoft 🚀
