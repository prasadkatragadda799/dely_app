import { Platform, PermissionsAndroid } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

export type NotificationData = Record<string, string | undefined>;

export type NotificationPayload = {
  title: string;
  body: string;
  data?: NotificationData;
  /** Whether the user opened/tapped the notification (vs received it in foreground). */
  opened?: boolean;
};

type NotificationListener = (payload: NotificationPayload) => void;

class PushService {
  private listeners: NotificationListener[] = [];
  private openListeners: NotificationListener[] = [];
  private unsubscribeForeground?: () => void;
  private unsubscribeOpenedApp?: () => void;
  private unsubscribeTokenRefresh?: () => void;
  private tokenRefreshListeners: Array<(token: string) => void> = [];
  private initialOpenChecked = false;

  private async requestAndroidPermission() {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  private async requestPushPermission() {
    const androidGranted = await this.requestAndroidPermission();
    if (!androidGranted) return false;

    const authStatus = await messaging().requestPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return isAuthorized;
  }

  private toPayload(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
    opened = false,
  ): NotificationPayload {
    const rawData = remoteMessage.data ?? {};
    const data: NotificationData = {};
    Object.keys(rawData).forEach(key => {
      const v = rawData[key];
      data[key] = v == null ? undefined : String(v);
    });
    return {
      title: remoteMessage.notification?.title ?? data.title ?? 'Notification',
      body: remoteMessage.notification?.body ?? data.body ?? '',
      data,
      opened,
    };
  }

  async init() {
    const granted = await this.requestPushPermission();
    if (!granted) return { granted: false, token: null as string | null };

    let token: string | null = null;
    try {
      token = await messaging().getToken();
      console.log('[FCM] Device token:', token);
    } catch (err) {
      console.warn('[FCM] getToken failed', err);
    }

    // Foreground: notification received while app is open.
    if (this.unsubscribeForeground) this.unsubscribeForeground();
    this.unsubscribeForeground = messaging().onMessage(remoteMessage => {
      const payload = this.toPayload(remoteMessage, false);
      this.listeners.forEach(listener => listener(payload));
    });

    // Background → tap: app in background and user taps the notification.
    if (this.unsubscribeOpenedApp) this.unsubscribeOpenedApp();
    this.unsubscribeOpenedApp = messaging().onNotificationOpenedApp(
      remoteMessage => {
        const payload = this.toPayload(remoteMessage, true);
        this.openListeners.forEach(listener => listener(payload));
      },
    );

    // Cold-start: app was killed and user tapped a notification to open it.
    if (!this.initialOpenChecked) {
      this.initialOpenChecked = true;
      messaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (!remoteMessage) return;
          const payload = this.toPayload(remoteMessage, true);
          this.openListeners.forEach(listener => listener(payload));
        })
        .catch(() => {
          // Initial notification check failures are non-fatal.
        });
    }

    if (this.unsubscribeTokenRefresh) this.unsubscribeTokenRefresh();
    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(tokenValue => {
      this.tokenRefreshListeners.forEach(listener => listener(tokenValue));
    });

    return { granted: true, token };
  }

  /** Listener fired when a notification arrives while the app is in the foreground. */
  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(item => item !== listener);
    };
  }

  /** Listener fired when the user taps a notification (background or quit state). */
  subscribeToOpens(listener: NotificationListener) {
    this.openListeners.push(listener);
    return () => {
      this.openListeners = this.openListeners.filter(item => item !== listener);
    };
  }

  onTokenRefresh(listener: (token: string) => void) {
    this.tokenRefreshListeners.push(listener);
    return () => {
      this.tokenRefreshListeners = this.tokenRefreshListeners.filter(
        item => item !== listener,
      );
    };
  }

  /** Replay a payload through the foreground listeners (for local in-app toasts). */
  sendLocal(payload: NotificationPayload) {
    this.listeners.forEach(listener => listener(payload));
  }
}

export const pushService = new PushService();
