import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ref, onValue, off, set } from 'firebase/database';
import { db } from '../lib/firebase';

export default function RemoteControl() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    console.log('🚀 Starting remote viewer');
    initConnection();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      cleanup();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [targetPeerId, code]);

  const cleanup = () => {
    console.log('🧹 Cleanup');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    pendingCandidatesRef.current = [];
  };

  const initConnection = async () => {
    try {
      const targetId = targetPeerId || code;
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

      console.log('🔧 Creating peer connection');
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // CRITICAL: Track handling like Google Meet
      pc.ontrack = (event) => {
        console.log('📺 Track received');
        const stream = event.streams[0];
        
        if (videoRef.current && stream) {
          console.log('🎬 Attaching stream to video');
          videoRef.current.srcObject = stream;
          
          // Force play immediately
          videoRef.current.play().catch(e => {
            console.log('Retrying with muted');
            videoRef.current.muted = true;
            videoRef.current.play();
          });
          
          setHasVideo(true);
        }
      };

      // ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate');
          set(ref(db, `signals/${targetId}/viewerCandidates/${Date.now()}`), {
            candidate: event.candidate.toJSON(),
            timestamp: Date.now()
          });
        }
      };

      // Connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection:', pc.connectionState);
        setStatus(pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setConnected(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnected(false);
          setHasVideo(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE:', pc.iceConnectionState);
      };

      // Create offer
      console.log('📤 Creating offer');
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      
      await pc.setLocalDescription(offer);

      // Send offer immediately (don't wait for ICE)
      console.log('📤 Sending offer');
      await set(ref(db, `signals/${targetId}/offer`), {
        signal: pc.localDescription.toJSON(),
        from: 'viewer-' + Date.now(),
        timestamp: Date.now()
      });

      setStatus('Waiting for answer...');
      console.log('👂 Listening for answer at path:', `signals/${targetId}/answer`);

      // Detect mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('🔍 Device:', isMobile ? 'MOBILE' : 'DESKTOP');

      if (isMobile) {
        // MOBILE: Use HTTP polling (more reliable)
        console.log('📱 Using HTTP polling for mobile');
        const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds
        
        const pollForAnswer = async () => {
          try {
            attempts++;
            console.log(`🔄 Poll attempt ${attempts}/${maxAttempts}`);
            
            const response = await fetch(`${firebaseUrl}/signals/${targetId}/answer.json`);
            const data = await response.json();
            
            if (data && data.signal) {
              console.log('📥 Answer received via polling!');
              
              if (!pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                console.log('✅ Remote description set');
                
                // Process pending ICE candidates
                for (const candidate of pendingCandidatesRef.current) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
                pendingCandidatesRef.current = [];
              }
            } else if (attempts < maxAttempts) {
              // Poll again in 1 second
              setTimeout(pollForAnswer, 1000);
            } else {
              console.error('❌ Timeout waiting for answer');
              setStatus('Connection timeout');
            }
          } catch (error) {
            console.error('❌ Polling error:', error);
            if (attempts < maxAttempts) {
              setTimeout(pollForAnswer, 1000);
            }
          }
        };
        
        pollForAnswer();
        
      } else {
        // DESKTOP: Use real-time listener
        console.log('🖥️ Using real-time listener for desktop');
        const answerRef = ref(db, `signals/${targetId}/answer`);
        onValue(answerRef, async (snapshot) => {
          console.log('🔔 Answer snapshot received:', snapshot.exists());
          const data = snapshot.val();
          console.log('📦 Answer data:', data ? 'EXISTS' : 'NULL');
          
          if (data && data.signal) {
            // Skip if already processed
            if (pc.currentRemoteDescription) {
              console.log('⏭️ Answer already processed');
              return;
            }
            
            try {
              console.log('📥 Answer received - processing...');
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
              console.log('✅ Remote description set');
              
              // Process pending ICE candidates
              console.log('Processing pending candidates:', pendingCandidatesRef.current.length);
              for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
              pendingCandidatesRef.current = [];
              
            } catch (error) {
              console.error('❌ Error setting answer:', error);
            }
          } else {
            console.log('⏳ No answer data yet, waiting...');
          }
        });
      }

      // Listen for sharer's ICE candidates
      const sharerCandidatesRef = ref(db, `signals/${targetId}/sharerCandidates`);
      onValue(sharerCandidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (data) => {
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ Added ICE candidate');
              } else {
                pendingCandidatesRef.current.push(data.candidate);
                console.log('📝 Queued ICE candidate');
              }
            } catch (error) {
              console.error('ICE candidate error:', error);
            }
          });
        }
      });

    } catch (error) {
      console.error('💥 Init error:', error);
      setStatus('Connection failed: ' + error.message);
    }
  };

  const disconnect = () => {
    cleanup();
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
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={disconnect}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              ← Disconnect
            </button>
            
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <span className="text-sm text-slate-300">{status}</span>
            </div>

            {hasVideo && (
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Video Active</span>
              </div>
            )}
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition-colors"
          >
            {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>

        {/* Video Container - ALWAYS VISIBLE */}
        <div style={{ 
          width: '100%', 
          height: 'calc(100vh - 48px)',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {!hasVideo && (
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '5px solid rgba(255,255,255,0.1)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}></div>
              <p>{status}</p>
            </div>
          )}
          
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: hasVideo ? 'block' : 'none'
            }}
          />
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
