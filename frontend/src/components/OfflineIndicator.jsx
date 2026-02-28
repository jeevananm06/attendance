import { WifiOff, RefreshCw } from 'lucide-react';

const OfflineIndicator = ({ isOnline, pendingCount, onFlush }) => {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
        isOnline
          ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
          : 'bg-gray-900 text-white'
      }`}
    >
      <WifiOff size={16} />
      {isOnline ? (
        <>
          <span>{pendingCount} action{pendingCount !== 1 ? 's' : ''} pending sync</span>
          <button
            onClick={onFlush}
            className="flex items-center gap-1 text-yellow-700 hover:text-yellow-900 underline"
          >
            <RefreshCw size={14} />
            Sync now
          </button>
        </>
      ) : (
        <span>You are offline — changes will sync when reconnected</span>
      )}
    </div>
  );
};

export default OfflineIndicator;
