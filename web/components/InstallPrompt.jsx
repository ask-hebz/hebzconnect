import { useState } from 'react';

export default function InstallPrompt({ onInstall }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl md:bottom-4 md:left-4 md:right-auto md:max-w-md md:rounded-xl">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <img src="/icons/icon-72x72.png" alt="HebzConnect" className="w-12 h-12 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold mb-1">Install HebzConnect</h3>
          <p className="text-sm text-blue-100 mb-3">
            Add to your home screen for quick access
          </p>
          <div className="flex space-x-2">
            <button onClick={onInstall} className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50">
              Install App
            </button>
            <button onClick={() => setDismissed(true)} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800">
              Not Now
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 text-white/80 hover:text-white">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
