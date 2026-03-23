/* eslint-disable */
import api from './api';

let notificationPermission = 'default';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    return permission === 'granted';
  }

  return false;
};

export const showNotification = (title, options = {}) => {
  if (notificationPermission !== 'granted') {
    return null;
  }

  const notification = new Notification(title, {
    icon: '/icon-192.svg',
    badge: '/badge-icon.svg',
    ...options
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => {
    notification.close();
  }, 5000);

  return notification;
};

export const isNotificationSupported = () => {
  return 'Notification' in window;
};

export const getNotificationPermission = () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

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

export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

export const subscribeToPushNotifications = async (registration) => {
  if (!registration || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID public key not configured');
    return null;
  }

  try {
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await existingSubscription.unsubscribe();
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await api.post('/notifications/subscribe', subscription.toJSON());
    
    console.log('Push subscription successful');
    return subscription;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.warn('Push notification permission denied');
    } else {
      console.error('Push subscription failed:', error);
    }
    return null;
  }
};

export const unsubscribeFromPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
    
    await api.delete('/notifications/unsubscribe');
    console.log('Unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('Unsubscribe failed:', error);
    return false;
  }
};

export const setupPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return false;
  }

  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    return false;
  }

  const subscription = await subscribeToPushNotifications(registration);
  return !!subscription;
};
