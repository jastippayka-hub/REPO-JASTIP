import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { NotificationItem } from '../types/index.js';
import { useAuth } from './AuthContext.js';
import { playChime } from '../utils/audio.js';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, authFetch } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const lastCountRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.error('Failed requesting notification permission', err);
      }
    }
  };

  const showSystemNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/icon.svg',
            });
          });
        } else {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
          });
        }
      } catch (e) {
        console.debug('Native notification display ignored', e);
      }
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/notifications');
      if (res.ok) {
        const data: NotificationItem[] = await res.json();
        const unread = data.filter(n => !n.read).length;

        // When new notification arrives while app is open: play audio chime and trigger Web Notification
        if (unread > lastCountRef.current && lastCountRef.current !== 0) {
          playChime('order');
          const latest = data[0];
          if (latest) {
            showSystemNotification(latest.title, latest.message);
          }
        }
        lastCountRef.current = unread;
        setNotifications(data);
      }
    } catch (err) {
      console.debug('Failed fetching notifications', err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
      lastCountRef.current = Math.max(0, lastCountRef.current - 1);
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        notificationPermission,
        requestNotificationPermission,
        fetchNotifications,
        markAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
