import { create } from 'zustand';
import { SmartNotificationItem } from '../types';
import { INITIAL_SMART_NOTIFICATIONS } from '../data/initialData';
import {
  dispatchPushNotificationChannel,
  requestBrowserPushPermission,
} from '../services/smartAlertEngine';

const NOTIFICATIONS_STORAGE_KEY = 'sharkset_v2_smart_notifications';

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
  markAllNotificationsAsRead: () => void;
  dismissSmartNotification: (id: string) => void;
}

function loadInitialNotifications(): SmartNotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : INITIAL_SMART_NOTIFICATIONS;
  } catch {
    return INITIAL_SMART_NOTIFICATIONS;
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
  referenceClockTime: '17:45',
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
    dispatchPushNotificationChannel(notif);
    const updated = [notif, ...get().smartNotifications].slice(0, 30);
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
