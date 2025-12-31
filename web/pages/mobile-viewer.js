import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '../lib/firebase';

const db = getDatabase(app);

export default function MobileViewer() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;

  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const pendingIce = useRef([]);

  const [hasStream, setHasStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [logs, setLogs] = useState([]);

  const log = (m) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logMsg = `[${timestamp}] ${m}`;
    console.log(logMsg);
    setLogs((l) => [...l.slice(-7), logMsg]);
  };

  useEffect(() => {
    if (!targetPeerId && !code) return;
    init();
    return () => pcRef.current?.close();
  }, [targetPeerId, code]);

  const init = async () => {
    try {
      const targetId = targetPeerId || code;
      log('📱 Mobile Viewer Started');
      log(`🔗 Connecting to: ${targetId}`);

      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceTransportPolicy: 'relay'
        // Removed bundlePolicy - it breaks mobile when no audio/data channel
      });

      pcRef.current = pc;

      // MOBILE-SAFE TRACK HANDLER (NO AUTOPLAY!)
      pc.ontrack = (e) => {
        log('📺 Track received');
        const video = videoRef.current;
        if (!video || !e.streams[0]) return;

        video.srcObject = e.streams[0];
        video.muted = true;
        video.playsInline = true;
        video.autoplay = false; // CRITICAL: Do NOT autoplay on mobile!

        setHasStream(true);
        setStatus('Tap to start video');
        log('✅ Video track ready - waiting for user tap');
      };

      // Debug states for Safari
      pc.oniceconnectionstatechange = () =>
        log(`🧊 ICE: ${pc.iceConnectionState}`);

      pc.onconnectionstatechange = () => {
        log(`🔗 Connection: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          log('✅ Connection established');
        }
      };

      // Send our ICE candidates
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        set(ref(db, `signals/${targetId}/viewerCandidates/${Date.now()}`), {
          candidate: e.candidate.toJSON(),
          timestamp: Date.now()
        }).catch(err => log(`❌ ICE send error: ${err.message}`));
      };

      // Create and send offer
      log('📤 Creating offer...');
      const offer = await pc.createOffer({ 
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      log('✅ Offer created');
      
      await pc.setLocalDescription(offer);
      log('✅ Local description set');

      log('📤 Sending offer via Firebase SDK');
      await set(ref(db, `signals/${targetId}/offer`), {
        signal: pc.localDescription.toJSON(),
        from: 'mobile-viewer',
        timestamp: Date.now()
      });
      
      log('✅ Offer sent successfully');
      setStatus('Waiting for answer...');
      
      // Start polling
      pollAnswer(pc, targetId);
      pollCandidates(pc, targetId);
    } catch (error) {
      log(`❌ INIT ERROR: ${error.message}`);
      log(`❌ Stack: ${error.stack}`);
      setStatus(`Error: ${error.message}`);
    }
  };

  // ANSWER POLLING WITH ICE QUEUE FLUSH
  const pollAnswer = async (pc, id) => {
    const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    
    try {
      const res = await fetch(`${url}/signals/${id}/answer.json`);
      const data = await res.json();

      if (!data?.signal) {
        setTimeout(() => pollAnswer(pc, id), 1200);
        return;
      }

      log('📥 Answer received!');
      await pc.setRemoteDescription(data.signal);
      log('✅ Answer set');
      setStatus('Connected - Waiting for video...'); // UPDATE STATUS!

      // FLUSH QUEUED ICE CANDIDATES
      if (pendingIce.current.length > 0) {
        log(`🧊 Flushing ${pendingIce.current.length} queued ICE candidates`);
        for (const c of pendingIce.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIce.current = [];
        log('✅ Queued ICE flushed');
      } else {
        log('ℹ️ No queued ICE candidates to flush');
      }
    } catch (err) {
      log(`❌ Error: ${err.message}`);
      setTimeout(() => pollAnswer(pc, id), 1200);
    }
  };

  // ICE CANDIDATE POLLING WITH QUEUEING
  const pollCandidates = async (pc, id) => {
    const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    
    try {
      const res = await fetch(`${url}/signals/${id}/sharerCandidates.json`);
      const data = await res.json();

      if (data) {
        const candidates = Object.values(data);
        
        if (candidates.length > 0) {
          for (const v of candidates) {
            if (pc.remoteDescription) {
              // Answer is set, add immediately
              await pc.addIceCandidate(new RTCIceCandidate(v.candidate));
            } else {
              // Queue until answer arrives
              if (!pendingIce.current.some(c => JSON.stringify(c) === JSON.stringify(v.candidate))) {
                pendingIce.current.push(v.candidate);
              }
            }
          }
          
          if (pc.remoteDescription) {
            log(`🧊 Added ${candidates.length} ICE candidates`);
          } else {
            log(`🧊 Queued ${pendingIce.current.length} ICE candidates (waiting for answer)`);
          }
        } else {
          log('⏳ No ICE candidates yet...');
        }
      } else {
        log('⏳ No ICE data in Firebase yet...');
      }
    } catch (err) {
      log(`⚠️ ICE poll error: ${err.message}`);
    }
    
    // Continue polling every 1.2 seconds
    setTimeout(() => pollCandidates(pc, id), 1200);
  };

  // USER GESTURE PLAYBACK (REQUIRED FOR MOBILE)
  const startPlayback = async () => {
    try {
      const video = videoRef.current;
      video.muted = true;
      await video.play();
      
      setConnected(true);
      setStatus('Connected - Video playing');
      log('▶️ Playback started by user');
    } catch (e) {
      log(`❌ Play failed: ${e.message}`);
      setStatus('Tap again to retry');
    }
  };

  // iOS-SAFE FULLSCREEN
  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen(); // iOS Safari
    }
    log('🖥️ Fullscreen toggled');
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Mobile Viewer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-black text-white relative">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-screen object-contain"
          playsInline
          muted
        />

        {/* TAP TO START OVERLAY (CRITICAL FOR MOBILE!) */}
        {hasStream && !connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="text-center space-y-6 px-6">
              <div className="text-6xl">📺</div>
              <h2 className="text-2xl font-bold">Video Ready!</h2>
              <p className="text-gray-400">Tap below to start viewing</p>
              <button
                onClick={startPlayback}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-xl font-semibold shadow-lg transform active:scale-95 transition"
              >
                ▶ Tap to Start Video
              </button>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
          >
            ← Exit
          </button>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-sm">{status}</span>
          </div>

          {connected && (
            <button
              onClick={toggleFullscreen}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
            >
              ⛶ Fullscreen
            </button>
          )}
        </div>

        {/* Debug Logs */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
          <div className="text-green-400 font-bold mb-2">📊 Debug Log:</div>
          {logs.map((l, i) => (
            <div key={i} className="text-green-300">{l}</div>
          ))}
        </div>
      </div>
    </>
  );
}
