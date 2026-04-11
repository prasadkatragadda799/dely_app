import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useGetProductsQuery } from '../../products/api/productsApi';
import { useWishlist } from '../../../hooks/useWishlist';
import { useCart } from '../../../hooks/useCart';
import { defaultPriceTier } from '../../../utils/productPricing';
import { useAppSelector } from '../../../hooks/redux';

const WishlistScreen = () => {
  const navigation = useNavigation();
  const { data: products = [] } = useGetProductsQuery();
  const { productIds, toggle } = useWishlist();
  const { add } = useCart();
  const homeDivision = useAppSelector(state => state.homeDivision.division);

  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const wishlistProducts = useMemo(() => {
    const allowedCategories = isHomeKitchen ? ['home', 'kitchen'] : ['fmcg'];
    return products.filter(
      p => productIds.includes(p.id) && allowedCategories.includes(p.category),
    );
  }, [products, productIds, isHomeKitchen]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      {navigation.canGoBack() ? (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backLink}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}>
          <Icon name="chevron-left" size={26} color={primary} />
          <Text style={[styles.backLinkText, { color: primary }]}>Back</Text>
        </TouchableOpacity>
      ) : null}
      <View style={[styles.headerCard, { borderColor: `${primary}33` }]}>
        <View>
          <Text style={styles.title}>My Wishlist</Text>
          <Text style={styles.subtitle}>
            {wishlistProducts.length > 0
              ? `${wishlistProducts.length} saved item${wishlistProducts.length > 1 ? 's' : ''}`
              : 'Save products you want to buy later'}
          </Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: `${primary}14` }]}>
          <Icon name="heart" size={16} color={primary} />
          <Text style={[styles.countText, { color: primary }]}>{wishlistProducts.length}</Text>
        </View>
      </View>

      <FlatList
        data={wishlistProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={
          wishlistProducts.length === 0
            ? [styles.emptyContent, { paddingBottom: tabBarHeight + insets.bottom + 16 }]
            : [styles.content, { paddingBottom: tabBarHeight + insets.bottom + 16 }]
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${primary}14` }]}>
              <Icon name="heart-outline" size={32} color={primary} />
            </View>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySub}>Tap heart on products to save them here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <View style={styles.productRow}>
              <Image source={{ uri: item.image }} style={styles.thumb} />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.brand} numberOfLines={1}>
                  {item.brand ?? 'No brand'}
                </Text>
                <Text style={[styles.price, { color: primary }]}>Rs {item.price}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.removeBtn]}
                activeOpacity={0.9}
                onPress={() => toggle(item.id)}>
                <Icon name="heart-off-outline" size={16} color="#DC2626" />
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: primary }]}
                activeOpacity={0.9}
                onPress={() => add(item, 1, defaultPriceTier(item))}>
                <Icon name="cart-plus" size={16} color="#FFFFFF" />
                <Text style={styles.addText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 14 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 2,
  },
  backLinkText: { fontSize: 16, fontWeight: '800' },
  headerCard: {
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#0F172A', fontWeight: '900', fontSize: 20 },
  subtitle: { marginTop: 3, color: '#64748B', fontWeight: '600' },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: { fontWeight: '900', fontSize: 13 },
  content: { paddingBottom: 24 },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24 },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  meta: { flex: 1, marginLeft: 12 },
  name: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  brand: { color: '#64748B', marginTop: 3, fontWeight: '700', fontSize: 12 },
  price: { marginTop: 5, fontWeight: '900', fontSize: 14 },
  actionRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  removeBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeText: { color: '#B91C1C', fontWeight: '800', marginLeft: 6 },
  addText: { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 12, color: '#334155', fontWeight: '900', fontSize: 16 },
  emptySub: { marginTop: 6, color: '#64748B', fontWeight: '600' },
});

export default WishlistScreen;
