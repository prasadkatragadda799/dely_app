import React from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useGetProductsQuery } from '../../products/api/productsApi';
import { useCart } from '../../../hooks/useCart';

const KitchenScreen = () => {
  const navigation = useNavigation<any>();
  const { data: products = [] } = useGetProductsQuery();
  const { add } = useCart();

  const homeKitchenProducts = products.filter(
    item => item.category === 'home' || item.category === 'kitchen',
  );

  const onGoFmcg = () => navigation.navigate('FMCG');
  const onGoHomeKitchen = () => navigation.navigate('HomeKitchen');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Image
          source={require('../../../../assets/logo.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.headerIconBtn}>
          <Icon name="cart-outline" size={18} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          onPress={onGoFmcg}
          style={[styles.segmentPill, styles.segmentPillInactive]}>
          <Icon name="basket-outline" size={16} color="#2563EB" />
          <Text style={styles.segmentPillText}>FMCG</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onGoHomeKitchen}
          style={[styles.segmentPill, styles.segmentPillActive]}>
          <Icon name="sofa-outline" size={16} color="#FFFFFF" />
          <Text style={[styles.segmentPillText, styles.segmentPillTextActive]}>
            Home & Kitchen
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.promoCard}>
        <Text style={styles.promoTitle}>Elevate Your Culinary Sanctuary</Text>
        <Text style={styles.promoSubtitle}>
          Premium kitchen accessories and essentials, curated for you.
        </Text>
        <TouchableOpacity style={styles.promoButton}>
          <Text style={styles.promoButtonText}>Explore Partners</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tileLabel}>Kitchen Partners</Text>
      <View style={styles.tileRow}>
        {[
          { id: 'acc', label: 'Accessories', icon: 'utensils-crossed' },
          { id: 'tools', label: 'Tools', icon: 'chef-hat-outline' },
          { id: 'cook', label: 'Cookware', icon: 'stove' },
        ].map(tile => (
          <View key={tile.id} style={styles.smallTile}>
            <Icon name={tile.icon} size={20} color="#1D4ED8" />
            <Text style={styles.smallTileText}>{tile.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kitchen Essentials</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={homeKitchenProducts}
        keyExtractor={item => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productImageWrap}>
              <Image source={{ uri: item.image }} style={styles.productImage} />
              <TouchableOpacity style={styles.heartBtn}>
                <Icon name="heart-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={() => add(item)}
                activeOpacity={0.9}>
                <Icon name="plus" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.productPrice}>Rs {item.price}</Text>
              <Text style={styles.productOffer}>{item.discountPercent}% OFF</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FBFF' },
  content: { padding: 14, paddingBottom: 40 },
  headerRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLogo: { width: 140, height: 42 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 10,
  },
  segmentPillInactive: { backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#BFDBFE' },
  segmentPillActive: { backgroundColor: '#1D4ED8' },
  segmentPillText: { fontWeight: '800', fontSize: 13, color: '#2563EB' },
  segmentPillTextActive: { color: '#FFFFFF' },
  promoCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  promoTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  promoSubtitle: { marginTop: 6, color: '#475569', fontWeight: '600', lineHeight: 20 },
  promoButton: {
    marginTop: 12,
    backgroundColor: '#1D4ED8',
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  promoButtonText: { color: '#FFFFFF', fontWeight: '800' },
  tileLabel: { marginTop: 12, fontSize: 14, fontWeight: '900', color: '#1E3A8A' },
  tileRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  smallTile: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  smallTileText: { fontSize: 12, fontWeight: '800', color: '#1E3A8A' },
  sectionHeader: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#1E3A8A' },
  sectionAction: { color: '#2563EB', fontWeight: '800' },
  list: { paddingTop: 10, paddingBottom: 40 },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  productImageWrap: { position: 'relative' },
  productImage: { width: '100%', height: 160, backgroundColor: '#EEF2FF' },
  heartBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { padding: 12 },
  productName: { color: '#0F172A', fontWeight: '900' },
  productPrice: { marginTop: 4, fontWeight: '800', color: '#111827' },
  productOffer: { marginTop: 4, fontWeight: '800', color: '#D97706', fontSize: 12 },
});

export default KitchenScreen;
