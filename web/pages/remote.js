import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SimplePeer from 'simple-peer';
import { ref, onValue, set, off } from 'firebase/database';
import { db } from '../lib/firebase';

export default function RemoteControl() {
  const router = useRouter();
  const { peer: targetPeerId, code } = router.query;
  
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [quality, setQuality] = useState('high');
  const [stats, setStats] = useState({ latency: 0, fps: 0 });

  useEffect(() => {
    if (!targetPeerId && !code) return;
    
    initConnection();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [targetPeerId, code]);

  const initConnection = async () => {
    setStatus('Creating connection...');

    try {
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peerRef.current = peer;

      // Send offer
      peer.on('signal', async (signal) => {
        setStatus('Sending connection request...');
        
        const targetId = targetPeerId || code;
        await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'offer',
            targetId: targetId,
            peerId: 'controller-' + Date.now(),
            signal
          })
        });

        // Listen for answer
        const answerRef = ref(db, `signals/${targetId}/answer`);
        const unsubscribe = onValue(answerRef, (snapshot) => {
          const data = snapshot.val();
          if (data && !peer.destroyed) {
            peer.signal(data.signal);
            off(answerRef);
          }
        });
      });

      peer.on('connect', () => {
        setStatus('Connected');
        setConnected(true);
      });

      peer.on('stream', (stream) => {
        setStatus('Screen sharing active');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

      peer.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'stats') {
            setStats(message.data);
          }
        } catch (err) {
          console.error('Data parse error:', err);
        }
      });

      peer.on('error', (err) => {
        setStatus('Connection failed: ' + err.message);
        console.error('Peer error:', err);
      });

      peer.on('close', () => {
        setStatus('Disconnected');
        setConnected(false);
      });

    } catch (error) {
      setStatus('Connection failed');
      console.error('Init error:', error);
    }
  };

  const sendInput = (data) => {
    if (peerRef.current && connected) {
      try {
        peerRef.current.send(JSON.stringify(data));
      } catch (err) {
        console.error('Send error:', err);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!connected || !videoRef.current) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    sendInput({ t: 'm', x, y });
  };

  const handleMouseDown = (e) => {
    if (!connected) return;
    e.preventDefault();
    sendInput({ t: 'c', b: e.button, a: 'd' });
  };

  const handleMouseUp = (e) => {
    if (!connected) return;
    e.preventDefault();
    sendInput({ t: 'c', b: e.button, a: 'u' });
  };

  const handleKeyDown = (e) => {
    if (!connected) return;
    e.preventDefault();
    sendInput({ t: 'k', k: e.key, c: e.keyCode, a: 'd' });
  };

  const handleKeyUp = (e) => {
    if (!connected) return;
    e.preventDefault();
    sendInput({ t: 'k', k: e.key, c: e.keyCode, a: 'u' });
  };

  const handleWheel = (e) => {
    if (!connected) return;
    e.preventDefault();
    sendInput({ t: 'w', d: e.deltaY > 0 ? 'd' : 'u' });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (connected) {
      sendInput({ t: 'c', b: 2, a: 'd' });
      setTimeout(() => sendInput({ t: 'c', b: 2, a: 'u' }), 100);
    }
  };

  const disconnect = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    router.push('/dashboard');
  };

  const changeQuality = (newQuality) => {
    setQuality(newQuality);
    if (connected) {
      sendInput({ t: 'quality', q: newQuality });
    }
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

            {connected && (
              <div className="text-xs text-slate-500 flex items-center space-x-4">
                <span>Latency: {stats.latency}ms</span>
                <span>FPS: {stats.fps}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={quality}
              onChange={(e) => changeQuality(e.target.value)}
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
                className="w-full rounded-lg shadow-2xl cursor-none bg-slate-900"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onWheel={handleWheel}
                onContextMenu={handleContextMenu}
                tabIndex={0}
              />
              
              {/* Control Overlay */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-white text-sm font-medium">🖱️ Controlling Remote PC</p>
                <p className="text-slate-400 text-xs">Move mouse, click, type, scroll</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
