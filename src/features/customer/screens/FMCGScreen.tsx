import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGetProductsQuery } from '../../products/api/productsApi';
import { useCart } from '../../../hooks/useCart';
import ProductCard from '../../../shared/ui/ProductCard';
import { themes } from '../../../utils/theme';

const FMCGScreen = () => {
  const { data: products = [], isLoading } = useGetProductsQuery({ category: 'fmcg' });
  const { add } = useCart();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FMCG</Text>
      <TextInput style={styles.search} placeholder="Search detergents, snacks..." />
      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={themes.fmcg.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAdd={(p, tier, vid) => add(p, 1, tier, vid)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}
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
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
});

export default FMCGScreen;
