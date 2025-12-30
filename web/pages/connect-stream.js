import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { ref, onValue, set, off } from 'firebase/database';
import { db } from '../lib/firebase';

export default function ConnectStream() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('Generating code...');
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const peerConnectionRef = useRef(null);
  const streamRef = useRef(null);
  const hasAnsweredRef = useRef(false);

  useEffect(() => {
    console.log('🚀 Initializing connect stream...');
    generateCodeAndStart();
    
    return () => {
      console.log('🧹 Cleaning up...');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('🛑 Stopping track:', track.kind);
          track.stop();
        });
      }
    };
  }, []);

  const generateCodeAndStart = async () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const formattedCode = `${randomCode.substring(0, 3)}-${randomCode.substring(3, 6)}`;
    setCode(formattedCode);

    const id = `PC-${Date.now().toString(36)}`;
    setPeerId(id);
    console.log('🆔 Peer ID:', id);
    console.log('🔑 Code:', formattedCode);

    try {
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      
      await fetch(`${firebaseUrl}/peers/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          online: true,
          lastSeen: Date.now(),
          hostname: `Guest-${formattedCode}`,
          code: formattedCode
        })
      });

      console.log('✅ Peer registered in Firebase');
      setStatus('Ready - Share your code');
      startHeartbeat(id, formattedCode);
      listenForConnection(id);
    } catch (error) {
      setStatus('Connection failed');
      console.error('❌ Registration error:', error);
    }
  };

  const startHeartbeat = (id, codeStr) => {
    setInterval(async () => {
      try {
        const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        await fetch(`${firebaseUrl}/peers/${id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            online: true,
            lastSeen: Date.now(),
            hostname: `Guest-${codeStr}`,
            code: codeStr
          })
        });
      } catch (error) {
        console.error('💔 Heartbeat failed');
      }
    }, 10000);
  };

  const listenForConnection = (id) => {
    console.log('👂 Listening for incoming connections...');
    const offerRef = ref(db, `signals/${id}/offer`);
    
    onValue(offerRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && !hasAnsweredRef.current) {
        console.log('📥 Offer received!');
        hasAnsweredRef.current = true;
        setStatus('Incoming connection...');
        await handleOffer(data, id);
        off(offerRef);
      }
    });
  };

  const handleOffer = async (offerData, id) => {
    try {
      setStatus('Requesting screen access...');
      console.log('🖥️ Requesting screen share permission...');
      
      // CRITICAL: Request screen FIRST before creating peer connection
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      console.log('✅ Screen share granted!');
      console.log('📊 Stream info:');
      console.log('  - Stream ID:', stream.id);
      console.log('  - Video tracks:', stream.getVideoTracks().length);
      console.log('  - Audio tracks:', stream.getAudioTracks().length);
      
      // Verify track details
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error('❌ NO VIDEO TRACK AVAILABLE!');
        setStatus('No video track available');
        return;
      }

      console.log('📹 Video track details:', {
        kind: videoTrack.kind,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState,
        id: videoTrack.id
      });

      streamRef.current = stream;
      setStatus('Screen capture started');

      // Enhanced ICE configuration
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ],
        iceCandidatePoolSize: 10
      };

      console.log('🔧 Creating peer connection...');
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // CRITICAL FIX: Add tracks BEFORE setting remote description
      console.log('📤 Adding tracks to peer connection FIRST...');
      
      stream.getTracks().forEach((track, index) => {
        console.log(`  [${index}] Adding ${track.kind} track: ${track.label}`);
        console.log(`      - ID: ${track.id}`);
        console.log(`      - Enabled: ${track.enabled}`);
        console.log(`      - ReadyState: ${track.readyState}`);
        
        const sender = pc.addTrack(track, stream);
        
        console.log(`      ✅ Track added successfully`);
        console.log(`      - Sender ID: ${sender.track?.id}`);
        console.log(`      - Sender track type: ${sender.track?.kind}`);
      });

      // Verify senders immediately
      const senders = pc.getSenders();
      console.log(`\n📡 Verification - Active senders: ${senders.length}`);
      senders.forEach((sender, index) => {
        if (sender.track) {
          console.log(`  Sender ${index}:`, {
            trackId: sender.track.id,
            kind: sender.track.kind,
            enabled: sender.track.enabled,
            readyState: sender.track.readyState,
            label: sender.track.label
          });
        } else {
          console.warn(`  Sender ${index}: NO TRACK!`);
        }
      });

      if (senders.length === 0) {
        console.error('❌ CRITICAL: No senders after adding tracks!');
        setStatus('Failed to add video tracks');
        return;
      }

      // NOW set remote description (offer)
      console.log('\n📥 Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.signal));
      console.log('✅ Remote description set');

      // Create answer
      console.log('📤 Creating answer...');
      const answer = await pc.createAnswer();
      console.log('✅ Answer created');
      console.log('   Answer SDP includes:', answer.sdp.includes('m=video') ? '✅ VIDEO' : '❌ NO VIDEO');
      
      await pc.setLocalDescription(answer);
      console.log('✅ Local description set');

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('🔄 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('Connected - Controller is viewing your screen');
          setConnected(true);
          console.log('✅ Peer connection established!');
          
          // Re-verify senders after connection
          const currentSenders = pc.getSenders();
          console.log('📡 Current senders after connect:', currentSenders.length);
          currentSenders.forEach((s, i) => {
            console.log(`  Sender ${i}: ${s.track?.kind} - ${s.track?.readyState}`);
          });
        } else if (pc.connectionState === 'disconnected') {
          setStatus('Disconnected');
          setConnected(false);
        } else if (pc.connectionState === 'failed') {
          setStatus('Connection failed');
          setConnected(false);
        }
      };

      // ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
      };

      // Monitor negotiation
      pc.onnegotiationneeded = () => {
        console.log('🔄 Negotiation needed');
      };

      // Wait for ICE gathering
      console.log('⏳ Waiting for ICE gathering...');
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          console.log('✅ ICE already complete');
          resolve();
        } else {
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              console.log('✅ ICE gathering completed');
              resolve();
            }
          });
          setTimeout(() => {
            console.log('⏱️ ICE timeout (proceeding)');
            resolve();
          }, 5000);
        }
      });

      // Send answer to controller via Firebase
      console.log('📤 Sending answer to Firebase...');
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      await fetch(`${firebaseUrl}/signals/${id}/answer.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal: pc.localDescription,
          timestamp: Date.now()
        })
      });
      console.log('✅ Answer sent');
      setStatus('Connecting...');

      // Monitor track events
      videoTrack.onended = () => {
        console.log('🛑 Screen sharing stopped by user');
        setStatus('Screen sharing stopped');
        if (pc) pc.close();
      };

      videoTrack.onmute = () => {
        console.log('🔇 Video track muted');
      };

      videoTrack.onunmute = () => {
        console.log('🔊 Video track unmuted');
      };

      // Debug: Log track state every 2 seconds
      const trackMonitor = setInterval(() => {
        if (videoTrack.readyState !== 'live') {
          console.warn('⚠️ Track not live:', videoTrack.readyState);
        }
        const currentSenders = pc.getSenders();
        if (currentSenders.length === 0) {
          console.error('❌ No senders detected!');
        }
      }, 2000);

      // Cleanup monitor
      setTimeout(() => clearInterval(trackMonitor), 30000);

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        setStatus('Screen capture permission denied');
        console.error('❌ User denied screen sharing');
      } else if (error.name === 'NotFoundError') {
        setStatus('No screen available to capture');
        console.error('❌ No screen found');
      } else {
        setStatus('Screen capture failed: ' + error.message);
        console.error('❌ Screen capture error:', error);
      }
    }
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Remote Access</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 w-full max-w-2xl">
          <div className="text-center mb-8">
            <img src="/hebzconnect-logo.png" alt="HebzConnect" className="w-32 h-32 mx-auto mb-4" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              HebzConnect
            </h1>
            <p className="text-slate-400">Remote Access Code</p>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-8 mb-6">
            <p className="text-slate-400 text-center mb-4">Your Connection Code:</p>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-1 rounded-xl mb-6">
              <div className="bg-slate-900 rounded-lg py-8">
                <h2 className="text-6xl font-bold text-center text-white tracking-wider font-mono">
                  {code || 'XXX-XXX'}
                </h2>
              </div>
            </div>
            <p className="text-slate-400 text-center text-sm">
              Share this code with the person who will control this computer
            </p>
          </div>

          <div className="bg-slate-900/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-slate-300">{status}</span>
            </div>
          </div>

          <div className={`rounded-xl p-6 ${connected ? 'bg-green-900/20 border border-green-700/30' : 'bg-blue-900/20 border border-blue-700/30'}`}>
            {connected ? (
              <>
                <h3 className="text-lg font-semibold text-green-300 mb-3">✅ Connected!</h3>
                <ul className="text-slate-400 text-sm space-y-2">
                  <li>• Your screen is being shared</li>
                  <li>• The controller can see your screen</li>
                  <li>• Keep this window open</li>
                  <li>• Click "Stop Sharing" in browser to disconnect</li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-blue-300 mb-3">📋 Instructions:</h3>
                <ol className="text-slate-400 text-sm space-y-2">
                  <li>1. Keep this window open</li>
                  <li>2. Share the code above with the remote controller</li>
                  <li>3. They will enter this code to connect</li>
                  <li>4. Browser will ask to share your screen - click "Allow"</li>
                  <li>5. Select "Entire Screen" for best results</li>
                  <li>6. Once connected, they can view your screen</li>
                </ol>
              </>
            )}
          </div>

          <div className="mt-6 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
            <p className="text-yellow-300 text-xs text-center">
              ⚠️ Note: Full mouse/keyboard control requires desktop agent. Browser version allows screen viewing only.
            </p>
          </div>

          <div className="mt-8 text-center text-xs text-slate-600">
            Powered by <span className="text-blue-400 font-semibold">Godmisoft</span>
          </div>
        </div>
      </div>
    </>
  );
}
