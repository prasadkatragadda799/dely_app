import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NotificationPayload,
  pushService,
} from '../services/notifications/pushService';
import { routeNotificationTap } from '../services/notifications/notificationRouter';

const ICON_BY_TYPE: Record<string, string> = {
  order: 'receipt-outline',
  delivery: 'bicycle-outline',
  delivery_assignment: 'bicycle-outline',
  payment: 'card-outline',
  kyc: 'shield-checkmark-outline',
  welcome: 'sparkles-outline',
  promo: 'pricetag-outline',
};

const AUTO_DISMISS_MS = 4500;

/**
 * Subscribes to foreground push notifications and renders a transient banner
 * at the top of the screen. Tapping the banner routes via notificationRouter.
 */
const NotificationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-200)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = React.useCallback(() => {
    Animated.timing(translateY, {
      toValue: -200,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setPayload(null));
  }, [translateY]);

  useEffect(() => {
    const unsubscribe = pushService.subscribe(next => {
      // Only show banner for foreground messages with content.
      if (!next || (!next.title && !next.body)) return;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setPayload(next);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    });
    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [dismiss, translateY]);

  if (!payload) return null;

  const type = payload.data?.type ?? 'default';
  const iconName = ICON_BY_TYPE[type] ?? 'notifications-outline';

  const onPress = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    routeNotificationTap({ ...payload, opened: true });
    dismiss();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY }], paddingTop: insets.top + 8 },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.iconWrap}>
          <Icon name={iconName} size={22} color="#7C3AED" />
        </View>
        <View style={styles.body}>
          {!!payload.title && (
            <Text numberOfLines={1} style={styles.title}>
              {payload.title}
            </Text>
          )}
          {!!payload.body && (
            <Text numberOfLines={2} style={styles.message}>
              {payload.body}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={8} style={styles.close}>
          <Icon name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  message: { fontSize: 12, color: '#475569', marginTop: 2 },
  close: { paddingLeft: 8 },
});

export default NotificationBanner;
