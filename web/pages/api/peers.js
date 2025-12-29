export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import Firebase only when needed
    const { ref, get } = await import('firebase/database');
    const { db } = await import('../../lib/firebase');

    const snapshot = await get(ref(db, 'peers'));
    const peers = snapshot.val() || {};
    
    const now = Date.now();
    const onlinePeers = Object.entries(peers)
      .filter(([_, data]) => now - data.lastSeen < 30000)
      .map(([id, data]) => ({ id, ...data }));

    return res.status(200).json({ peers: onlinePeers });
  } catch (error) {
    console.error('Peers API Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
