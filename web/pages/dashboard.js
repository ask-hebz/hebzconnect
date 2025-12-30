import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Dashboard() {
  const router = useRouter();
  const [showInstructions, setShowInstructions] = useState(false);

  const handleShareScreen = () => {
    router.push('/connect-stream');
  };

  const handleViewScreen = async () => {
    const code = prompt('Enter the 6-digit connection code (e.g., ABC-123):');
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      
      // Lookup peer ID from code via Firebase
      try {
        const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        const response = await fetch(`${firebaseUrl}/peers.json`);
        const peers = await response.json();
        
        // Find peer with matching code
        const peerEntry = Object.entries(peers || {}).find(
          ([id, data]) => data.code === cleanCode && data.online
        );
        
        if (peerEntry) {
          const [peerId, peerData] = peerEntry;
          console.log('Found peer:', peerId, 'for code:', cleanCode);
          router.push(`/remote?peer=${peerId}`);
        } else {
          alert(`Code "${cleanCode}" not found or offline. Please check the code and try again.`);
        }
      } catch (error) {
        console.error('Error looking up code:', error);
        alert('Error connecting. Please try again.');
      }
    }
  };

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
            <p className="text-slate-400 text-lg">Professional Remote Screen Sharing</p>
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
              onClick={handleViewScreen}
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
                  Enter a code to view someone's screen
                </p>
                <div className="bg-white/10 rounded-lg py-3 px-4">
                  <p className="text-sm">Click to enter code →</p>
                </div>
              </div>
            </div>
          </div>

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
                      <li>2. A unique code will be generated (e.g., ABC-123)</li>
                      <li>3. Share this code with the viewer</li>
                      <li>4. Click "Allow" when browser asks for screen permission</li>
                      <li>5. Select "Entire Screen" for best results</li>
                      <li>6. Your screen is now being shared!</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-purple-400 mb-4">👁️ To View a Remote Screen:</h4>
                    <ol className="text-slate-300 space-y-3">
                      <li>1. Click "View Remote Screen" button</li>
                      <li>2. Enter the 6-digit code provided by the sharer</li>
                      <li>3. Wait for connection (5-10 seconds)</li>
                      <li>4. The remote screen will appear</li>
                      <li>5. Use fullscreen button for better viewing</li>
                      <li>6. Click "Disconnect" when done</li>
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
              <h4 className="text-white font-semibold mb-2">Cross-Platform</h4>
              <p className="text-slate-400 text-sm">Works on desktop and mobile</p>
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
