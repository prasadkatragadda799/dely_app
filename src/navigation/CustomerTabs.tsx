import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CartScreen from '../features/customer/screens/CartScreen';
import CheckoutScreen from '../features/customer/screens/CheckoutScreen';
import EditInfoScreen from '../features/customer/screens/EditInfoScreen';
import HelpSupportScreen from '../features/customer/screens/HelpSupportScreen';
import HomeScreen from '../features/customer/screens/HomeScreen';
import OrdersScreen from '../features/customer/screens/OrdersScreen';
import OrderSuccessScreen from '../features/customer/screens/OrderSuccessScreen';
import ProductOverviewScreen from '../features/customer/screens/ProductOverviewScreen';
import ProfileScreen from '../features/customer/screens/ProfileScreen';
import SecurityScreen from '../features/customer/screens/SecurityScreen';
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
    /** When set, browse list is limited to this subCategory */
    subCategory?: string;
    /** When set, browse list is limited to this brand */
    brand?: string;
  };
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

const iconMap: Record<keyof CustomerTabParamList, string> = {
  Home: 'home-outline',
  Orders: 'truck-delivery-outline',
  Wishlist: 'heart-outline',
  Cart: 'cart-outline',
  Profile: 'account-outline',
};

const getCustomerTabBarIcon =
  (routeName: keyof CustomerTabParamList) =>
  ({ color, size }: { color: string; size: number }) => (
    <Icon name={iconMap[routeName]} size={size} color={color} />
  );

const CustomerTabs = () => {
  const insets = useSafeAreaInsets();
  const baseTabBarStyle = {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 0,
    height: 66,
    paddingBottom: 8,
    paddingTop: 6,
    borderRadius: 18,
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: insets.bottom + 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  };

  const getTabBarStyle = (hide: boolean) =>
    hide ? [{ ...baseTabBarStyle }, { display: 'none' as const }] : baseTabBarStyle;

  const shouldHideForHomeStack = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
    return routeName !== 'Home';
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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarStyle: baseTabBarStyle,
        tabBarIcon: getCustomerTabBarIcon(route.name),
      })}>
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForHomeStack(route)),
        })}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Wishlist" component={WishlistScreen} />
      <Tab.Screen
        name="Cart"
        component={CartStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForCartStack(route)),
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={({ route }) => ({
          tabBarStyle: getTabBarStyle(shouldHideForProfileStack(route)),
        })}
      />
    </Tab.Navigator>
  );
};

export default CustomerTabs;
