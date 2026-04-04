import React from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGetProductsQuery } from '../../products/api/productsApi';
import { useCart } from '../../../hooks/useCart';
import ProductCard from '../../../shared/ui/ProductCard';
import { defaultPriceTier } from '../../../utils/productPricing';
import { themes } from '../../../utils/theme';

const FMCGScreen = () => {
  const { data: products = [] } = useGetProductsQuery({ category: 'fmcg' });
  const { add } = useCart();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FMCG</Text>
      <TextInput style={styles.search} placeholder="Search detergents, snacks..." />
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <ProductCard product={item} onAdd={p => add(p, 1, defaultPriceTier(p))} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themes.fmcg.accent, padding: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  search: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: { paddingTop: 10, paddingBottom: 90 },
});

export default FMCGScreen;
