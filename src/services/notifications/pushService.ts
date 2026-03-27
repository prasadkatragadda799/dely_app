type NotificationPayload = {
  title: string;
  body: string;
};

type NotificationListener = (payload: NotificationPayload) => void;

class MockPushService {
  private listeners: NotificationListener[] = [];

  init() {
    return { granted: true };
  }

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(item => item !== listener);
    };
  }

  sendLocal(payload: NotificationPayload) {
    this.listeners.forEach(listener => listener(payload));
  }
}

export const pushService = new MockPushService();
