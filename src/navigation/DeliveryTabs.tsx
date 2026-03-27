import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AssignedOrdersScreen from '../features/delivery/screens/AssignedOrdersScreen';
import DeliveryProfileScreen from '../features/delivery/screens/DeliveryProfileScreen';
import HistoryScreen from '../features/delivery/screens/HistoryScreen';
import OngoingScreen from '../features/delivery/screens/OngoingScreen';
import { DeliveryTabParamList } from './types';

const Tab = createBottomTabNavigator<DeliveryTabParamList>();

const iconMap: Record<keyof DeliveryTabParamList, string> = {
  AssignedOrders: 'clipboard-list-outline',
  Ongoing: 'truck-delivery-outline',
  History: 'history',
  DeliveryProfile: 'account-circle-outline',
};

const getDeliveryTabBarIcon =
  (routeName: keyof DeliveryTabParamList) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon name={iconMap[routeName]} size={size} color={color} />;

const DeliveryTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopWidth: 0,
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          borderRadius: 18,
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: insets.bottom + 6,
          shadowColor: 'rgba(15, 23, 42, 0.14)',
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        tabBarIcon: getDeliveryTabBarIcon(route.name),
      })}
    >
      <Tab.Screen
        name="AssignedOrders"
        component={AssignedOrdersScreen}
        options={{ title: 'Assigned' }}
      />
      <Tab.Screen name="Ongoing" component={OngoingScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen
        name="DeliveryProfile"
        component={DeliveryProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default DeliveryTabs;
