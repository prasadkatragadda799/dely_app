import { Order } from '../../types';

type Events = {
  order_assigned: (order: Order) => void;
  order_status: (payload: { orderId: string; status: Order['status'] }) => void;
};

class MockSocketService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private assignedListeners: Events['order_assigned'][] = [];
  private statusListeners: Events['order_status'][] = [];

  connect() {
    // No-op: delivery orders are now fetched from backend APIs.
  }

  disconnect() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  on<K extends keyof Events>(event: K, callback: Events[K]) {
    if (event === 'order_assigned') {
      const listener = callback as Events['order_assigned'];
      this.assignedListeners.push(listener);
      return () => {
        this.assignedListeners = this.assignedListeners.filter(
          item => item !== listener,
        );
      };
    }
    const listener = callback as Events['order_status'];
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(item => item !== listener);
    };
  }

  emitStatus(orderId: string, status: Order['status']) {
    this.statusListeners.forEach(cb => cb({ orderId, status }));
  }
}

export const socketService = new MockSocketService();
