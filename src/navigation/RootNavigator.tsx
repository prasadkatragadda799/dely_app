import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
import { palette, divisionTheme } from '../utils/theme';
import {
  useRefreshTokenMutation,
  useRegisterFcmTokenMutation,
  useRegisterDeliveryFcmTokenMutation,
} from '../services/api/mobileApi';

const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: palette.bg },
};

const SplashScreen = () => (
  <View style={styles.splashContainer}>
    <View style={styles.splashGlowTop} />
    <View style={styles.splashGlowBottom} />
    <View style={styles.logoMark}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
    <Text style={styles.logoText}>Delycart</Text>
    <Text style={styles.logoTagline}>Quick commerce, beautifully simple</Text>
    <ActivityIndicator
      size="small"
      color={divisionTheme.fmcg.primary}
      style={styles.splashLoader}
    />
  </View>
);

const RootNavigator = () => {
  const dispatch = useAppDispatch();
  const { user, isSplashVisible } = useAppSelector(state => state.auth!);
  const [refreshTokenApi] = useRefreshTokenMutation();
  const [registerFcmToken] = useRegisterFcmTokenMutation();
  const [registerDeliveryFcmToken] = useRegisterDeliveryFcmTokenMutation();
  const hasAttemptedRefresh = useRef(false);

  // Keep refs to the latest mutation fns so the push effect doesn't need them
  // as dependencies (RTK Query mutation trigger references are unstable and would
  // cause pushService.init() to fire on every render).
  const registerFcmTokenRef = useRef(registerFcmToken);
  const registerDeliveryFcmTokenRef = useRef(registerDeliveryFcmToken);
  registerFcmTokenRef.current = registerFcmToken;
  registerDeliveryFcmTokenRef.current = registerDeliveryFcmToken;

  useEffect(() => {
    const timer = setTimeout(() => dispatch(hideSplash()), 1500);
    return () => clearTimeout(timer);
  }, [dispatch]);

  useEffect(() => {
    const syncFcmToken = (token: string) => {
      if (!token || !user?.token) return;
      const mutation =
        user.role === 'delivery'
          ? registerDeliveryFcmTokenRef.current
          : registerFcmTokenRef.current;
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
  }, [user?.role, user?.token]);

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
            ...(data.name && { name: data.name }),
            ...(data.email && { email: data.email }),
            ...(data.role && { role: data.role }),
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
      <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
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
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  splashGlowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -120,
    left: -90,
    backgroundColor: divisionTheme.fmcg.primary,
    opacity: 0.08,
  },
  splashGlowBottom: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -140,
    right: -110,
    backgroundColor: divisionTheme.homeKitchen.primary,
    opacity: 0.07,
  },
  logoMark: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  logoImage: { width: 76, height: 76 },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.ink,
  },
  logoTagline: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  splashLoader: { marginTop: 26 },
});

export default RootNavigator;
