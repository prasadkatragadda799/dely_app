import { createNavigationContainerRef } from '@react-navigation/native';
import { NotificationPayload } from './pushService';

/**
 * Navigation ref used by notification handlers (and other non-React code)
 * to navigate from outside the React tree.
 */
export const navigationRef = createNavigationContainerRef<any>();

/** Safe nested-navigate that no-ops when the navigator isn't ready yet. */
function safeNavigate(name: string, params?: any) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(name, params);
}

/**
 * Translate a notification payload into a navigation action.
 * Called when the user taps a push notification.
 */
export function routeNotificationTap(payload: NotificationPayload) {
  const data = payload.data ?? {};
  const type = (data.type ?? '').toLowerCase();
  const audience = (data.audience ?? '').toLowerCase();

  // Delivery audience: route to the assigned-orders screen in DeliveryTabs.
  if (audience === 'delivery') {
    safeNavigate('AssignedOrders');
    return;
  }

  switch (type) {
    case 'order':
    case 'delivery':
    case 'payment':
      // Customer order/delivery/payment update → open Orders screen, deep-linked when possible.
      safeNavigate('Home', {
        screen: 'Orders',
        params: data.order_id ? { orderId: data.order_id } : undefined,
      });
      return;

    case 'kyc':
      safeNavigate('Profile', { screen: 'ProfileMain' });
      return;

    case 'welcome':
    case 'promo':
      safeNavigate('Home', { screen: 'Home' });
      return;

    default:
      // Fallback: open the in-app notifications inbox.
      safeNavigate('Home', { screen: 'Notifications' });
  }
}
