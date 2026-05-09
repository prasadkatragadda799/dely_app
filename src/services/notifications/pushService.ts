import { Platform, PermissionsAndroid } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

export type NotificationPayload = {
  title: string;
  body: string;
};

type NotificationListener = (payload: NotificationPayload) => void;

class PushService {
  private listeners: NotificationListener[] = [];
  private unsubscribeForeground?: () => void;
  private tokenRefreshListeners: Array<(token: string) => void> = [];

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
  ): NotificationPayload {
    return {
      title: remoteMessage.notification?.title ?? 'Notification',
      body: remoteMessage.notification?.body ?? '',
    };
  }

  async init() {
    const granted = await this.requestPushPermission();
    if (!granted) return { granted: false, token: null as string | null };

    const token = await messaging().getToken();
    console.log('[FCM] Device token:', token);

    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }
    this.unsubscribeForeground = messaging().onMessage(remoteMessage => {
      const payload = this.toPayload(remoteMessage);
      this.listeners.forEach(listener => listener(payload));
    });

    messaging().onTokenRefresh(tokenValue => {
      this.tokenRefreshListeners.forEach(listener => listener(tokenValue));
    });

    return { granted: true, token };
  }

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(item => item !== listener);
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

  sendLocal(payload: NotificationPayload) {
    this.listeners.forEach(listener => listener(payload));
  }
}

export const pushService = new PushService();
