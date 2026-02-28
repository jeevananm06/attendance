import { useState, useEffect } from 'react';
import { pushAPI } from '../api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [isSupported]);

  const subscribe = async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);
    try {
      const { data } = await pushAPI.getVapidPublicKey();
      const vapidKey = data.vapid_public_key;
      if (!vapidKey) {
        console.warn('[Push] No VAPID public key configured on server');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await pushAPI.subscribe({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
        },
      });
      setIsSubscribed(true);
    } catch (err) {
      console.warn('[Push] Subscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await pushAPI.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (err) {
      console.warn('[Push] Unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported, isSubscribed, subscribe, unsubscribe, isLoading };
}
