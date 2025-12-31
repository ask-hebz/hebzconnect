import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getDatabase, ref, set, onValue, remove } from 'firebase/database';
import { app } from '../lib/firebase';

const db = getDatabase(app);

export default function ConnectStream() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [connected, setConnected] = useState(false);
  
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const hasAnsweredRef = useRef(false);

  useEffect(() => {
    initializeConnection();
    return () => cleanup();
  }, []);

  const initializeConnection = async () => {
    const peerId = `PC-${Math.random().toString(36).substring(2, 10)}`;
    const accessCode = generateCode();
    
    setId(peerId);
    setCode(accessCode);

    // Register in peers list
    await set(ref(db, `peers/${peerId}`), {
      id: peerId,
      code: accessCode,
      hostname: window.location.hostname || 'Desktop',
      lastSeen: Date.now()
    });

    // Heartbeat
    const interval = setInterval(() => {
      set(ref(db, `peers/${peerId}/lastSeen`), Date.now());
    }, 10000);

    // Listen for offers
    listenForOffers(peerId);

    return () => {
      clearInterval(interval);
      remove(ref(db, `peers/${peerId}`));
    };
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array(3).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('') + '-' +
           Array(3).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const listenForOffers = (peerId) => {
    console.log('👂 Listening for offers on:', peerId);
    const offerRef = ref(db, `signals/${peerId}/offer`);
    
    onValue(offerRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && !hasAnsweredRef.current) {
        console.log('📥 Offer received from:', data.from || 'viewer');
        hasAnsweredRef.current = true;
        setStatus('Incoming connection...');
        await handleOffer(data, peerId);
      }
    });
  };

  const handleOffer = async (offerData, peerId) => {
    try {
      console.log('📥 Processing offer');
      setStatus('Requesting screen share...');

      // Get screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      console.log('✅ Screen granted');
      streamRef.current = stream;
      setStatus('Setting up connection...');

      // CRITICAL: Create peer connection with SIMPLE config for mobile
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
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
        ]
        // NO iceTransportPolicy - let it choose
        // NO bundlePolicy - keep it simple
      });

      peerConnectionRef.current = pc;

      // Add tracks FIRST (before setting remote description)
      console.log('📤 Adding video track');
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('✅ Track added:', track.kind);
      });

      // ICE candidate handler - CRITICAL FOR MOBILE!
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate generated!');
          console.log('   Type:', event.candidate.type);
          console.log('   Protocol:', event.candidate.protocol);
          
          set(ref(db, `signals/${peerId}/sharerCandidates/${Date.now()}`), {
            candidate: event.candidate.toJSON(),
            timestamp: Date.now()
          }).then(() => {
            console.log('✅ ICE candidate sent to Firebase');
          }).catch(err => {
            console.error('❌ Failed to send ICE:', err);
          });
        } else {
          console.log('✅ ICE gathering complete (null candidate)');
        }
      };

      // ICE gathering state - VERBOSE
      pc.onicegatheringstatechange = () => {
        console.log('📡 ICE gathering state changed:', pc.iceGatheringState);
      };

      // Connection states
      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('Connected - Viewer is watching');
          setConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('Disconnected');
          setConnected(false);
        }
      };

      // Set remote description (the offer from viewer)
      console.log('📥 Setting remote description');
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.signal));
      console.log('✅ Remote description set');

      // Create answer
      console.log('📤 Creating answer');
      const answer = await pc.createAnswer();
      console.log('✅ Answer created');

      // CRITICAL: Set local description - THIS should trigger ICE gathering
      console.log('📝 Setting local description (should trigger ICE gathering)');
      await pc.setLocalDescription(answer);
      console.log('✅ Local description set');
      console.log('📡 ICE gathering state:', pc.iceGatheringState);

      // Wait a moment for ICE gathering to start
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('📡 ICE gathering state after 500ms:', pc.iceGatheringState);

      // Send answer to viewer
      console.log('📤 Sending answer to Firebase');
      await set(ref(db, `signals/${peerId}/answer`), {
        signal: pc.localDescription.toJSON(),
        timestamp: Date.now()
      });
      console.log('✅ Answer sent');

      setStatus('Connecting...');

      // Listen for viewer's ICE candidates
      const viewerCandidatesRef = ref(db, `signals/${peerId}/viewerCandidates`);
      onValue(viewerCandidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (data) => {
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ Added viewer ICE candidate');
              }
            } catch (err) {
              console.error('❌ Error adding viewer candidate:', err);
            }
          });
        }
      });

    } catch (error) {
      console.error('❌ Error in handleOffer:', error);
      setStatus(`Error: ${error.message}`);
      hasAnsweredRef.current = false;
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (id) {
      remove(ref(db, `peers/${id}`));
      remove(ref(db, `signals/${id}`));
    }
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Share Screen</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Main Card */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
              {/* Logo */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center">
                <div className="text-6xl mb-4">🖥️</div>
                <h1 className="text-3xl font-bold">HebzConnect</h1>
                <p className="text-blue-100 mt-2">Remote Access Code</p>
              </div>

              {/* Content */}
              <div className="p-8">
                {/* Connection Code */}
                <div className="text-center mb-8">
                  <p className="text-gray-400 mb-4">Your Connection Code:</p>
                  <div className="relative">
                    <div className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 p-1 rounded-2xl">
                      <div className="bg-gray-900 px-12 py-8 rounded-xl">
                        <div className="text-5xl font-bold tracking-wider">{code}</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 mt-6 text-sm">
                    Share this code with the person who will view your screen
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center space-x-3 py-4">
                  <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                  <span className="text-lg">{status}</span>
                </div>

                {/* Instructions */}
                <div className="mt-8 bg-gray-900/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    Instructions:
                  </h3>
                  <ol className="space-y-3 text-gray-300">
                    <li className="flex">
                      <span className="font-bold mr-3">1.</span>
                      <span>Share the code above with the viewer</span>
                    </li>
                    <li className="flex">
                      <span className="font-bold mr-3">2.</span>
                      <span>They will enter the code to connect</span>
                    </li>
                    <li className="flex">
                      <span className="font-bold mr-3">3.</span>
                      <span>Browser will ask permission to share your screen</span>
                    </li>
                    <li className="flex">
                      <span className="font-bold mr-3">4.</span>
                      <span>Select "Entire Screen" or specific window</span>
                    </li>
                    <li className="flex">
                      <span className="font-bold mr-3">5.</span>
                      <span>Click "Share" to begin screen sharing</span>
                    </li>
                  </ol>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                  <p>Developed by Godmisoft</p>
                  <p className="mt-1">Heber Mayormita © 2025</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
