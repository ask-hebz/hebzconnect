import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export default function RemoteControl() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;
  
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [quality, setQuality] = useState('high');

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    initConnection();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
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
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Handle incoming stream
      pc.ontrack = (event) => {
        setStatus('Screen sharing active');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
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

      pc.oniceconnectionstatechange = () => {
        console.log('ICE state:', pc.iceConnectionState);
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
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          });
        }
      });

      // Send offer to target
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
            console.log('Answer set successfully');
            off(answerRef);
          } catch (error) {
            console.error('Error setting answer:', error);
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

  return (
    <>
      <Head>
        <title>HebzConnect - Remote Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-black">
        {/* Top Control Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={disconnect}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors flex items-center space-x-2"
            >
              <span>← Disconnect</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-300">{status}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="high">High Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="low">Low Quality (Fast)</option>
            </select>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.requestFullscreen();
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition-colors"
            >
              ⛶ Fullscreen
            </button>
          </div>
        </div>

        {/* Remote Screen Display */}
        <div className="flex items-center justify-center min-h-[calc(100vh-48px)] p-4">
          {!connected ? (
            <div className="text-center">
              <div className="inline-block mb-4">
                <svg className="animate-spin h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
              <p className="text-slate-400 text-lg mb-2">{status}</p>
              <p className="text-slate-600 text-sm">Establishing WebRTC connection...</p>
            </div>
          ) : (
            <div className="relative w-full max-w-7xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg shadow-2xl bg-slate-900"
              />
              
              {/* Control Overlay */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-white text-sm font-medium">🖥️ Viewing Remote Screen</p>
                <p className="text-slate-400 text-xs">Screen sharing active</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
