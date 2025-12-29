import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const snapshot = await get(ref(db, 'peers'));
    const peers = snapshot.val() || {};
    
    const now = Date.now();
    const onlinePeers = Object.entries(peers)
      .filter(([_, data]) => now - data.lastSeen < 30000)
      .map(([id, data]) => ({ id, ...data }));

    res.json({ peers: onlinePeers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
