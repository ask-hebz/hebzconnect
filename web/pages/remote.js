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
  const [debugInfo, setDebugInfo] = useState([]);
  
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-5), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    // Force show initialization
    const timestamp = new Date().toISOString();
    setDebugInfo([`⚡ INIT ${timestamp.slice(11,19)}`]);
    
    try {
      // Detect mobile FIRST
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      addDebugLog(`🔍 Device: ${isMobileDevice ? 'MOBILE' : 'DESKTOP'}`);
      
      console.log('🚀 Starting remote viewer');
      initConnection();
    } catch (error) {
      addDebugLog(`💥 INIT ERROR: ${error.message}`);
      setStatus(`Error: ${error.message}`);
    }

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
          { urls: 'stun:stun4.l.google.com:19302' },
          // FREE TURN server for better connectivity
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
        ],
        iceCandidatePoolSize: 10
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // CRITICAL: Track handling like Google Meet
      pc.ontrack = (event) => {
        console.log('📺 Track received');
        addDebugLog('📺 Video track received!');
        const stream = event.streams[0];
        
        if (videoRef.current && stream) {
          console.log('🎬 Attaching stream to video');
          addDebugLog('🎬 Attaching video stream');
          videoRef.current.srcObject = stream;
          
          // Force play immediately
          videoRef.current.play().then(() => {
            addDebugLog('✅ Video playing!');
            setHasVideo(true);
          }).catch(e => {
            console.log('Retrying with muted');
            addDebugLog('🔇 Retrying muted...');
            videoRef.current.muted = true;
            videoRef.current.play().then(() => {
              addDebugLog('✅ Video playing (muted)');
              setHasVideo(true);
            });
          });
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
        addDebugLog('📱 Mobile detected - using HTTP polling');
        const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        
        // Start ICE candidate polling IMMEDIATELY
        addDebugLog('📡 Starting ICE candidate polling...');
        const pollForCandidates = async () => {
          try {
            const response = await fetch(`${firebaseUrl}/signals/${targetId}/sharerCandidates.json`);
            const candidates = await response.json();
            
            if (candidates) {
              const candidateCount = Object.keys(candidates).length;
              addDebugLog(`🧊 Found ${candidateCount} ICE candidates`);
              
              for (const data of Object.values(candidates)) {
                try {
                  if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('✅ Added ICE candidate');
                  } else {
                    pendingCandidatesRef.current.push(data.candidate);
                  }
                } catch (error) {
                  console.error('ICE candidate error:', error);
                }
              }
            }
            
            // Keep polling for new candidates
            if (pc && pc.connectionState !== 'closed') {
              setTimeout(pollForCandidates, 2000);
            }
          } catch (error) {
            console.error('Candidate polling error:', error);
            if (pc && pc.connectionState !== 'closed') {
              setTimeout(pollForCandidates, 2000);
            }
          }
        };
        
        // Start ICE polling NOW
        pollForCandidates();
        
        // THEN start answer polling
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds
        
        const pollForAnswer = async () => {
          try {
            attempts++;
            console.log(`🔄 Poll attempt ${attempts}/${maxAttempts}`);
            addDebugLog(`🔄 Polling... (${attempts}/${maxAttempts})`);
            
            const response = await fetch(`${firebaseUrl}/signals/${targetId}/answer.json`);
            const data = await response.json();
            
            addDebugLog(`📦 Response: ${data ? 'Data received' : 'No data'}`);
            
            if (data && data.signal) {
              console.log('📥 Answer received via polling!');
              addDebugLog('✅ Answer received!');
              
              if (!pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                console.log('✅ Remote description set');
                addDebugLog('✅ Connection established');
                
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
              addDebugLog('❌ Timeout - no answer received');
              setStatus('Connection timeout');
            }
          } catch (error) {
            console.error('❌ Polling error:', error);
            addDebugLog(`❌ Error: ${error.message}`);
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
      
      if (!isMobile) {
        // DESKTOP: Use real-time listener for ICE candidates
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
      }

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
              <span className="text-xs text-slate-600 ml-2">v3.5-FRESH</span>
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
              
              {/* Debug Info for Mobile */}
              {debugInfo.length > 0 && (
                <div style={{
                  marginTop: '30px',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  padding: '15px',
                  borderRadius: '10px',
                  maxWidth: '90%',
                  margin: '30px auto 0',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ color: '#00ff00', marginBottom: '10px', fontWeight: 'bold' }}>
                    📊 Debug Log:
                  </div>
                  {debugInfo.map((log, i) => (
                    <div key={i} style={{ color: '#00ff00', marginBottom: '5px' }}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
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
