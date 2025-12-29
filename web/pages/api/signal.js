export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { type, peerId, signal, targetId, hostname, code } = body;

    // Use fetch to interact with Firebase REST API directly
    const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    
    if (!firebaseUrl) {
      throw new Error('Firebase URL not configured');
    }

    switch(type) {
      case 'register': {
        const response = await fetch(`${firebaseUrl}/peers/${peerId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            online: true,
            lastSeen: Date.now(),
            hostname: hostname || 'Unknown PC',
            code: code || null
          })
        });
        
        if (!response.ok) {
          throw new Error('Firebase write failed');
        }
        
        return new Response(JSON.stringify({ success: true, peerId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'offer': {
        const response = await fetch(`${firebaseUrl}/signals/${targetId}/offer.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signal,
            from: peerId,
            timestamp: Date.now()
          })
        });
        
        if (!response.ok) {
          throw new Error('Firebase write failed');
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'answer': {
        const response = await fetch(`${firebaseUrl}/signals/${peerId}/answer.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signal,
            timestamp: Date.now()
          })
        });
        
        if (!response.ok) {
          throw new Error('Firebase write failed');
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Signal API Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
