import { useState, useEffect, useCallback } from 'react';

const PENDING_KEY = 'attendance_pending_actions';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const loadPending = useCallback(() => {
    try {
      const stored = localStorage.getItem(PENDING_KEY);
      const actions = stored ? JSON.parse(stored) : [];
      setPendingCount(actions.length);
      return actions;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    loadPending();

    const onOnline = () => {
      setIsOnline(true);
      // Attempt to flush pending actions when coming back online
      flushPending();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadPending]);

  const queueAction = useCallback((action) => {
    try {
      const actions = loadPending();
      actions.push({ ...action, queued_at: new Date().toISOString() });
      localStorage.setItem(PENDING_KEY, JSON.stringify(actions));
      setPendingCount(actions.length);
    } catch {
      /* ignore storage errors */
    }
  }, [loadPending]);

  const flushPending = useCallback(async () => {
    const actions = loadPending();
    if (!actions.length || !navigator.onLine) return;

    const failed = [];
    for (const action of actions) {
      try {
        await fetch(action.url, {
          method: action.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...action.headers },
          body: JSON.stringify(action.body),
        });
      } catch {
        failed.push(action);
      }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(failed));
    setPendingCount(failed.length);
  }, [loadPending]);

  return { isOnline, pendingCount, queueAction, flushPending };
}
