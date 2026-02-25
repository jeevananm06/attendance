import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS install instructions after a delay
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
      >
        <X size={20} />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xl font-bold">A</span>
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Install AttendanceMS</h3>
          
          {isIOS ? (
            <div className="mt-2 text-sm text-gray-600">
              <p>Install this app on your iPhone:</p>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button</li>
                <li>Scroll and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong></li>
              </ol>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-600">
                Install for quick access and offline use
              </p>
              <button
                onClick={handleInstall}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                Install App
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
