import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import SimplePeer from 'simple-peer';
import { ref, onValue, set, off } from 'firebase/database';
import { db } from '../lib/firebase';

export default function ConnectStream() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('Generating code...');
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    generateCodeAndStart();
    
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const generateCodeAndStart = async () => {
    // Generate random code
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const formattedCode = `${randomCode.substring(0, 3)}-${randomCode.substring(3, 6)}`;
    setCode(formattedCode);

    const id = `PC-${Date.now().toString(36)}`;
    setPeerId(id);

    // Register with Firebase
    try {
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'register',
          peerId: id,
          hostname: `Guest-${formattedCode}`,
          code: formattedCode
        })
      });

      setStatus('Ready - Share your code');
      startHeartbeat(id, formattedCode);
      listenForConnection(id);
    } catch (error) {
      setStatus('Connection failed');
    }
  };

  const startHeartbeat = (id, codeStr) => {
    setInterval(async () => {
      try {
        await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'register',
            peerId: id,
            hostname: `Guest-${codeStr}`,
            code: codeStr
          })
        });
      } catch (error) {
        console.error('Heartbeat failed');
      }
    }, 10000);
  };

  const listenForConnection = (id) => {
    const offerRef = ref(db, `signals/${id}/offer`);
    
    const unsubscribe = onValue(offerRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && !peerRef.current) {
        setStatus('Incoming connection...');
        await handleOffer(data, id);
        off(offerRef);
      }
    });
  };

  const handleOffer = async (offerData, id) => {
    try {
      // Request screen capture
      setStatus('Requesting screen access...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      streamRef.current = stream;
      setStatus('Screen capture started');

      // Create peer connection
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peerRef.current = peer;

      // Signal offer
      peer.signal(offerData.signal);

      // Send answer
      peer.on('signal', async (signal) => {
        await set(ref(db, `signals/${id}/answer`), {
          signal,
          timestamp: Date.now()
        });
      });

      peer.on('connect', () => {
        setStatus('Connected - Controller is viewing your screen');
        setConnected(true);
      });

      peer.on('data', (data) => {
        handleRemoteInput(JSON.parse(data.toString()));
      });

      peer.on('error', (err) => {
        setStatus('Connection error: ' + err.message);
        console.error('Peer error:', err);
      });

      peer.on('close', () => {
        setStatus('Disconnected');
        setConnected(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      });

      // Track when screen sharing stops
      stream.getVideoTracks()[0].onended = () => {
        setStatus('Screen sharing stopped');
        if (peer) peer.destroy();
      };

    } catch (error) {
      setStatus('Screen capture denied or failed');
      console.error('Screen capture error:', error);
    }
  };

  const handleRemoteInput = (input) => {
    // Note: Actual mouse/keyboard control requires browser extension or desktop app
    // This is a placeholder - for full implementation, use desktop agent
    console.log('Remote input:', input);
    
    // In browser, we can only simulate limited actions
    // For real mouse/keyboard control, you need the desktop agent
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Remote Access</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/hebzconnect-logo.png" alt="HebzConnect" className="w-32 h-32 mx-auto mb-4" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              HebzConnect
            </h1>
            <p className="text-slate-400">Remote Access Code</p>
          </div>

          {/* Connection Code */}
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

          {/* Status */}
          <div className="bg-slate-900/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-slate-300">{status}</span>
            </div>
          </div>

          {/* Instructions */}
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
                  <li>5. Once connected, they can view your screen</li>
                </ol>
              </>
            )}
          </div>

          {/* Note */}
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
            <p className="text-yellow-300 text-xs text-center">
              ⚠️ Note: Full mouse/keyboard control requires desktop agent. Browser version allows screen viewing only.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-slate-600">
            Powered by <span className="text-blue-400 font-semibold">Godmisoft</span>
          </div>
        </div>
      </div>
    </>
  );
}
