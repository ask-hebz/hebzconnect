import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '../lib/firebase'; // Use existing Firebase app

const db = getDatabase(app);

export default function MobileViewer() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;
  
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [hasVideo, setHasVideo] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-8), `[${time}] ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    addLog('📱 Mobile Viewer Started');
    initSimpleConnection();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [targetPeerId, code]);

  const initSimpleConnection = async () => {
    try {
      const targetId = targetPeerId || code;
      addLog(`🔗 Connecting to: ${targetId}`);
      
      // Simple peer connection config with TURN for mobile
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // FREE TURN server for mobile NAT traversal
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });
      
      peerConnectionRef.current = pc;

      // Video track handler
      pc.ontrack = (event) => {
        addLog('📺 Video received!');
        if (videoRef.current && event.streams[0]) {
          addLog('🎬 Attaching stream...');
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().then(() => {
            addLog('✅ Playing video');
            setHasVideo(true);
            setConnected(true);
            setStatus('Connected');
          }).catch(err => {
            addLog('🔇 Trying muted...');
            videoRef.current.muted = true;
            videoRef.current.play().then(() => {
              addLog('✅ Video playing (muted)');
              setHasVideo(true);
              setConnected(true);
              setStatus('Connected');
            });
          });
        }
      };

      // Connection state
      pc.onconnectionstatechange = () => {
        addLog(`Connection: ${pc.connectionState}`);
        setStatus(pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnected(true);
        }
      };

      // Create offer
      addLog('📤 Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      
      await pc.setLocalDescription(offer);

      // Send via Firebase SDK (NOT HTTP) so the sharer's onValue() will trigger!
      addLog('📤 Sending offer via Firebase SDK');
      await set(ref(db, `signals/${targetId}/offer`), {
        signal: pc.localDescription.toJSON(),
        from: 'mobile-viewer',
        timestamp: Date.now()
      });
      
      addLog('📤 Offer sent');
      setStatus('Waiting for answer...');

      // Start ICE polling IMMEDIATELY (don't wait for answer)
      addLog('🔄 Starting ICE candidate polling...');
      pollForCandidates(pc, targetId);

      // Poll for answer
      pollForAnswer(pc, targetId);

      // Send our ICE candidates via Firebase SDK
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          set(ref(db, `signals/${targetId}/viewerCandidates/${Date.now()}`), {
            candidate: event.candidate.toJSON(),
            timestamp: Date.now()
          });
        }
      };

    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
      setStatus(`Error: ${error.message}`);
    }
  };

  const pollForAnswer = async (pc, targetId) => {
    const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      try {
        attempts++;
        addLog(`🔄 Polling answer (${attempts}/60)...`);
        
        const response = await fetch(`${firebaseUrl}/signals/${targetId}/answer.json`);
        const data = await response.json();
        
        if (data && data.signal && !pc.currentRemoteDescription) {
          addLog('📥 Answer received!');
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          addLog('✅ Answer set');
          return; // Stop polling
        }
        
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          addLog('❌ Timeout');
          setStatus('Timeout - no answer');
        }
      } catch (error) {
        addLog(`⚠️ Poll error: ${error.message}`);
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        }
      }
    };

    poll();
  };

  const pollForCandidates = async (pc, targetId) => {
    const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    let pollCount = 0;
    
    const poll = async () => {
      try {
        pollCount++;
        const response = await fetch(`${firebaseUrl}/signals/${targetId}/sharerCandidates.json`);
        const candidates = await response.json();
        
        if (candidates) {
          const count = Object.keys(candidates).length;
          if (count > 0) {
            addLog(`🧊 Found ${count} ICE candidates`);
          }
          
          for (const data of Object.values(candidates)) {
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                addLog(`✅ Added ICE candidate`);
              }
            } catch (err) {
              // Ignore duplicate candidates
            }
          }
        } else {
          if (pollCount % 5 === 0) {
            addLog(`⏳ No ICE candidates yet (poll ${pollCount})`);
          }
        }
        
        // Keep polling until we have video OR connection closes
        if (!hasVideo && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
          setTimeout(poll, 1000); // Poll every 1 second
        }
      } catch (error) {
        addLog(`⚠️ ICE poll error: ${error.message}`);
        if (!hasVideo && pc.connectionState !== 'closed') {
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    router.push('/dashboard');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <>
      <Head>
        <title>HebzConnect Mobile - Viewer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      
      <div className="min-h-screen bg-black">
        {/* Mobile Header */}
        <div className="bg-slate-900 p-3 flex items-center justify-between">
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium"
          >
            ← Exit
          </button>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-white text-xs font-medium">
              {connected ? 'Connected' : 'Connecting'}
            </span>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg"
          >
            ⛶
          </button>
        </div>

        {/* Video Container */}
        <div className="relative" style={{ height: 'calc(100vh - 56px)' }}>
          {/* Loading State */}
          {!hasVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white text-lg mb-2">{status}</p>
              
              {/* Debug Logs */}
              <div className="mt-8 bg-black/80 rounded-lg p-4 max-w-xs mx-auto">
                <div className="text-green-400 font-mono text-xs space-y-1">
                  {debugLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            style={{ display: hasVideo ? 'block' : 'none' }}
          />
          
          {/* Video Controls Overlay */}
          {hasVideo && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={toggleFullscreen}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Fullscreen
                </button>
                <button
                  onClick={disconnect}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
