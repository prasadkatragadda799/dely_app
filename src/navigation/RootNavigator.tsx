import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hideSplash, loginSuccess } from '../features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { pushService } from '../services/notifications/pushService';
import {
  navigationRef,
  routeNotificationTap,
} from '../services/notifications/notificationRouter';
import NotificationBanner from '../components/NotificationBanner';
import AuthStack from './AuthStack';
import CustomerTabs from './CustomerTabs';
import DeliveryTabs from './DeliveryTabs';
import {
  useRefreshTokenMutation,
  useRegisterFcmTokenMutation,
  useRegisterDeliveryFcmTokenMutation,
} from '../services/api/mobileApi';

const SplashScreen = () => (
  <View style={styles.splashContainer}>
    <Image
      source={require('../../assets/logo.png')}
      style={styles.logoImage}
      resizeMode="contain"
    />
    <Text style={styles.logoText}>Delycart</Text>
    <ActivityIndicator size="large" color="#7C3AED" />
  </View>
);

const RootNavigator = () => {
  const dispatch = useAppDispatch();
  const { user, isSplashVisible } = useAppSelector(state => state.auth);
  const [refreshTokenApi] = useRefreshTokenMutation();
  const [registerFcmToken] = useRegisterFcmTokenMutation();
  const [registerDeliveryFcmToken] = useRegisterDeliveryFcmTokenMutation();
  const hasAttemptedRefresh = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => dispatch(hideSplash()), 1500);
    return () => clearTimeout(timer);
  }, [dispatch]);

  useEffect(() => {
    const syncFcmToken = (token: string) => {
      if (!token || !user?.token) return;
      const mutation =
        user.role === 'delivery' ? registerDeliveryFcmToken : registerFcmToken;
      mutation({ token }).catch(() => {
        // Token registration should not interrupt app usage.
      });
    };

    pushService
      .init()
      .then(result => {
        if (!result.granted || !result.token) return;
        syncFcmToken(result.token);
      })
      .catch(() => {
        // Push setup should not block app startup if permission/API calls fail.
      });
    const unsubscribeTokenRefresh = pushService.onTokenRefresh(syncFcmToken);
    // Tap on a background or quit-state notification → route to the right screen.
    const unsubscribeOpens = pushService.subscribeToOpens(payload => {
      routeNotificationTap(payload);
    });
    return () => {
      unsubscribeOpens();
      unsubscribeTokenRefresh();
    };
  }, [registerFcmToken, registerDeliveryFcmToken, user?.role, user?.token]);

  useEffect(() => {
    if (hasAttemptedRefresh.current) return;
    if (!user?.refreshToken) return;
    // Backend refresh-token endpoint is for client users (it expects JWT `sub`).
    // Delivery JWTs use `deliveryPersonId`, so refreshing them via `/auth/refresh-token`
    // will fail. Skip refresh for delivery role.
    if (user?.role === 'delivery') return;

    hasAttemptedRefresh.current = true;
    refreshTokenApi({ refreshToken: user.refreshToken })
      .unwrap()
      .then((res: any) => {
        const data = res?.data;
        if (!res?.success || !data?.token || !data?.refresh_token) return;

        dispatch(
          loginSuccess({
            ...user,
            token: data.token,
            refreshToken: data.refresh_token,
          }),
        );
      })
      .catch(() => {
        // If refresh fails, user stays as-is and the next API call will error;
        // the app can still fall back to manual re-login.
      });
  }, [dispatch, refreshTokenApi, user, user?.refreshToken]);

  if (isSplashVisible) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        {!user ? (
          <AuthStack />
        ) : user.role === 'delivery' ? (
          <DeliveryTabs />
        ) : (
          <CustomerTabs />
        )}
        {/* Banner sits above the navigator so it overlays any screen. */}
        {user ? <NotificationBanner /> : null}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoImage: { width: 140, height: 70, marginBottom: 8 },
  logoText: { fontSize: 34, fontWeight: '900', color: '#7C3AED', marginBottom: 18 },
});

export default RootNavigator;
