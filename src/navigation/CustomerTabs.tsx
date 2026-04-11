import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarProps,
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppSelector } from '../hooks/redux';
import CartScreen from '../features/customer/screens/CartScreen';
import CheckoutScreen from '../features/customer/screens/CheckoutScreen';
import EditInfoScreen from '../features/customer/screens/EditInfoScreen';
import HelpSupportScreen from '../features/customer/screens/HelpSupportScreen';
import HomeScreen from '../features/customer/screens/HomeScreen';
import OrdersScreen from '../features/customer/screens/OrdersScreen';
import OrderSuccessScreen from '../features/customer/screens/OrderSuccessScreen';
import CategoryBrowseScreen from '../features/customer/screens/CategoryBrowseScreen';
import ProductOverviewScreen from '../features/customer/screens/ProductOverviewScreen';
import ProfileScreen from '../features/customer/screens/ProfileScreen';
import SecurityScreen from '../features/customer/screens/SecurityScreen';
import NotificationsScreen from '../features/customer/screens/NotificationsScreen';
import WishlistScreen from '../features/customer/screens/WishlistScreen';
import {
  CustomerProfileStackParamList,
  CustomerTabParamList,
} from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

type HomeStackParamList = {
  Home: undefined;
  ProductOverview: {
    division: 'fmcg' | 'homeKitchen';
    productId?: string;
    subCategory?: string;
    brand?: string;
    company?: string;
    categoryFilter?: { ids: string[]; names: string[]; slugs?: string[] };
  };
  CategoryBrowse: {
    division: 'fmcg' | 'homeKitchen';
    mode?: 'categories' | 'brands' | 'companies';
  };
  Notifications: undefined;
  Orders: undefined;
  Wishlist: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
type CartStackParamList = {
  CartMain: undefined;
  Checkout: undefined;
  OrderSuccess: { orderId: string; amount: number; provider: string };
};
const CartStack = createNativeStackNavigator<CartStackParamList>();
const ProfileStack = createNativeStackNavigator<CustomerProfileStackParamList>();

const HomeStackNavigator = () => {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen
        name="ProductOverview"
        component={ProductOverviewScreen}
      />
      <HomeStack.Screen
        name="CategoryBrowse"
        component={CategoryBrowseScreen}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreen}
      />
      <HomeStack.Screen name="Orders" component={OrdersScreen} />
      <HomeStack.Screen name="Wishlist" component={WishlistScreen} />
    </HomeStack.Navigator>
  );
};

const CartStackNavigator = () => {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen name="CartMain" component={CartScreen} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} />
      <CartStack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
    </CartStack.Navigator>
  );
};

const ProfileStackNavigator = () => {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerTintColor: '#0B3B8F',
        headerStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditInfo"
        component={EditInfoScreen}
        options={{ title: 'Edit Info' }}
      />
      <ProfileStack.Screen
        name="Security"
        component={SecurityScreen}
        options={{ title: 'Security' }}
      />
      <ProfileStack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ title: 'Help & Support' }}
      />
    </ProfileStack.Navigator>
  );
};

const tabBarHiddenBase = {
  display: 'none' as const,
};

const transparentTabBarShell = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  elevation: 0,
  shadowOpacity: 0,
};

const tabIcons: Record<
  keyof CustomerTabParamList,
  { outline: string; solid: string }
> = {
  Home: { outline: 'home-outline', solid: 'home' },
  Cart: { outline: 'cart-outline', solid: 'cart' },
  Profile: { outline: 'account-outline', solid: 'account' },
};

const defaultTabLabels: Record<keyof CustomerTabParamList, string> = {
  Home: 'Home',
  Cart: 'Cart',
  Profile: 'Account',
};

function useTabKeyboardOpen() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const show =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(show, () => setOpen(true));
    const s2 = Keyboard.addListener(hide, () => setOpen(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);
  return open;
}

/**
 * Custom tab bar — single-layer icons only (no default TabBarIcon stacking).
 * Styled as a compact floating capsule with accent wash, inner bezel, and a
 * subtle center “jewel” for cart.
 */
function CustomerStyledTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  const keyboardOpen = useTabKeyboardOpen();
  const isHomeKitchen = useAppSelector(
    s => s.homeDivision.division === 'homeKitchen',
  );
  const accent = isHomeKitchen ? '#16A34A' : '#2563EB';
  const accentWash = isHomeKitchen
    ? 'rgba(22,163,74,0.09)'
    : 'rgba(37,99,235,0.09)';
  const accentSoft = isHomeKitchen
    ? 'rgba(22,163,74,0.16)'
    : 'rgba(37,99,235,0.14)';

  const { state, descriptors, navigation } = props;
  const activeRoute = state.routes[state.index];
  const focusedOptions = descriptors[activeRoute.key].options;
  const tabBarFlat = StyleSheet.flatten(
    focusedOptions.tabBarStyle,
  ) as { display?: string } | undefined;
  const hiddenByRoute = tabBarFlat?.display === 'none';
  const hideForKeyboard =
    Boolean(focusedOptions.tabBarHideOnKeyboard) && keyboardOpen;

  React.useEffect(() => {
    if (hiddenByRoute || hideForKeyboard) {
      onHeightChange?.(0);
    }
  }, [hiddenByRoute, hideForKeyboard, onHeightChange]);

  if (hiddenByRoute || hideForKeyboard) {
    return null;
  }

  const onBarLayout = (e: LayoutChangeEvent) => {
    onHeightChange?.(e.nativeEvent.layout.height);
  };

  const renderTab = (route: (typeof props.state.routes)[number], index: number) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const name = route.name as keyof CustomerTabParamList;
    const icons = tabIcons[name];
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : defaultTabLabels[name];

    const onPress = () => {
      const ev = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !ev.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    const inactiveMount = {
      backgroundColor: '#FFFFFF',
      borderColor: 'rgba(15,23,42,0.08)',
    } as const;
    const activeMount = {
      backgroundColor: accentSoft,
      borderColor: `${accent}50`,
    } as const;

    if (name === 'Cart') {
      return (
        <TouchableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={options.title ?? label}
          activeOpacity={0.9}
          onPress={onPress}
          onLongPress={onLongPress}
          style={styles.tabColumn}>
          <View
            style={[
              styles.tabIconMount,
              focused
                ? {
                    backgroundColor: accent,
                    borderColor: `${accent}CC`,
                    shadowColor: accent,
                    shadowOpacity: 0.28,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 4,
                  }
                : inactiveMount,
            ]}>
            <Icon
              name={focused ? icons.solid : icons.outline}
              size={19}
              color={focused ? '#FFFFFF' : '#64748B'}
            />
          </View>
          <Text
            style={[
              styles.tabLabelUnder,
              { color: focused ? accent : '#64748B' },
            ]}
            numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title ?? label}
        activeOpacity={0.88}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabColumn}>
        <View
          style={[
            styles.tabIconMount,
            focused ? activeMount : inactiveMount,
          ]}>
          <Icon
            name={focused ? icons.solid : icons.outline}
            size={19}
            color={focused ? accent : '#64748B'}
          />
        </View>
        <Text
          style={[
            styles.tabLabelUnder,
            { color: focused ? accent : '#64748B' },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      onLayout={onBarLayout}
      pointerEvents="box-none"
      style={[
        styles.barRoot,
        { paddingBottom: Math.max(insets.bottom, 6) },
      ]}>
      <View style={styles.barOuter}>
        <View style={styles.barFace}>
          <View
            pointerEvents="none"
            style={[styles.barWash, { backgroundColor: accentWash }]}
          />
          <View style={styles.barInnerHighlight} />
          <View style={styles.barRow}>
            {state.routes.map((route, index) => renderTab(route, index))}
          </View>
        </View>
      </View>
    </View>
  );
}

const CustomerTabs = () => {
  const getTabBarStyle = (hide: boolean) =>
    hide
      ? [transparentTabBarShell, tabBarHiddenBase]
      : transparentTabBarShell;

  const shouldHideForHomeStack = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
    const tabBarVisibleRoutes = new Set([
      'Home',
      'Orders',
      'Wishlist',
    ]);
    return !tabBarVisibleRoutes.has(routeName);
  };

  const shouldHideForCartStack = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'CartMain';
    return routeName !== 'CartMain';
  };

  const shouldHideForProfileStack = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'ProfileMain';
    return routeName !== 'ProfileMain';
  };

  return (
    <Tab.Navigator
      tabBar={(props: BottomTabBarProps) => <CustomerStyledTabBar {...props} />}
      screenOptions={(): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: transparentTabBarShell,
      })}>
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForHomeStack(route)),
          tabBarLabel: 'Home',
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForCartStack(route)),
          tabBarLabel: 'Cart',
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForProfileStack(route)),
          tabBarLabel: 'Account',
        })}
      />
    </Tab.Navigator>
  );
};

export default CustomerTabs;

const styles = StyleSheet.create({
  barRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
  },
  /** Soft “lift” under the capsule */
  barOuter: {
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    padding: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 14,
    overflow: 'visible',
  },
  /** Subtle division-tinted veil (top of capsule only) */
  barWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
  },
  barFace: {
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  barInnerHighlight: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    zIndex: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 5,
    gap: 4,
    zIndex: 1,
  },
  /** Equal thirds: same icon-over-label rhythm for Home, Cart, Account */
  tabColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tabIconMount: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelUnder: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: '100%',
  },
});
