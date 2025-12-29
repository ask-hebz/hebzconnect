import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Connect() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('Generating code...');
  const [peerId, setPeerId] = useState('');

  useEffect(() => {
    generateCode();
  }, []);

  const generateCode = async () => {
    // Generate random 6-character code
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const formattedCode = `${randomCode.substring(0, 3)}-${randomCode.substring(3, 6)}`;
    setCode(formattedCode);

    // Generate peer ID
    const id = `PC-${Date.now().toString(36)}`;
    setPeerId(id);

    // Register with code
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'register',
          peerId: id,
          hostname: `Guest-${formattedCode}`,
          code: formattedCode
        })
      });

      if (res.ok) {
        setStatus('Waiting for connection...');
        startHeartbeat(id, formattedCode);
      }
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
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-slate-300">{status}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">📋 Instructions:</h3>
            <ol className="text-slate-400 text-sm space-y-2">
              <li>1. Keep this window open</li>
              <li>2. Share the code above with the remote controller</li>
              <li>3. They will enter this code to connect</li>
              <li>4. Once connected, they can control your screen</li>
            </ol>
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
