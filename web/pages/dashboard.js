import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Dashboard() {
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionCode, setConnectionCode] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchPeers();
    const interval = setInterval(fetchPeers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPeers = async () => {
    try {
      const res = await fetch('/api/peers');
      if (res.ok) {
        const data = await res.json();
        setPeers(data.peers);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch peers');
      setLoading(false);
    }
  };

  const connectByCode = () => {
    if (connectionCode.trim()) {
      router.push(`/remote?code=${connectionCode}`);
    }
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-slate-900">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src="/hebzconnect-logo.png" alt="HebzConnect" className="w-10 h-10" />
                <h1 className="text-xl font-bold text-white">HebzConnect Dashboard</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Connection Code Input */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">🔑 Connect by Code</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={connectionCode}
                onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
                placeholder="Enter connection code (e.g., ABC-123)"
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && connectByCode()}
              />
              <button
                onClick={connectByCode}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Connect
              </button>
            </div>
          </div>

          {/* Available Computers */}
          <h2 className="text-2xl font-bold text-white mb-6">🖥️ Available Computers</h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : peers.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-300 mb-2">No computers online</h3>
              <p className="text-slate-500">Install and run the agent on target computers, or use connection code above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {peers.map(peer => (
                <div
                  key={peer.id}
                  onClick={() => router.push(`/remote?peer=${peer.id}`)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-600/20 rounded-lg">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">Online</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{peer.hostname}</h3>
                  <p className="text-sm text-slate-400 mb-2">ID: {peer.id.substring(0, 12)}...</p>
                  {peer.code && (
                    <p className="text-xs text-blue-400 font-mono">Code: {peer.code}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 pb-8 text-center text-sm text-slate-600">
          Powered by <span className="text-blue-400 font-semibold">Godmisoft</span>
        </footer>
      </div>
    </>
  );
}
