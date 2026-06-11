import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useGetProductsQuery } from '../../products/api/productsApi';
import { useGetDeliveryLocationsQuery } from '../../../services/api/mobileApi';
import { useWishlist } from '../../../hooks/useWishlist';
import { useCart } from '../../../hooks/useCart';
import { useAppSelector } from '../../../hooks/redux';
import { palette, getDivision } from '../../../utils/theme';
import ProductCard from '../../../shared/ui/ProductCard';

const WishlistScreen = () => {
  const navigation = useNavigation<any>();
  const { data: deliveryLocationsEnvelope } = useGetDeliveryLocationsQuery();
  const deliveryLocations = (deliveryLocationsEnvelope?.data as any[]) ?? [];
  const defaultLocation = deliveryLocations.find((l: any) => l.is_default) ?? deliveryLocations[0];
  const defaultPincode: string = defaultLocation?.pincode ?? '';
  const pincode = defaultPincode || undefined;

  const { data: products = [], isLoading: isProductsLoading } = useGetProductsQuery(
    pincode ? { pincode } : undefined,
  );
  const { productIds } = useWishlist();
  const { add } = useCart();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');

  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = getDivision(homeDivision).primary;
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

      {isProductsLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <FlatList
          data={wishlistProducts}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            wishlistProducts.length === 0
              ? styles.emptyContent
              : styles.content,
            { paddingBottom: tabBarHeight + insets.bottom + 16 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${primary}14` }]}>
                <Icon name="heart-outline" size={32} color={primary} />
              </View>
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptySub}>Tap the heart on any product to save it here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAdd={(p, tier) => add(p, 1, tier)}
              accentColor={primary}
              onCardPress={() =>
                navigation.navigate('ProductOverview', {
                  division: homeDivision,
                  productId: item.id,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 8 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginLeft: 6,
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
    marginHorizontal: 6,
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
  content: { paddingTop: 4 },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 6 },
  columnWrapper: { justifyContent: 'flex-start' },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 18,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, color: '#334155', fontWeight: '900', fontSize: 17 },
  emptySub: { marginTop: 6, color: '#64748B', fontWeight: '600', textAlign: 'center' },
});

export default WishlistScreen;
