import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export default function RemoteControl() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    initConnection();

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [targetPeerId, code]);

  const initConnection = async () => {
    setStatus('Creating connection...');

    try {
      const targetId = targetPeerId || code;
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // CRITICAL: Handle incoming stream
      pc.ontrack = (event) => {
        console.log('📺 Track received:', event.streams[0]);
        setStatus('Screen sharing active');
        
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          
          // FORCE VIDEO TO PLAY
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => console.log('✅ Video playing!'))
                .catch(e => {
                  console.error('❌ Play failed:', e);
                  // Try unmuting and playing again
                  videoRef.current.muted = true;
                  videoRef.current.play().catch(err => console.error('Retry failed:', err));
                });
            }
          }, 100);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('Connected');
          setConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('Disconnected');
          setConnected(false);
        }
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          
          // Timeout after 3 seconds
          setTimeout(resolve, 3000);
        }
      });

      // Send offer
      setStatus('Sending connection request...');
      
      await fetch(`${firebaseUrl}/signals/${targetId}/offer.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal: pc.localDescription,
          from: 'controller-' + Date.now(),
          timestamp: Date.now()
        })
      });

      // Listen for answer
      const answerRef = ref(db, `signals/${targetId}/answer`);
      const unsubscribe = onValue(answerRef, async (snapshot) => {
        const data = snapshot.val();
        if (data && data.signal) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            console.log('✅ Answer set successfully');
            off(answerRef);
          } catch (error) {
            console.error('❌ Error setting answer:', error);
          }
        }
      });

    } catch (error) {
      setStatus('Connection failed: ' + error.message);
      console.error('Init error:', error);
    }
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    router.push('/dashboard');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Remote Control</title>
      </Head>
      <div className="min-h-screen bg-black" ref={containerRef}>
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={disconnect}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              ← Disconnect
            </button>
            
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-300">{status}</span>
            </div>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition-colors"
          >
            {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>

        {/* FIXED: Full screen video container */}
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
          {!connected ? (
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <p className="text-slate-400">{status}</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* FIXED: Full screen video with proper sizing */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ 
                  width: '100%', 
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain' 
                }}
                className="rounded-lg shadow-2xl bg-slate-900"
              />
              
              {/* Viewing indicator */}
              <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 pointer-events-none">
                <p className="text-white text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  🖥️ Viewing Remote Screen
                </p>
              </div>

              {/* Resolution info */}
              {videoRef.current?.videoWidth && (
                <div className="absolute bottom-6 right-6 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 pointer-events-none">
                  <p className="text-white text-xs font-mono">
                    {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
