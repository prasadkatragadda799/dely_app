import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { useCart } from '../../../hooks/useCart';
import {
  cartLineQuantityCaption,
  stepperQuantityCaptionForCartLine,
} from '../../../utils/productPackaging';
import { priceTierLabel, productImpliesSetPurchase } from '../../../utils/productPricing';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { CartLineItem } from '../../../types';
import { setHomeDivision } from '../homeDivisionSlice';
import {
  useCheckServiceLocationQuery,
  useGetDeliveryLocationsQuery,
} from '../../../services/api/mobileApi';

const formatInrAmount = (value: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  // Integer-round via paise to eliminate floating-point drift.
  return (Math.round(n * 100) / 100).toFixed(2);
};

/** Same step logic as useCart increment/decrement — kept here for optimistic UI. */
const cartItemStep = (item: CartLineItem): number => {
  if (item.priceOptionKey === 'set' || item.priceOptionKey === 'remaining') return 1;
  const pcs = Math.max(1, item.product.piecesPerSet ?? 1);
  const minO = Math.max(1, Math.trunc(Number(item.product.minOrderQuantity) || 1));
  if (pcs > 1) return pcs;
  if (minO > 1 && productImpliesSetPurchase(item.product)) return minO;
  return 1;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return `rgba(29,78,216,${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const CartScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { items, increment, decrement, clear } = useCart();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';

  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  // Optimistic quantities: applied immediately on tap, cleared once server data arrives.
  const [pendingQtys, setPendingQtys] = useState<Record<string, number>>({});
  // Tracks cart item ids whose mutations have resolved but whose server data (visibleItems)
  // hasn't propagated yet. Cleared inside the useEffect below to avoid the flicker window
  // between mutation resolve and RTK Query refetch completing.
  const settledIdsRef = useRef<Set<string>>(new Set());

  const { data: deliveryLocationsEnvelope } = useGetDeliveryLocationsQuery();
  const deliveryLocations = (deliveryLocationsEnvelope?.data as any[]) ?? [];
  const defaultLocation = deliveryLocations.find((l: any) => l.is_default) ?? deliveryLocations[0];
  const defaultPincode: string = defaultLocation?.pincode ?? '';
  const { data: locationCheckEnvelope } = useCheckServiceLocationQuery(defaultPincode, {
    skip: !defaultPincode,
  });
  const locationCheckData = locationCheckEnvelope?.data;
  const serviceUnavailable =
    !!defaultPincode &&
    !!locationCheckData &&
    locationCheckData.restricted &&
    !locationCheckData.available;

  const setMutating = useCallback((cartItemId: string, on: boolean) => {
    setMutatingIds(prev => {
      const next = new Set(prev);
      on ? next.add(cartItemId) : next.delete(cartItemId);
      return next;
    });
  }, []);

  const setPendingQty = useCallback((cartItemId: string, qty: number | null) => {
    setPendingQtys(prev => {
      if (qty === null) {
        const next = { ...prev };
        delete next[cartItemId];
        return next;
      }
      return { ...prev, [cartItemId]: qty };
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (!items.length) return;
    Alert.alert(
      'Clear cart',
      'Remove all items from this cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setClearing(true);
            clear().finally(() => setClearing(false));
          },
        },
      ],
    );
  }, [clear, items.length]);

  const visibleItems = useMemo(() => items, [items]);

  // When visibleItems updates (RTK Query refetch complete), clear pending quantities
  // for any mutation that has already settled. This prevents the one-frame flicker
  // caused by clearing pendingQty in .finally() before the cache has refreshed.
  useEffect(() => {
    const settled = settledIdsRef.current;
    if (settled.size === 0) return;
    setPendingQtys(prev => {
      const ids = Object.keys(prev);
      if (ids.length === 0) {
        settled.clear();
        return prev;
      }
      const next = { ...prev };
      let changed = false;
      const existingIds = new Set(visibleItems.map(i => i.cartItemId));
      for (const id of ids) {
        if (!existingIds.has(id) || settled.has(id)) {
          delete next[id];
          settled.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleItems]);

  // Use pending (optimistic) quantity when available; integer paise math avoids
  // floating-point drift that accumulates when summing many line prices.
  const visibleTotal = visibleItems.reduce((paise, item) => {
    const qty = pendingQtys[item.cartItemId] ?? item.quantity;
    return paise + Math.round(item.product.price * 100) * qty;
  }, 0) / 100;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: primary, paddingTop: insets.top + 14 }]}>
        <View style={styles.headerLeft}>
          <Icon name="cart-outline" size={22} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>{visibleItems.length} items</Text>
          </View>
          {visibleItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={handleClearAll}
              disabled={clearing}
              activeOpacity={0.75}>
              {clearing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="trash-can-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.clearAllText}>Clear All</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.segmentWrap}>
        <TouchableOpacity
          onPress={() => dispatch(setHomeDivision('fmcg'))}
          style={[
            styles.segmentPill,
            !isHomeKitchen && { backgroundColor: primary, borderColor: primary },
          ]}
          activeOpacity={0.95}>
          <Text
            style={[
              styles.segmentText,
              !isHomeKitchen && { color: '#FFFFFF' },
              isHomeKitchen && { color: primary },
            ]}>
            FMCG
          </Text>
        </TouchableOpacity>
        <View style={styles.segmentDivider} />
        <TouchableOpacity
          onPress={() => dispatch(setHomeDivision('homeKitchen'))}
          style={[
            styles.segmentPill,
            isHomeKitchen && { backgroundColor: primary, borderColor: primary },
          ]}
          activeOpacity={0.95}>
          <Text
            style={[
              styles.segmentText,
              isHomeKitchen && { color: '#FFFFFF' },
              !isHomeKitchen && { color: primary },
            ]}>
            Home & Kitchen
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={visibleItems}
        keyExtractor={item => item.cartItemId}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + insets.bottom + 140 },
        ]}
        renderItem={({ item }) => {
          const isMutating = mutatingIds.has(item.cartItemId) || clearing;
          const stepColor = isMutating ? '#CBD5E1' : primary;
          const step = cartItemStep(item);
          const effectiveQty = pendingQtys[item.cartItemId] ?? item.quantity;
          return (
            <View style={[styles.rowCard, isMutating && styles.rowCardMutating]}>
              <View style={styles.rowInfo}>
                <Image source={{ uri: item.product.image }} style={styles.thumb} />
                <View style={styles.rowInfoText}>
                  <Text style={styles.name}>{item.product.name}</Text>
                  <Text style={styles.brand}>{item.product.brand}</Text>
                  <Text style={styles.meta}>
                    {priceTierLabel(item.priceOptionKey)} · Rs {formatInrAmount(item.product.price)} ×{' '}
                    {cartLineQuantityCaption(
                      item.product,
                      effectiveQty,
                      item.priceOptionKey,
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowTotal}>
                  Rs {formatInrAmount(Math.round(item.product.price * 100) * effectiveQty / 100)}
                </Text>
                <View
                  style={[
                    styles.cartStepperShell,
                    {
                      borderColor: hexToRgba(isMutating ? '#94A3B8' : primary, 0.35),
                      backgroundColor: hexToRgba(isMutating ? '#94A3B8' : primary, 0.06),
                    },
                  ]}>
                  <View style={styles.cartStepSideCol}>
                    <TouchableOpacity
                      style={styles.cartStepSideHit}
                      disabled={isMutating}
                      onPress={() => {
                        const nextQty = Math.max(0, effectiveQty - step);
                        setPendingQty(item.cartItemId, nextQty);
                        setMutating(item.cartItemId, true);
                        decrement(item.product.id, item.priceOptionKey)
                          .finally(() => {
                            settledIdsRef.current.add(item.cartItemId);
                            setMutating(item.cartItemId, false);
                          });
                      }}
                      activeOpacity={0.85}
                      hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}>
                      <Icon name="minus" size={16} color={stepColor} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cartStepQtySlot}>
                    <Text
                      style={styles.cartStepQty}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}>
                      {stepperQuantityCaptionForCartLine(
                        item.product,
                        effectiveQty,
                        item.priceOptionKey,
                      )}
                    </Text>
                  </View>
                  <View style={styles.cartStepSideCol}>
                    <TouchableOpacity
                      style={styles.cartStepSideHit}
                      disabled={isMutating}
                      onPress={() => {
                        const stock = item.product.stockQuantity;
                        const maxQty = stock !== undefined && stock > 0 ? stock : 99;
                        const nextQty = Math.min(effectiveQty + step, maxQty);
                        setPendingQty(item.cartItemId, nextQty);
                        setMutating(item.cartItemId, true);
                        increment(item.product.id, item.priceOptionKey)
                          .finally(() => {
                            settledIdsRef.current.add(item.cartItemId);
                            setMutating(item.cartItemId, false);
                          });
                      }}
                      activeOpacity={0.85}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}>
                      <Text style={[styles.cartStepPlusGlyph, { color: stepColor }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="cart-off" size={34} color={primary} />
            <Text style={styles.empty}>
              {isHomeKitchen ? 'No Home & Kitchen items' : 'No FMCG items'} in cart
            </Text>
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: tabBarHeight + insets.bottom + 12 }]}>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Subtotal</Text>
          <Text style={styles.billValue}>Rs {formatInrAmount(visibleTotal)}</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Delivery</Text>
          <Text style={styles.freeText}>Free</Text>
        </View>
        <View style={styles.billDivider} />
        <View style={styles.billRow}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>Rs {formatInrAmount(visibleTotal)}</Text>
        </View>
        {serviceUnavailable ? (
          <View style={[styles.checkout, styles.checkoutUnavailable]}>
            <View style={styles.checkoutRow}>
              <Icon name="map-marker-off-outline" size={18} color="#FFFFFF" />
              <Text style={styles.checkoutText}>
                We don&apos;t deliver to {defaultPincode} yet
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.checkout, { backgroundColor: primary }]}
            onPress={() => {
              if (!visibleItems.length) {
                Toast.show({ type: 'error', text1: 'Cart is empty for this division' });
                return;
              }
              navigation.navigate('Checkout');
            }}>
            <View style={styles.checkoutRow}>
              <Icon name="lock-check-outline" size={18} color="#FFFFFF" />
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FBFF' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerPillText: { color: '#FFFFFF', fontWeight: '900' },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 36,
    justifyContent: 'center',
  },
  clearAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.8)',
    padding: 6,
    alignItems: 'center',
  },
  segmentPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  segmentText: { fontWeight: '900', fontSize: 13, color: '#475569' },
  segmentDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  listContent: { padding: 14, paddingBottom: 120 },
  rowCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowCardMutating: { opacity: 0.65 },
  rowInfo: { flex: 1, paddingRight: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowInfoText: { flex: 1 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
  },
  name: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  brand: { color: '#475569', marginTop: 2, fontWeight: '700', fontSize: 12 },
  meta: { color: '#64748B', marginTop: 4, fontWeight: '700' },
  rowRight: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  rowTotal: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  cartStepperShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 36,
    minWidth: 112,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cartStepSideCol: {
    width: 30,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartStepSideHit: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartStepPlusGlyph: {
    fontSize: 17,
    fontWeight: '400',
    marginTop: -1,
    lineHeight: 20,
  },
  cartStepQtySlot: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  cartStepQty: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0,
    maxWidth: '100%',
    color: '#0F172A',
    includeFontPadding: false,
  },
  emptyWrap: { paddingTop: 36, alignItems: 'center', gap: 10 },
  empty: { color: '#64748B', fontWeight: '800' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { color: '#64748B', fontWeight: '700' },
  billValue: { color: '#0F172A', fontWeight: '800' },
  freeText: { color: '#16A34A', fontWeight: '800' },
  billDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 10, marginTop: 4 },
  total: { fontSize: 18, fontWeight: '900', marginBottom: 10, color: '#0F172A' },
  checkout: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 14,
  },
  checkoutUnavailable: {
    backgroundColor: '#94A3B8',
  },
  checkoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  checkoutText: { color: '#FFFFFF', fontWeight: '900' },
});

export default CartScreen;
