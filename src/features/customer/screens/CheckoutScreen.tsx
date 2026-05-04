import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  Platform,
  PermissionsAndroid,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { useCart } from '../../../hooks/useCart';
import { pushService } from '../../../services/notifications/pushService';
import { useAppSelector } from '../../../hooks/redux';
import { PaymentMethod } from '../../../services/payments/paymentTypes';
import {
  useCreateOrderApiMutation,
  useGetProfileQuery,
  useLazyReverseGeocodeQuery,
} from '../../../services/api/mobileApi';

const methodItems: Array<{ key: PaymentMethod; title: string; subtitle: string; icon: string }> = [
  {
    key: 'cod',
    title: 'Cash on Delivery',
    subtitle: 'Pay in cash when your order is delivered',
    icon: 'cash',
  },
];

const CheckoutScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { items, clear } = useCart();
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cod');
  const [loading, setLoading] = useState(false);
  const [createOrderApi] = useCreateOrderApiMutation();
  const { data: profileRes } = useGetProfileQuery();
  const profile = profileRes?.data as any;

  const [reverseGeocode, { isFetching: isReverseGeocoding }] =
    useLazyReverseGeocodeQuery();
  const [isLocating, setIsLocating] = useState(false);

  const businessAddress = profile?.address;
  const addressLine1 =
    typeof businessAddress === 'object' && businessAddress
      ? businessAddress.address_line1 ??
        businessAddress.addressLine1 ??
        businessAddress.address_line ??
        businessAddress.address ??
        ''
      : '';
  const addressLine2 =
    typeof businessAddress === 'object' && businessAddress
      ? businessAddress.address_line2 ??
        businessAddress.addressLine2 ??
        businessAddress.landmark ??
        ''
      : '';
  const city = profile?.city ?? profile?.businessCity ?? '';
  const state = profile?.state ?? profile?.businessState ?? '';
  const pincode = profile?.pincode ?? profile?.businessPincode ?? '';

  // Local editable delivery address state for checkout.
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddressLine1, setEditAddressLine1] = useState(addressLine1);
  const [editAddressLine2, setEditAddressLine2] = useState(addressLine2);
  const [editCity, setEditCity] = useState(city);
  const [editState, setEditState] = useState(state);
  const [editPincode, setEditPincode] = useState(pincode);

  useEffect(() => {
    // Keep edit fields in sync with profile defaults.
    // If user is mid-edit, they can still cancel and revert.
    setEditAddressLine1(addressLine1);
    setEditAddressLine2(addressLine2);
    setEditCity(city);
    setEditState(state);
    setEditPincode(pincode);
  }, [addressLine1, addressLine2, city, state, pincode]);

  const addressText = [
    editAddressLine1 ? String(editAddressLine1) : '',
    editAddressLine2 ? String(editAddressLine2) : '',
    editCity ? String(editCity) : '',
    editState ? String(editState) : '',
    editPincode ? String(editPincode) : '',
  ]
    .filter(Boolean)
    .join(', ');

  const requestLocationPermissionAndroid = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const handleUseMyLocation = async () => {
    if (!reverseGeocode) return;

    try {
      const ok = await requestLocationPermissionAndroid();
      if (!ok) {
        Toast.show({
          type: 'error',
          text1: 'Location permission denied',
          text2: 'Please allow location permission and try again.',
        });
        return;
      }

      const geo = (globalThis as any)?.navigator?.geolocation;
      if (!geo?.getCurrentPosition) {
        Toast.show({
          type: 'error',
          text1: 'Geolocation not available',
          text2: 'Device geolocation is not supported in this environment.',
        });
        return;
      }

      setIsLocating(true);
      geo.getCurrentPosition(
        async (pos: any) => {
          try {
            const coords = pos?.coords || {};
            const lat = coords?.latitude;
            const lng = coords?.longitude;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
              throw new Error('Missing lat/lng from device');
            }

            const res = await reverseGeocode({ lat, lng }).unwrap();
            const data = res?.data;

            if (!data?.address_line1) {
              Toast.show({
                type: 'error',
                text1: 'Could not resolve address',
                text2: 'Google did not return address details for this location.',
              });
              return;
            }

            setEditAddressLine1(data.address_line1 ?? '');
            setEditAddressLine2(data.address_line2 ?? '');
            setEditCity(data.city ?? '');
            setEditState(data.state ?? '');
            setEditPincode(data.pincode ?? '');
          } catch (e) {
            Toast.show({
              type: 'error',
              text1: 'Location resolution failed',
              text2: 'Please try again or enter address manually.',
            });
          } finally {
            setIsLocating(false);
          }
        },
        () => {
          setIsLocating(false);
          Toast.show({
            type: 'error',
            text1: 'Failed to get your location',
            text2: 'Please try again.',
          });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    } catch {
      Toast.show({ type: 'error', text1: 'Could not fetch location' });
      setIsLocating(false);
    }
  };

  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';

  // Cart is now backed by API and already scoped to the active division.
  const visibleItems = useMemo(() => items, [items]);

  const subtotal = visibleItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const handlePlaceOrder = async () => {
    if (!visibleItems.length) {
      Toast.show({ type: 'error', text1: 'Your cart is empty for this division' });
      return;
    }

    try {
      setLoading(true);
      const businessAddress = profile?.address;

      const orderAddressLine1 = String(editAddressLine1 ?? '').trim();
      const orderAddressLine2 = String(editAddressLine2 ?? '').trim();
      const orderCity = String(editCity ?? '').trim();
      const orderState = String(editState ?? '').trim();
      const orderPincode = String(editPincode ?? '').trim();

      // Coordinates (if present) are stored by backend inside the user `address` JSON.
      const latitude =
        typeof profile?.latitude === 'number'
          ? profile.latitude
          : typeof businessAddress?.latitude === 'number'
            ? businessAddress.latitude
            : undefined;
      const longitude =
        typeof profile?.longitude === 'number'
          ? profile.longitude
          : typeof businessAddress?.longitude === 'number'
            ? businessAddress.longitude
            : undefined;

      if (!orderAddressLine1 || !orderCity || !orderState || !orderPincode) {
        Toast.show({
          type: 'error',
          text1: 'Delivery address missing',
          text2: 'Please complete your address details in profile before placing an order.',
        });
        return;
      }

      const deliveryAddress: Record<string, any> = {
        // backend order-create accepts an address dict; it does not validate `name`.
        name: user?.name ?? 'Customer User',
        address_line1: orderAddressLine1,
        address_line2: String(orderAddressLine2 ?? ''),
        city: orderCity,
        state: orderState,
        pincode: orderPincode,
      };

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        deliveryAddress.latitude = latitude;
        deliveryAddress.longitude = longitude;
      }

      // 1) Create COD order in backend.
      const createRes = await createOrderApi({
        items: visibleItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          price_option_key: i.priceOptionKey,
        })),
        delivery_address: deliveryAddress,
        payment_method: 'cod',
      }).unwrap();

      if (!createRes?.success) {
        throw new Error(createRes?.message ?? 'Could not create order');
      }

      const order = createRes.data as any;
      const orderId = String(order.id);
      const amountToPay = Number(order.total ?? order.subtotal ?? subtotal);
      const providerLabel = 'Cash on Delivery';

      pushService.sendLocal({
        title: 'Order Placed',
        body: `${orderId} placed via ${providerLabel}`,
      });

      // Backend clears the entire cart for the user, so match it locally.
      clear();
      navigation.replace('OrderSuccess', {
        orderId,
        amount: amountToPay,
        provider: providerLabel,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not place order' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}>
          <Icon name="arrow-left" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + insets.bottom + 120 },
        ]}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: primaryText }]}>Delivery Address</Text>
          {!isEditingAddress ? (
            <View style={styles.addressRow}>
              <Icon name="map-marker-outline" size={18} color={primary} />
              <Text style={styles.addressText}>{addressText || '—'}</Text>
              <TouchableOpacity
                style={[styles.editAddressButton, { borderColor: `${primary}66` }]}
                onPress={() => setIsEditingAddress(true)}
                activeOpacity={0.9}>
                <Text style={[styles.editAddressButtonText, { color: primary }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.editAddressContainer}>
              <Text style={styles.editLabel}>Address line 1 *</Text>
              <TextInput
                style={styles.editInput}
                value={editAddressLine1}
                onChangeText={setEditAddressLine1}
                placeholder="House / street / locality"
                autoCapitalize="none"
              />

              <Text style={styles.editLabel}>Address line 2</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 44 }]}
                value={editAddressLine2}
                onChangeText={setEditAddressLine2}
                placeholder="Landmark (optional)"
                autoCapitalize="sentences"
              />

              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>City *</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="City"
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>State *</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editState}
                    onChangeText={setEditState}
                    placeholder="State"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Text style={styles.editLabel}>Pincode *</Text>
              <TextInput
                style={styles.editInput}
                value={editPincode}
                onChangeText={setEditPincode}
                placeholder="Pincode"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.useLocationButton, { borderColor: `${primary}66` }]}
                onPress={handleUseMyLocation}
                disabled={isLocating || isReverseGeocoding || loading}>
                <Text style={[styles.useLocationButtonText, { color: primary }]}>
                  {isLocating || isReverseGeocoding ? 'Getting location...' : 'Use my location'}
                </Text>
              </TouchableOpacity>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editActionButton, { backgroundColor: 'rgba(148,163,184,0.15)' }]}
                  onPress={() => {
                    setEditAddressLine1(addressLine1);
                    setEditAddressLine2(addressLine2);
                    setEditCity(city);
                    setEditState(state);
                    setEditPincode(pincode);
                    setIsEditingAddress(false);
                  }}
                  activeOpacity={0.9}>
                  <Text style={[styles.editActionButtonText, { color: '#64748B' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editActionButton, { backgroundColor: primary }]}
                  onPress={() => setIsEditingAddress(false)}
                  disabled={loading}
                  activeOpacity={0.9}>
                  <Text style={[styles.editActionButtonText, { color: '#FFFFFF' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: primaryText }]}>Payment Method</Text>
          {methodItems.map(item => {
            const active = selectedMethod === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.paymentOption,
                  active && { borderColor: primary, backgroundColor: 'rgba(255,255,255,0.95)' },
                ]}
                onPress={() => setSelectedMethod(item.key)}
                activeOpacity={0.9}>
                <View style={styles.paymentLeft}>
                  <View style={[styles.iconCircle, active && { backgroundColor: primary }]}>
                    <Icon
                      name={item.icon}
                      size={16}
                      color={active ? '#FFFFFF' : '#475569'}
                    />
                  </View>
                  <View>
                    <Text style={styles.paymentTitle}>{item.title}</Text>
                    <Text style={styles.paymentSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Icon
                  name={active ? 'check-circle' : 'circle-outline'}
                  size={20}
                  color={active ? primary : '#94A3B8'}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: primaryText }]}>Order Summary</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Items</Text>
            <Text style={styles.rowValue}>{visibleItems.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>Rs {subtotal}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Delivery</Text>
            <Text style={[styles.rowValue, { color: '#16A34A' }]}>Free</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {subtotal}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.placeOrderButton, { backgroundColor: primary }]}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.92}>
          <Icon name="shield-check-outline" size={18} color="#FFFFFF" />
          <Text style={styles.placeOrderText}>
            {loading ? 'Placing Order...' : 'Place COD Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
  content: { padding: 14, paddingBottom: 140, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText: { color: '#334155', fontWeight: '700', flex: 1 },
  editAddressButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  editAddressButtonText: {
    fontWeight: '900',
  },
  editAddressContainer: {
    gap: 8,
  },
  editLabel: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  editInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontWeight: '700',
  },
  useLocationButton: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
  },
  useLocationButtonText: {
    fontWeight: '900',
  },
  editRow: { flexDirection: 'row', gap: 10 },
  editHalf: { flex: 1 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  editActionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionButtonText: {
    fontWeight: '900',
  },
  paymentOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  paymentTitle: { color: '#0F172A', fontWeight: '900' },
  paymentSubtitle: { color: '#64748B', marginTop: 2, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { color: '#64748B', fontWeight: '700' },
  rowValue: { color: '#0F172A', fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  totalLabel: { color: '#0F172A', fontWeight: '900', fontSize: 16 },
  totalValue: { color: '#0F172A', fontWeight: '900', fontSize: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  placeOrderButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  placeOrderText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});

export default CheckoutScreen;
