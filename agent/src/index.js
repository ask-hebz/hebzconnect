require('dotenv').config();
const os = require('os');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = process.env.AGENT_ID || `PC-${os.hostname()}-${Date.now().toString(36)}`;

console.log('╔════════════════════════════════════╗');
console.log('║      HebzConnect Agent v1.0       ║');
console.log('╚════════════════════════════════════╝');
console.log('');
console.log('Agent ID:', AGENT_ID);
console.log('Hostname:', os.hostname());
console.log('Server:', SERVER_URL);
console.log('');

async function register() {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${SERVER_URL}/api/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'register',
        peerId: AGENT_ID,
        hostname: os.hostname()
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Registered successfully');
      return true;
    } else {
      console.error('❌ Registration failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    return false;
  }
}

async function start() {
  console.log('🚀 Starting agent...');
  console.log('');
  
  const success = await register();
  
  if (success) {
    console.log('📡 Agent is now online and visible in dashboard');
    console.log('');
    
    // Send heartbeat every 10 seconds
    setInterval(async () => {
      await register();
    }, 10000);
    
    console.log('✅ Agent running. Press Ctrl+C to stop.');
  } else {
    console.log('');
    console.log('⚠️  Failed to connect to server.');
    console.log('   Please check:');
    console.log('   1. SERVER_URL is correct in .env');
    console.log('   2. Server is running and accessible');
    console.log('   3. Internet connection is active');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Shutting down agent...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('👋 Shutting down agent...');
  process.exit(0);
});

start();
