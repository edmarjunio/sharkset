import { create } from 'zustand';
import { SmartNotificationItem } from '../types';
import {
  dispatchPushNotificationChannel,
  requestBrowserPushPermission,
} from '../services/smartAlertEngine';

const NOTIFICATIONS_STORAGE_KEY = 'sharkset_v7_smart_notifications';

interface SharkStoreState {
  smartNotifications: SmartNotificationItem[];
  notificationDrawerOpen: boolean;
  pushPermission: NotificationPermission;
  referenceClockTime: string; // e.g., "17:45"
  firebaseUserEmail: string | null;
  setNotificationDrawerOpen: (open: boolean) => void;
  setReferenceClockTime: (timeStr: string) => void;
  setFirebaseUserEmail: (email: string | null) => void;
  enablePushNotifications: () => Promise<NotificationPermission>;
  pushSmartNotification: (notif: SmartNotificationItem) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  dismissSmartNotification: (id: string) => void;
}

function loadInitialNotifications(): SmartNotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(items: SmartNotificationItem[]) {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export const useSharkStore = create<SharkStoreState>((set, get) => ({
  smartNotifications: loadInitialNotifications(),
  notificationDrawerOpen: false,
  pushPermission:
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'default',
  referenceClockTime: new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()),
  firebaseUserEmail: null,

  setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),

  setReferenceClockTime: (timeStr) => set({ referenceClockTime: timeStr }),

  setFirebaseUserEmail: (email) => set({ firebaseUserEmail: email }),

  enablePushNotifications: async () => {
    const perm = await requestBrowserPushPermission();
    set({ pushPermission: perm });
    return perm;
  },

  pushSmartNotification: (notif) => {
    const existing = get().smartNotifications;
    if (existing.some((n) => n.id === notif.id)) {
      const refreshed = existing.map((n) => (n.id === notif.id ? { ...notif, read: false } : n));
      saveNotifications(refreshed);
      set({ smartNotifications: refreshed });
      return;
    }
    dispatchPushNotificationChannel(notif);
    const updated = [notif, ...existing].slice(0, 30);
    saveNotifications(updated);
    set({ smartNotifications: updated });
  },

  markNotificationAsRead: (id) => {
    const updated = get().smartNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
    set({ smartNotifications: updated });
  },

  markAllNotificationsAsRead: () => {
    const updated = get().smartNotifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    set({ smartNotifications: updated });
  },

  dismissSmartNotification: (id) => {
    const updated = get().smartNotifications.filter((n) => n.id !== id);
    saveNotifications(updated);
    set({ smartNotifications: updated });
  },
}));
