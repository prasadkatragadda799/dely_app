import React, { useMemo } from 'react';
import {
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
import { cartQuantityCaption } from '../../../utils/productPackaging';
import { priceTierLabel } from '../../../utils/productPricing';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';

const CartScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { items, remove } = useCart();
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';

  // Cart is now backed by API and already scoped to the active division.
  const visibleItems = useMemo(() => items, [items]);

  const visibleTotal = visibleItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: primary, paddingTop: insets.top + 14 }]}>
        <View style={styles.headerLeft}>
          <Icon name="cart-outline" size={22} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>{visibleItems.length} items</Text>
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
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <View style={styles.rowInfo}>
              <Image source={{ uri: item.product.image }} style={styles.thumb} />
              <View style={styles.rowInfoText}>
                <Text style={styles.name}>{item.product.name}</Text>
                <Text style={styles.brand}>{item.product.brand}</Text>
                <Text style={styles.meta}>
                  {priceTierLabel(item.priceOptionKey)} · Rs {item.product.price} ×{' '}
                  {cartQuantityCaption(item.product, item.quantity)}
                </Text>
              </View>
            </View>
            <Text style={styles.rowTotal}>Rs {item.product.price * item.quantity}</Text>
            <TouchableOpacity
              onPress={() => remove(item.cartItemId)}
              style={styles.removeBtn}>
              <Icon name="trash-can-outline" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
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
          <Text style={styles.billValue}>Rs {visibleTotal}</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Delivery</Text>
          <Text style={styles.freeText}>Free</Text>
        </View>
        <View style={styles.billDivider} />
        <View style={styles.billRow}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>Rs {visibleTotal}</Text>
        </View>
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
  headerPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerPillText: { color: '#FFFFFF', fontWeight: '900' },
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
  rowTotal: { color: '#0F172A', fontWeight: '900', fontSize: 14, marginRight: 4 },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
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
  checkoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  checkoutText: { color: '#FFFFFF', fontWeight: '900' },
});

export default CartScreen;
