import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Dashboard() {
  const router = useRouter();
  const [showInstructions, setShowInstructions] = useState(false);
  const [onlineScreens, setOnlineScreens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showScreensList, setShowScreensList] = useState(false);
  const [viewerMode, setViewerMode] = useState('desktop'); // 'desktop' or 'mobile'

  const handleShareScreen = () => {
    router.push('/connect-stream');
  };

  const loadOnlineScreens = async () => {
    setLoading(true);
    setShowScreensList(true);
    
    try {
      const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      const response = await fetch(`${firebaseUrl}/peers.json`);
      const peers = await response.json();
      
      if (peers) {
        const now = Date.now();
        const onlineList = Object.entries(peers)
          .filter(([id, data]) => {
            // Online if last seen within 30 seconds
            return data.online && (now - data.lastSeen) < 30000;
          })
          .map(([id, data]) => ({
            id,
            code: data.code,
            hostname: data.hostname || 'Unknown Device',
            lastSeen: data.lastSeen
          }))
          .sort((a, b) => b.lastSeen - a.lastSeen); // Most recent first
        
        setOnlineScreens(onlineList);
      } else {
        setOnlineScreens([]);
      }
    } catch (error) {
      console.error('Error loading screens:', error);
      alert('Failed to load available screens. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectToScreen = (peerId) => {
    if (viewerMode === 'mobile') {
      router.push(`/mobile-viewer?peer=${peerId}`);
    } else {
      router.push(`/remote?peer=${peerId}`);
    }
  };

  const handleManualCode = () => {
    const code = prompt('Enter the 6-digit connection code (e.g., ABC-123):');
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      
      // Try to find peer by code
      const peer = onlineScreens.find(s => s.code === cleanCode);
      if (peer) {
        connectToScreen(peer.id);
      } else {
        alert(`Code "${cleanCode}" not found. Make sure the screen is sharing and try again.`);
      }
    }
  };

  // Auto-refresh online screens every 10 seconds when list is visible
  useEffect(() => {
    if (showScreensList) {
      const interval = setInterval(loadOnlineScreens, 10000);
      return () => clearInterval(interval);
    }
  }, [showScreensList]);

  return (
    <>
      <Head>
        <title>HebzConnect - Dashboard</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <img 
              src="/hebzconnect-logo.png" 
              alt="HebzConnect" 
              className="w-40 h-40 mx-auto mb-6"
            />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
              HebzConnect
            </h1>
            <p className="text-slate-400 text-lg">Remote Screen Sharing</p>
          </div>

          {/* Main Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            {/* Share Screen Card */}
            <div 
              onClick={handleShareScreen}
              className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-3xl p-8 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-white text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-3">Share My Screen</h2>
                <p className="text-blue-100 mb-6">
                  Generate a code and let others view your screen
                </p>
                <div className="bg-white/10 rounded-lg py-3 px-4">
                  <p className="text-sm">Click to start sharing →</p>
                </div>
              </div>
            </div>

            {/* View Screen Card */}
            <div 
              onClick={loadOnlineScreens}
              className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-3xl p-8 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-white text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-3">View Remote Screen</h2>
                <p className="text-purple-100 mb-6">
                  See available screens and connect instantly
                </p>
                <div className="bg-white/10 rounded-lg py-3 px-4">
                  <p className="text-sm">Click to see online screens →</p>
                </div>
              </div>
            </div>
          </div>

          {/* Available Screens List */}
          {showScreensList && (
            <div className="max-w-4xl mx-auto mb-12 animate-fadeIn">
              <div className="bg-slate-800/50 rounded-3xl p-8">
                {/* Desktop/Mobile Tabs */}
                <div className="flex justify-center mb-6">
                  <div className="bg-slate-900/50 rounded-xl p-1 inline-flex">
                    <button
                      onClick={() => setViewerMode('desktop')}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        viewerMode === 'desktop'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🖥️ Desktop Viewer
                    </button>
                    <button
                      onClick={() => setViewerMode('mobile')}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        viewerMode === 'mobile'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📱 Mobile Viewer
                    </button>
                  </div>
                </div>

                {/* Mode Description */}
                <div className="text-center mb-6">
                  {viewerMode === 'desktop' ? (
                    <p className="text-slate-400 text-sm">
                      🖥️ Best for viewing on desktop/laptop browsers
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">
                      📱 Optimized for mobile phones and tablets (Simpler, faster connection)
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white">Available Screens</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={loadOnlineScreens}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Refreshing...' : '🔄 Refresh'}
                    </button>
                    <button
                      onClick={handleManualCode}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                    >
                      ⌨️ Enter Code
                    </button>
                    <button
                      onClick={() => setShowScreensList(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {loading && (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading available screens...</p>
                  </div>
                )}

                {!loading && onlineScreens.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-slate-400 text-lg mb-2">No screens are currently sharing</p>
                    <p className="text-slate-500 text-sm">Ask someone to click "Share My Screen" to get started</p>
                  </div>
                )}

                {!loading && onlineScreens.length > 0 && (
                  <div className="grid gap-4">
                    {onlineScreens.map((screen) => (
                      <div
                        key={screen.id}
                        onClick={() => connectToScreen(screen.id)}
                        className="bg-slate-900/50 hover:bg-slate-900/70 rounded-xl p-6 cursor-pointer transition-all duration-300 border border-slate-700 hover:border-blue-500 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-white font-semibold text-lg group-hover:text-blue-400 transition-colors">
                                {screen.hostname}
                              </h4>
                              <p className="text-slate-400 text-sm">
                                Code: <span className="font-mono font-bold text-blue-400">{screen.code}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-green-400 text-sm font-medium">Online</span>
                            </div>
                            <svg className="w-6 h-6 text-slate-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 text-center text-slate-500 text-sm">
                  <p>💡 Tip: List auto-refreshes every 10 seconds</p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions Section */}
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full bg-slate-800/50 hover:bg-slate-800/70 rounded-2xl p-6 transition-all duration-300 mb-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">📖 How to Use</h3>
                <svg 
                  className={`w-6 h-6 text-slate-400 transform transition-transform ${showInstructions ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {showInstructions && (
              <div className="bg-slate-800/50 rounded-2xl p-8 mb-8 animate-fadeIn">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-blue-400 mb-4">🖥️ To Share Your Screen:</h4>
                    <ol className="text-slate-300 space-y-3">
                      <li>1. Click "Share My Screen" button</li>
                      <li>2. A unique code will be generated</li>
                      <li>3. Share this code with the viewer</li>
                      <li>4. Click "Allow" when browser asks for permission</li>
                      <li>5. Your screen is now being shared!</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-purple-400 mb-4">👁️ To View a Remote Screen:</h4>
                    <ol className="text-slate-300 space-y-3">
                      <li>1. Click "View Remote Screen" button</li>
                      <li>2. See list of available online screens</li>
                      <li>3. Click on any screen to connect instantly</li>
                      <li>4. Or click "Enter Code" to type manually</li>
                      <li>5. Use fullscreen button for better viewing</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/30 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h4 className="text-white font-semibold mb-2">Secure</h4>
              <p className="text-slate-400 text-sm">Peer-to-peer encrypted connection</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h4 className="text-white font-semibold mb-2">Fast</h4>
              <p className="text-slate-400 text-sm">Real-time screen sharing</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">📱</div>
              <h4 className="text-white font-semibold mb-2">Easy</h4>
              <p className="text-slate-400 text-sm">One-click connection to online screens</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-slate-600 text-sm">
            <p>Developed by <span className="text-blue-400 font-semibold">Godmisoft</span></p>
            <p className="mt-2">Heber Mayormita © 2025</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
