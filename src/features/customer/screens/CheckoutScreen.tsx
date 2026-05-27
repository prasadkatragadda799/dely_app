import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { useCart } from '../../../hooks/useCart';
import { pushService } from '../../../services/notifications/pushService';
import { useAppSelector } from '../../../hooks/redux';
import { PaymentMethod } from '../../../services/payments/paymentTypes';
import {
  useCreateDeliveryLocationMutation,
  useCreateOrderApiMutation,
  useGetDeliveryLocationsQuery,
  useGetProfileQuery,
  useLazyReverseGeocodeQuery,
} from '../../../services/api/mobileApi';
import { getApiErrorMessage } from '../../../utils/apiErrorMessage';

type SavedAddress = {
  id: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  type?: 'home' | 'office' | 'other' | string;
  is_default?: boolean;
};

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
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
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

  // Saved delivery addresses (Flipkart/Amazon style picker).
  const {
    data: savedAddressesEnvelope,
    refetch: refetchSavedAddresses,
    isLoading: isLoadingSavedAddresses,
  } = useGetDeliveryLocationsQuery();
  const savedAddresses = useMemo<SavedAddress[]>(
    () => ((savedAddressesEnvelope?.data as SavedAddress[]) ?? []) || [],
    [savedAddressesEnvelope],
  );
  const [createDeliveryLocation, { isLoading: isSavingAddress }] =
    useCreateDeliveryLocationMutation();

  // Pick the user's default saved address as the initial selection. Falls back
  // to the first saved address if none is marked default; null if list is empty.
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedAddressId) {
      // Selection already valid?
      if (savedAddresses.some(a => String(a.id) === selectedAddressId)) return;
    }
    if (savedAddresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }
    const def = savedAddresses.find(a => a.is_default) ?? savedAddresses[0];
    setSelectedAddressId(String(def.id));
  }, [savedAddresses, selectedAddressId]);

  // Auto-seed the first delivery location from the registration address the very
  // first time this user hits checkout with no saved addresses. After seeding,
  // the address is pre-selected so checkout works without any manual input.
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (
      hasSeededRef.current ||
      isLoadingSavedAddresses ||
      savedAddresses.length > 0 ||
      !addressLine1.trim() ||
      !city.trim() ||
      !state.trim() ||
      pincode.trim().length !== 6
    ) {
      return;
    }
    hasSeededRef.current = true;
    createDeliveryLocation({
      address_line1: addressLine1.trim(),
      address_line2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      type: 'home',
      is_default: true,
    } as any)
      .unwrap()
      .then(res => {
        const created = (res?.data as SavedAddress | undefined) ?? null;
        refetchSavedAddresses();
        if (created?.id) setSelectedAddressId(String(created.id));
      })
      .catch(() => {
        // Silently fail — the user can still add an address manually.
        hasSeededRef.current = false;
      });
  }, [isLoadingSavedAddresses, savedAddresses.length, addressLine1, city, state, pincode]);

  const selectedAddress = useMemo(
    () =>
      selectedAddressId
        ? savedAddresses.find(a => String(a.id) === selectedAddressId) ?? null
        : null,
    [savedAddresses, selectedAddressId],
  );

  // Inline "Add new address" form (replaces the old "Edit address" pattern).
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editAddressLine1, setEditAddressLine1] = useState(addressLine1);
  const [editAddressLine2, setEditAddressLine2] = useState(addressLine2);
  const [editCity, setEditCity] = useState(city);
  const [editState, setEditState] = useState(state);
  const [editPincode, setEditPincode] = useState(pincode);
  const [newAddressType, setNewAddressType] = useState<'home' | 'office' | 'other'>('home');
  const [newAddressDefault, setNewAddressDefault] = useState(false);

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

      setIsLocating(true);
      Geolocation.getCurrentPosition(
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

      // The user must have either picked a saved address or be in the middle of
      // adding one. Saved addresses live in /delivery and the order endpoint
      // accepts `delivery_location_id`; we send that and let the backend resolve
      // the address dict, which keeps the snapshot in sync with what's saved.
      if (isAddingAddress) {
        Toast.show({
          type: 'error',
          text1: 'Save your address first',
          text2: 'Tap "Save & use" on the new address before placing the order.',
        });
        return;
      }

      if (!selectedAddress) {
        Toast.show({
          type: 'error',
          text1: 'Choose a delivery address',
          text2: 'Add or select an address before placing this order.',
        });
        return;
      }

      const orderAddressLine1 = String(selectedAddress.address_line1 ?? '').trim();
      const orderAddressLine2 = String(selectedAddress.address_line2 ?? '').trim();
      const orderCity = String(selectedAddress.city ?? '').trim();
      const orderState = String(selectedAddress.state ?? '').trim();
      const orderPincode = String(selectedAddress.pincode ?? '').trim();

      if (!orderAddressLine1 || !orderCity || !orderState || !orderPincode) {
        Toast.show({
          type: 'error',
          text1: 'Selected address is incomplete',
          text2: 'Update or add a different delivery address.',
        });
        return;
      }

      // Send delivery_location_id; backend reads the saved row and snapshots it.
      // We also send delivery_address as a fallback so older backends still work.
      const deliveryAddress: Record<string, any> = {
        name: user?.name ?? 'Customer User',
        address_line1: orderAddressLine1,
        address_line2: orderAddressLine2,
        city: orderCity,
        state: orderState,
        pincode: orderPincode,
      };

      // 1) Create COD order in backend.
      const createRes = await createOrderApi({
        items: visibleItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          price_option_key: i.priceOptionKey,
          variant_id: i.variantId,
        })),
        delivery_location_id: selectedAddress.id,
        delivery_address: deliveryAddress,
        payment_method: 'cod',
      } as any).unwrap();

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
    } catch (err) {
      // Surface the real backend reason (e.g. "Delivery is not available in your
      // location.", "Insufficient stock", "Minimum order quantity is 12") instead of
      // a generic toast that leaves the user guessing.
      const reason = getApiErrorMessage(err, 'Could not place order');
      Toast.show({
        type: 'error',
        text1: 'Could not place order',
        text2: reason,
        visibilityTime: 5000,
      });
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
          <View style={styles.addressHeaderRow}>
            <Text style={[styles.cardTitle, { color: primaryText, marginBottom: 0 }]}>
              Delivery Address
            </Text>
            {savedAddresses.length > 0 && !isAddingAddress && (
              <TouchableOpacity
                style={[styles.addNewAddressBtn, { borderColor: `${primary}66` }]}
                onPress={() => {
                  setEditAddressLine1('');
                  setEditAddressLine2('');
                  setEditCity('');
                  setEditState('');
                  setEditPincode('');
                  setNewAddressType('home');
                  setNewAddressDefault(false);
                  setIsAddingAddress(true);
                }}
                activeOpacity={0.85}
              >
                <Icon name="plus" size={14} color={primary} />
                <Text style={[styles.addNewAddressText, { color: primary }]}>Add new</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Saved addresses picker */}
          {!isAddingAddress && savedAddresses.length > 0 && (
            <View style={styles.savedAddressList}>
              {savedAddresses.map(addr => {
                const id = String(addr.id);
                const isSelected = id === selectedAddressId;
                const typeLabel = (addr.type || 'home').toString();
                const fullAddress = [
                  addr.address_line1,
                  addr.address_line2,
                  [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.savedAddressCard,
                      isSelected && { borderColor: primary, backgroundColor: `${primary}0D` },
                    ]}
                    onPress={() => setSelectedAddressId(id)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && { borderColor: primary },
                      ]}
                    >
                      {isSelected && (
                        <View style={[styles.radioInner, { backgroundColor: primary }]} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.savedAddressBadgeRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            { backgroundColor: `${primary}1A`, borderColor: `${primary}40` },
                          ]}
                        >
                          <Icon
                            name={
                              typeLabel === 'office'
                                ? 'office-building-outline'
                                : typeLabel === 'other'
                                  ? 'map-marker-outline'
                                  : 'home-outline'
                            }
                            size={11}
                            color={primary}
                          />
                          <Text style={[styles.typeBadgeText, { color: primary }]}>
                            {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
                          </Text>
                        </View>
                        {addr.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.savedAddressLine}>{fullAddress || '—'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Empty state */}
          {!isAddingAddress && savedAddresses.length === 0 && (
            <View style={styles.emptyAddressBox}>
              <Icon name="map-marker-plus-outline" size={28} color={primary} />
              <Text style={styles.emptyAddressTitle}>No saved addresses</Text>
              <Text style={styles.emptyAddressSubtitle}>
                Add a delivery address to place this order.
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddressBtn, { backgroundColor: primary }]}
                onPress={() => {
                  setEditAddressLine1(addressLine1);
                  setEditAddressLine2(addressLine2);
                  setEditCity(city);
                  setEditState(state);
                  setEditPincode(pincode);
                  setNewAddressType('home');
                  setNewAddressDefault(true);
                  setIsAddingAddress(true);
                }}
                activeOpacity={0.9}
              >
                <Icon name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.emptyAddressBtnText}>Add address</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add-new form */}
          {isAddingAddress && (
            <View style={styles.editAddressContainer}>
              <View style={styles.typeRow}>
                {(['home', 'office', 'other'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      newAddressType === t && { backgroundColor: primary, borderColor: primary },
                    ]}
                    onPress={() => setNewAddressType(t)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        newAddressType === t && { color: '#FFFFFF' },
                      ]}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                style={styles.defaultToggleRow}
                onPress={() => setNewAddressDefault(v => !v)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.checkbox,
                    newAddressDefault && { backgroundColor: primary, borderColor: primary },
                  ]}
                >
                  {newAddressDefault && <Icon name="check" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.defaultToggleText}>Set as default delivery address</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.useLocationButton, { borderColor: `${primary}66` }]}
                onPress={handleUseMyLocation}
                disabled={isLocating || isReverseGeocoding || loading || isSavingAddress}>
                <Text style={[styles.useLocationButtonText, { color: primary }]}>
                  {isLocating || isReverseGeocoding ? 'Getting location...' : 'Use my location'}
                </Text>
              </TouchableOpacity>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editActionButton, { backgroundColor: 'rgba(148,163,184,0.15)' }]}
                  onPress={() => setIsAddingAddress(false)}
                  activeOpacity={0.9}
                  disabled={isSavingAddress}>
                  <Text style={[styles.editActionButtonText, { color: '#64748B' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.editActionButton,
                    { backgroundColor: primary },
                    isSavingAddress && { opacity: 0.7 },
                  ]}
                  onPress={async () => {
                    if (
                      !editAddressLine1.trim() ||
                      !editCity.trim() ||
                      !editState.trim() ||
                      editPincode.trim().length !== 6
                    ) {
                      Toast.show({
                        type: 'error',
                        text1: 'Please complete all required fields',
                        text2: 'Address line 1, city, state, and a 6-digit pincode are required.',
                      });
                      return;
                    }
                    try {
                      const res = await createDeliveryLocation({
                        address_line1: editAddressLine1.trim(),
                        address_line2: editAddressLine2.trim() || undefined,
                        city: editCity.trim(),
                        state: editState.trim(),
                        pincode: editPincode.trim(),
                        type: newAddressType,
                        is_default: newAddressDefault,
                      } as any).unwrap();
                      const created = (res?.data as SavedAddress | undefined) ?? null;
                      await refetchSavedAddresses();
                      if (created?.id) setSelectedAddressId(String(created.id));
                      setIsAddingAddress(false);
                      Toast.show({ type: 'success', text1: 'Address saved' });
                    } catch (err) {
                      Toast.show({
                        type: 'error',
                        text1: 'Could not save address',
                        text2: getApiErrorMessage(err, 'Please try again.'),
                      });
                    }
                  }}
                  disabled={loading || isSavingAddress}
                  activeOpacity={0.9}>
                  <Text style={[styles.editActionButtonText, { color: '#FFFFFF' }]}>
                    {isSavingAddress ? 'Saving...' : 'Save & use'}
                  </Text>
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
            <Text style={styles.rowValue}>Rs {subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Delivery</Text>
            <Text style={[styles.rowValue, { color: '#16A34A' }]}>Free</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {subtotal.toFixed(2)}</Text>
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

  // ─── Saved-address picker (Flipkart/Amazon-style) ───
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addNewAddressText: { fontSize: 12, fontWeight: '700' },

  savedAddressList: { gap: 10 },
  savedAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  savedAddressBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  defaultBadge: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
  },
  savedAddressLine: { color: '#1F2937', fontSize: 13, lineHeight: 18 },

  emptyAddressBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyAddressTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  emptyAddressSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddressBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },

  defaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  defaultToggleText: { fontSize: 13, color: '#334155', fontWeight: '600' },
});

export default CheckoutScreen;
