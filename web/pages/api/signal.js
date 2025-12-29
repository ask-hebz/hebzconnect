import { ref, set } from 'firebase/database';
import { db } from '../../lib/firebase';

export default async function handler(req, res) {
  const { type, peerId, signal, targetId, hostname, code } = req.body;

  try {
    switch(type) {
      case 'register':
        await set(ref(db, `peers/${peerId}`), {
          online: true,
          lastSeen: Date.now(),
          hostname: hostname || 'Unknown PC',
          code: code || null
        });
        res.json({ success: true, peerId });
        break;

      case 'offer':
        await set(ref(db, `signals/${targetId}/offer`), {
          signal,
          from: peerId,
          timestamp: Date.now()
        });
        res.json({ success: true });
        break;

      case 'answer':
        await set(ref(db, `signals/${peerId}/answer`), {
          signal,
          timestamp: Date.now()
        });
        res.json({ success: true });
        break;

      default:
        res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
