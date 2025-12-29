export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    
    if (!firebaseUrl) {
      throw new Error('Firebase URL not configured');
    }

    // Fetch peers using Firebase REST API
    const response = await fetch(`${firebaseUrl}/peers.json`);
    
    if (!response.ok) {
      throw new Error('Firebase read failed');
    }
    
    const peers = await response.json() || {};
    
    const now = Date.now();
    const onlinePeers = Object.entries(peers)
      .filter(([_, data]) => now - data.lastSeen < 30000)
      .map(([id, data]) => ({ id, ...data }));

    return new Response(JSON.stringify({ peers: onlinePeers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Peers API Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
