export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import Firebase only when needed
    const { ref, set } = await import('firebase/database');
    const { db } = await import('../../lib/firebase');

    const { type, peerId, signal, targetId, hostname, code } = req.body;

    switch(type) {
      case 'register':
        await set(ref(db, `peers/${peerId}`), {
          online: true,
          lastSeen: Date.now(),
          hostname: hostname || 'Unknown PC',
          code: code || null
        });
        return res.status(200).json({ success: true, peerId });

      case 'offer':
        await set(ref(db, `signals/${targetId}/offer`), {
          signal,
          from: peerId,
          timestamp: Date.now()
        });
        return res.status(200).json({ success: true });

      case 'answer':
        await set(ref(db, `signals/${peerId}/answer`), {
          signal,
          timestamp: Date.now()
        });
        return res.status(200).json({ success: true });

      default:
        return res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    console.error('Signal API Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
