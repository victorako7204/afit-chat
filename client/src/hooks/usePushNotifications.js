/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const subscribeToPush = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) {
      console.log('Push notifications not supported or VAPID key missing');
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      await api.post('/notifications/subscribe', sub.toJSON());
      
      setSubscription(sub);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        console.log('Push notification permission denied');
      } else {
        console.error('Error subscribing to push:', error);
      }
      return false;
    }
  }, [isSupported]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
      }
      await api.delete('/notifications/unsubscribe');
      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [subscription]);

  return {
    isSupported,
    isSubscribed,
    subscription,
    subscribeToPush,
    unsubscribeFromPush
  };
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default usePushNotifications;
