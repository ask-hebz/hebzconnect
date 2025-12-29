import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function RemoteControl() {
  const router = useRouter();
  const { peer: targetPeerId } = router.query;
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    if (!targetPeerId) return;
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    setStatus('Ready - WebRTC connection will be established here');
    setConnected(true);
  }, [targetPeerId]);

  const disconnect = () => {
    router.push('/dashboard');
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Remote Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-black">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
          <button onClick={disconnect} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
            ← Disconnect
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-slate-300">{status}</span>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-48px)] p-4">
          <div className="bg-slate-800 rounded-lg p-12 text-center max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Remote Viewer</h2>
            <p className="text-slate-400 mb-6">WebRTC connection will display screen here</p>
            <div className="bg-slate-900 rounded border border-slate-700 p-8">
              <p className="text-slate-500">Connecting to: {targetPeerId}</p>
              <p className="text-slate-600 text-sm mt-2">This is a placeholder. Full WebRTC implementation coming soon.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
