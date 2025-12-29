import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Dashboard() {
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    fetchPeers();
    const interval = setInterval(fetchPeers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPeers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/peers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        localStorage.removeItem('token');
        router.push('/');
        return;
      }
      const data = await res.json();
      setPeers(data.peers);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch peers');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>HebzConnect - Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-slate-900">
        <header className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">HebzConnect Dashboard</h1>
              <button onClick={logout} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-white mb-6">Available Computers</h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : peers.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <p className="text-slate-400">No computers online. Install and run the agent on target computers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {peers.map(peer => (
                <div
                  key={peer.id}
                  onClick={() => router.push(`/remote?peer=${peer.id}`)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500 cursor-pointer transition-all"
                >
                  <h3 className="text-lg font-semibold text-white mb-1">{peer.hostname}</h3>
                  <p className="text-sm text-slate-400 mb-2">ID: {peer.id.substring(0, 12)}...</p>
                  <span className="inline-block px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">Online</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
