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
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!targetPeerId && !code) {
      console.warn('⚠️ No peer ID or code provided');
      return;
    }
    
    console.log('🚀 Starting remote viewer for:', targetPeerId || code);
    
    // CRITICAL: Wait a bit to ensure video element is mounted
    setTimeout(() => {
      if (!videoRef.current) {
        console.error('❌ Video element still not found after mount delay!');
        setStatus('Error: Video element not available');
        return;
      }
      console.log('✅ Video element confirmed:', videoRef.current);
      initConnection();
    }, 100);

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      console.log('🧹 Cleaning up connection...');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [targetPeerId, code]);

  const initConnection = async () => {
    // Double-check video element exists
    if (!videoRef.current) {
      console.error('❌ CRITICAL: videoRef.current is null!');
      setStatus('Video element not found!');
      return;
    }

    setStatus('Creating connection...');

    try {
      const targetId = targetPeerId || code;
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

      console.log('🔧 Creating RTCPeerConnection...');
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ],
        iceCandidatePoolSize: 10
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // CRITICAL: Handle incoming stream with NULL checks
      pc.ontrack = (event) => {
        console.log('📺 Track received!');
        console.log('  - Streams:', event.streams?.length || 0);
        console.log('  - Track kind:', event.track?.kind);
        console.log('  - Track enabled:', event.track?.enabled);
        console.log('  - Track readyState:', event.track?.readyState);
        
        setStatus('Screen sharing active');
        
        if (!event.streams || !event.streams[0]) {
          console.error('❌ No stream in track event!');
          return;
        }

        const stream = event.streams[0];
        console.log('✅ Stream received:', stream.id);
        console.log('  - Video tracks:', stream.getVideoTracks().length);
        
        // CRITICAL: Check video element exists before using it
        if (!videoRef.current) {
          console.error('❌ Video element not found when trying to set srcObject!');
          setStatus('Error: Video element unavailable');
          return;
        }

        console.log('🎬 Setting video srcObject...');
        videoRef.current.srcObject = stream;
        
        // Setup video element event handlers
        videoRef.current.onloadedmetadata = () => {
          console.log('📊 Video metadata loaded');
          if (videoRef.current) {
            console.log('  - Dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            setHasVideo(true);
          }
        };

        videoRef.current.onloadeddata = () => {
          console.log('📦 Video data loaded');
        };

        videoRef.current.onplay = () => {
          console.log('▶️ Video playing');
        };

        videoRef.current.onerror = (e) => {
          console.error('❌ Video error:', e);
        };
        
        // Force play with retry logic
        const attemptPlay = async (attempts = 0) => {
          if (attempts >= 5) {
            console.error('❌ Failed to play video after 5 attempts');
            setStatus('Video playback failed - Please refresh');
            return;
          }

          // Check video element still exists
          if (!videoRef.current) {
            console.error('❌ Video element disappeared during play attempts');
            return;
          }

          try {
            console.log(`🎮 Play attempt ${attempts + 1}...`);
            await videoRef.current.play();
            console.log('✅ Video playing successfully!');
            setHasVideo(true);
          } catch (error) {
            console.warn(`⚠️ Play attempt ${attempts + 1} failed:`, error.message);
            
            if (!videoRef.current) {
              console.error('❌ Video element lost during retry');
              return;
            }

            if (error.name === 'NotAllowedError') {
              console.log('🔇 Muting video and retrying...');
              videoRef.current.muted = true;
              setTimeout(() => attemptPlay(attempts + 1), 200);
            } else if (error.name === 'NotSupportedError') {
              console.log('🔄 Trying to reload stream...');
              videoRef.current.load();
              setTimeout(() => attemptPlay(attempts + 1), 200);
            } else {
              setTimeout(() => attemptPlay(attempts + 1), 500);
            }
          }
        };

        // Start play attempts after delay
        setTimeout(() => attemptPlay(), 100);
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log('🔄 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('Connected');
          setConnected(true);
        } else if (pc.connectionState === 'disconnected') {
          setStatus('Disconnected');
          setConnected(false);
          setHasVideo(false);
        } else if (pc.connectionState === 'failed') {
          setStatus('Connection failed - Please refresh');
          setConnected(false);
          setHasVideo(false);
        }
      };

      // ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
      };

      // ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log('📡 ICE gathering state:', pc.iceGatheringState);
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 New ICE candidate:', event.candidate.type);
        } else {
          console.log('✅ ICE gathering complete');
        }
      };

      console.log('📤 Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      
      console.log('✅ Offer created');
      await pc.setLocalDescription(offer);
      console.log('✅ Local description set');

      // Wait for ICE gathering
      console.log('⏳ Waiting for ICE gathering...');
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          console.log('✅ ICE already complete');
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              console.log('✅ ICE gathering completed');
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          
          setTimeout(() => {
            console.log('⏱️ ICE gathering timeout (proceeding anyway)');
            resolve();
          }, 5000);
        }
      });

      // Send offer
      setStatus('Sending connection request...');
      console.log('📤 Sending offer to Firebase...');
      
      await fetch(`${firebaseUrl}/signals/${targetId}/offer.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal: pc.localDescription,
          from: 'controller-' + Date.now(),
          timestamp: Date.now()
        })
      });

      console.log('✅ Offer sent');
      setStatus('Waiting for peer to accept...');

      // Listen for answer
      console.log('👂 Listening for answer...');
      const answerRef = ref(db, `signals/${targetId}/answer`);
      const unsubscribe = onValue(answerRef, async (snapshot) => {
        const data = snapshot.val();
        if (data && data.signal) {
          try {
            console.log('📥 Answer received!');
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            console.log('✅ Remote description set successfully');
            setStatus('Establishing connection...');
            off(answerRef);
          } catch (error) {
            console.error('❌ Error setting remote description:', error);
            setStatus('Connection setup failed');
          }
        }
      });

    } catch (error) {
      setStatus('Connection failed: ' + error.message);
      console.error('💥 Init error:', error);
    }
  };

  const disconnect = () => {
    console.log('👋 Disconnecting...');
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

        {/* Full screen video container */}
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
          {!hasVideo ? (
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <p className="text-slate-400 mb-2">{status}</p>
              {connected && !hasVideo && (
                <p className="text-yellow-400 text-sm">Waiting for video stream...</p>
              )}
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Full screen video - ALWAYS RENDERED */}
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
                  objectFit: 'contain',
                  backgroundColor: '#1a1a2e'
                }}
                className="rounded-lg shadow-2xl"
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

          {/* CRITICAL: Video element ALWAYS in DOM, hidden when not hasVideo */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              display: hasVideo ? 'none' : 'none', // Hidden but exists in DOM
              width: '1px',
              height: '1px',
              position: 'absolute',
              opacity: 0
            }}
          />
        </div>
      </div>
    </>
  );
}
