import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
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
  useCreateDeliveryLocationMutation,
  useCreateOrderApiMutation,
  useGetDeliveryLocationsQuery,
  useGetDivisionsQuery,
  useGetProfileQuery,
} from '../../../services/api/mobileApi';
import { getApiErrorMessage } from '../../../utils/apiErrorMessage';
import { palette, radius, shadow, getDivision } from '../../../utils/theme';

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
  const [createDeliveryLocation] = useCreateDeliveryLocationMutation();

  // Delivery address is not editable from Checkout — customers manage addresses
  // only from the Profile screen. This always reflects whichever address is
  // marked default there.
  const selectedAddress = useMemo(
    () => savedAddresses.find(a => a.is_default) ?? savedAddresses[0] ?? null,
    [savedAddresses],
  );

  // Auto-seed the first delivery location from the registration address the very
  // first time this user hits checkout with no saved addresses, so checkout works
  // without forcing a trip to Profile first.
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
      .then(() => {
        refetchSavedAddresses();
      })
      .catch(() => {
        // Silently fail — the user can still add an address from Profile.
        hasSeededRef.current = false;
      });
  }, [isLoadingSavedAddresses, savedAddresses.length, addressLine1, city, state, pincode]);

  const div = getDivision(homeDivision);
  const primary = div.primary;
  const primaryText = div.primaryDeep;

  // Cart is now backed by API and already scoped to the active division.
  const visibleItems = useMemo(() => items, [items]);

  const subtotal = visibleItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const { data: divisionsEnvelope } = useGetDivisionsQuery();
  const divisions = (divisionsEnvelope?.data as any[]) ?? [];
  const activeDivisionSlug = homeDivision === 'homeKitchen' ? 'kitchen' : 'default';
  const minOrderValue = Number(
    divisions.find(d => d.slug === activeDivisionSlug)?.min_order_value ?? 0,
  );
  const belowMinOrderValue = subtotal < minOrderValue;

  const handlePlaceOrder = async () => {
    if (!visibleItems.length) {
      Toast.show({ type: 'error', text1: 'Your cart is empty for this division' });
      return;
    }

    if (belowMinOrderValue) {
      Toast.show({
        type: 'error',
        text1: 'Minimum order value not met',
        text2: `Add Rs ${(minOrderValue - subtotal).toFixed(2)} more to place this order.`,
      });
      return;
    }

    try {
      setLoading(true);

      // Saved addresses live in /delivery and the order endpoint accepts
      // `delivery_location_id`; we send that and let the backend resolve the
      // address dict, which keeps the snapshot in sync with what's saved.
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
      <View style={[styles.header, { backgroundColor: primary, paddingTop: insets.top + 12 }]}>
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

          {selectedAddress ? (
            (() => {
              const typeLabel = (selectedAddress.type || 'home').toString();
              const fullAddress = [
                selectedAddress.address_line1,
                selectedAddress.address_line2,
                [selectedAddress.city, selectedAddress.state, selectedAddress.pincode]
                  .filter(Boolean)
                  .join(', '),
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <View style={styles.savedAddressCard}>
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
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    </View>
                    <Text style={styles.savedAddressLine}>{fullAddress || '—'}</Text>
                  </View>
                </View>
              );
            })()
          ) : (
            <View style={styles.emptyAddressBox}>
              <Icon name="map-marker-plus-outline" size={28} color={primary} />
              <Text style={styles.emptyAddressTitle}>No saved addresses</Text>
              <Text style={styles.emptyAddressSubtitle}>
                Add a delivery address in your profile to place this order.
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddressBtn, { backgroundColor: primary }]}
                onPress={() => navigation.getParent?.()?.navigate('Profile')}
                activeOpacity={0.9}
              >
                <Icon name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.emptyAddressBtnText}>Add address</Text>
              </TouchableOpacity>
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
          {belowMinOrderValue && (
            <Text style={styles.minOrderHint}>
              Minimum order value for {homeDivision === 'homeKitchen' ? 'Home & Kitchen' : 'FMCG'} is Rs{' '}
              {minOrderValue.toFixed(2)}. Add Rs {(minOrderValue - subtotal).toFixed(2)} more.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            { backgroundColor: belowMinOrderValue ? '#94A3B8' : primary },
            shadow.accent(primary),
          ]}
          onPress={handlePlaceOrder}
          disabled={loading || belowMinOrderValue}
          activeOpacity={0.92}>
          <Icon name="shield-check-outline" size={18} color="#FFFFFF" />
          <Text style={styles.placeOrderText}>
            {loading ? 'Placing Order...' : belowMinOrderValue ? 'Minimum order value not met' : 'Place COD Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.md,
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
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    ...shadow.sm,
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
  minOrderHint: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 18,
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    ...shadow.lg,
  },
  placeOrderButton: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  placeOrderText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },

  // ─── Delivery address display (read-only in Checkout) ───
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
