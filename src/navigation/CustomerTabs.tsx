import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarProps,
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Product } from '../types';
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
import { getDivision, shadow } from '../utils/theme';
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
import LocationPickerScreen from '../features/customer/screens/LocationPickerScreen';
import {
  CustomerProfileStackParamList,
  CustomerTabParamList,
} from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

type HomeStackParamList = {
  Home: { location?: { text: string; lat: number; lng: number } } | undefined;
  LocationPicker: undefined;
  ProductOverview: {
    division: 'fmcg' | 'homeKitchen';
    productId?: string;
    subCategory?: string;
    brand?: string;
    company?: string;
    categoryFilter?: { ids: string[]; names: string[]; slugs?: string[] };
    initialProduct?: Product;
  };
  CategoryBrowse: {
    division: 'fmcg' | 'homeKitchen';
    mode?: 'categories' | 'brands' | 'companies';
    company?: string;
  };
  Notifications: undefined;
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
type OrdersStackParamList = {
  OrdersMain: undefined;
};
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

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
      <HomeStack.Screen name="Wishlist" component={WishlistScreen} />
      <HomeStack.Screen name="LocationPicker" component={LocationPickerScreen} />
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

const OrdersStackNavigator = () => {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
    </OrdersStack.Navigator>
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
  Orders: { outline: 'truck-outline', solid: 'truck' },
  Profile: { outline: 'account-outline', solid: 'account' },
};

const defaultTabLabels: Record<keyof CustomerTabParamList, string> = {
  Home: 'Home',
  Cart: 'Cart',
  Orders: 'Orders',
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
    s => (s.homeDivision?.division ?? 'fmcg') === 'homeKitchen',
  );
  const cartItems = useAppSelector(s => s.cart?.items ?? []);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const division = getDivision(isHomeKitchen ? 'homeKitchen' : 'fmcg');
  const accent = division.primary;
  const accentSoft = division.soft;

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

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title ?? label}
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabColumn}>
        <View
          style={[
            styles.tabIconPill,
            focused && { backgroundColor: accentSoft },
          ]}>
          <Icon
            name={focused ? icons.solid : icons.outline}
            size={22}
            color={focused ? accent : '#94A3B8'}
          />
          {name === 'Cart' && cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.tabLabel, { color: focused ? accent : '#94A3B8' }]}
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
      <View style={styles.barFace}>
        <View style={styles.barRow}>
          {state.routes.map((route, index) => renderTab(route, index))}
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

  const shouldHideForOrdersStack = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'OrdersMain';
    return routeName !== 'OrdersMain';
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
        name="Orders"
        component={OrdersStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForOrdersStack(route)),
          tabBarLabel: 'Orders',
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
    paddingHorizontal: 16,
  },
  barFace: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    ...shadow.lg,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  /** Equal thirds: same icon-over-label rhythm for Home, Cart, Account */
  tabColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconPill: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '100%',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: 14,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
});
