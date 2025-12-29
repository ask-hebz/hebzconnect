import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';

export default async function handler(req, res) {
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
