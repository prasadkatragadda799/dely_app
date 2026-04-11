import React, { useMemo } from 'react';
import {
  FlatList,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGetCategoryTreeQuery,
  useGetProductsQuery,
} from '../../products/api/productsApi';

type DivisionKey = 'fmcg' | 'homeKitchen';
type GridKind = 'categories' | 'brands';

type RouteParams = {
  division: DivisionKey;
  kind: GridKind;
};

type CategoryItem =
  | { key: string; kind: 'all' }
  | {
      key: string;
      kind: 'category';
      name: string;
      imageUrl?: string;
      icon?: string;
      count: number;
    };

type BrandItem =
  | { key: string; kind: 'all' }
  | {
      key: string;
      kind: 'brand';
      name: string;
      count: number;
      imageUrl?: string;
    };

type GridListItem = CategoryItem | BrandItem;

const CategoryBrandGridScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const p = route.params as Partial<RouteParams> | undefined;
  const division: DivisionKey =
    p?.division === 'homeKitchen' ? 'homeKitchen' : 'fmcg';
  const kind: GridKind = p?.kind === 'brands' ? 'brands' : 'categories';

  const { data: allProducts = [] } = useGetProductsQuery();
  const { data: categoryTreeRoots = [] } = useGetCategoryTreeQuery(division);

  const isHomeKitchen = division === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primaryBorder = isHomeKitchen
    ? 'rgba(22,163,74,0.25)'
    : 'rgba(29,78,216,0.25)';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';
  const secondary = isHomeKitchen ? '#22C55E' : '#2563EB';

  const divisionProducts = useMemo(() => {
    return division === 'homeKitchen'
      ? allProducts.filter(p => p.category === 'home' || p.category === 'kitchen')
      : allProducts.filter(p => p.category === 'fmcg');
  }, [division, allProducts]);

  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.subCategory || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const brandCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.brand || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  /** First non-empty logo URL per brand name from catalog (matches API `brand.logoUrl`). */
  const brandLogoByName = useMemo(() => {
    const map: Record<string, string> = {};
    divisionProducts.forEach(p => {
      const name = p.brand?.trim();
      const url = p.brandLogoUrl?.trim();
      if (name && url && map[name] === undefined) {
        map[name] = url;
      }
    });
    return map;
  }, [divisionProducts]);

  const showCategoryImageBoxes = useMemo(
    () =>
      categoryTreeRoots.length > 0 &&
      categoryTreeRoots.some(n => Boolean(String(n.image_url ?? '').trim())),
    [categoryTreeRoots],
  );

  const categoryItems: CategoryItem[] = useMemo(() => {
    const all: CategoryItem[] = [{ key: 'all', kind: 'all' }];
    if (showCategoryImageBoxes) {
      return [
        ...all,
        ...categoryTreeRoots.map(node => {
          const count =
            typeof node.product_count === 'number'
              ? node.product_count
              : categoryCountMap[node.name] ?? 0;
          return {
            key: `cat-${node.id}`,
            kind: 'category' as const,
            name: node.name,
            imageUrl: String(node.image_url ?? '').trim() || undefined,
            icon: node.icon,
            count,
          };
        }),
      ];
    }
    const names = new Set<string>();
    divisionProducts.forEach(p => {
      if (p.subCategory) names.add(p.subCategory);
    });
    return [
      ...all,
      ...Array.from(names).map(name => ({
        key: `cat-${name}`,
        kind: 'category' as const,
        name,
        count: categoryCountMap[name] ?? 0,
      })),
    ];
  }, [
    showCategoryImageBoxes,
    categoryTreeRoots,
    divisionProducts,
    categoryCountMap,
  ]);

  const brandItems: BrandItem[] = useMemo(() => {
    const names = new Set<string>();
    divisionProducts.forEach(p => {
      if (p.brand) names.add(p.brand);
    });
    return [
      { key: 'all', kind: 'all' },
      ...Array.from(names).map(name => ({
        key: `brand-${name}`,
        kind: 'brand' as const,
        name,
        count: brandCountMap[name] ?? 0,
        imageUrl: brandLogoByName[name],
      })),
    ];
  }, [divisionProducts, brandCountMap, brandLogoByName]);

  const title =
    kind === 'categories'
      ? 'All categories'
      : 'All brands';
  const subtitle = isHomeKitchen ? 'Home & Kitchen' : 'FMCG';

  const onPressCategory = (item: CategoryItem) => {
    if (item.kind === 'all') {
      navigation.navigate('ProductOverview', { division });
      return;
    }
    navigation.navigate('ProductOverview', {
      division,
      subCategory: item.name,
    });
  };

  const onPressBrand = (item: BrandItem) => {
    if (item.kind === 'all') {
      navigation.navigate('ProductOverview', { division });
      return;
    }
    navigation.navigate('ProductOverview', {
      division,
      brand: item.name,
    });
  };

  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('Home');

  const cellStyle: StyleProp<ViewStyle> = [
    styles.gridCell,
    { borderColor: primaryBorder, backgroundColor: 'rgba(255,255,255,0.72)' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View
        style={[styles.gradientLeft, { backgroundColor: primary, opacity: 0.22 }]}
      />
      <View
        style={[
          styles.gradientRight,
          { backgroundColor: secondary, opacity: 0.18 },
        ]}
      />
      <View style={styles.inner}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={goBack}
            style={[styles.backBtn, { borderColor: primaryBorder }]}
            activeOpacity={0.9}>
            <Icon name="chevron-left" size={20} color={primary} />
          </TouchableOpacity>
          <View style={styles.topBarText}>
            <Text style={[styles.screenTitle, { color: primary }]}>{title}</Text>
            <Text style={[styles.screenSubtitle, { color: primaryText }]}>
              {subtitle}
            </Text>
          </View>
        </View>

        <FlatList<GridListItem>
          key={kind}
          data={kind === 'categories' ? categoryItems : brandItems}
          keyExtractor={i => i.key}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            if (kind === 'categories') {
              const c = item as CategoryItem;
              return (
                <TouchableOpacity
                  style={cellStyle}
                  onPress={() => onPressCategory(c)}
                  activeOpacity={0.92}>
                  <View
                    style={[styles.gridImageWrap, { borderColor: primaryBorder }]}>
                    {c.kind === 'all' ? (
                      <Icon name="shape-outline" size={28} color={primary} />
                    ) : c.imageUrl ? (
                      <Image
                        source={{ uri: c.imageUrl }}
                        style={styles.gridImage}
                        resizeMode="cover"
                      />
                    ) : c.icon ? (
                      <Text style={styles.gridEmoji}>{c.icon}</Text>
                    ) : (
                      <Icon
                        name="view-grid-plus-outline"
                        size={26}
                        color={primary}
                      />
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[styles.gridName, { color: primaryText }]}>
                    {c.kind === 'all' ? 'All' : c.name}
                  </Text>
                  <Text style={styles.gridCount}>
                    {c.kind === 'all'
                      ? `${divisionProducts.length} products`
                      : `${c.count} products`}
                  </Text>
                </TouchableOpacity>
              );
            }
            const b = item as BrandItem;
            return (
              <TouchableOpacity
                style={cellStyle}
                onPress={() => onPressBrand(b)}
                activeOpacity={0.92}>
                <View
                  style={[styles.gridImageWrap, { borderColor: primaryBorder }]}>
                  {b.kind === 'all' ? (
                    <Icon name="storefront-outline" size={26} color={primary} />
                  ) : b.imageUrl ? (
                    <Image
                      source={{ uri: b.imageUrl }}
                      style={styles.gridImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon name="tag-outline" size={26} color={primary} />
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={[styles.gridName, { color: primaryText }]}>
                  {b.kind === 'all' ? 'All' : b.name}
                </Text>
                <Text style={styles.gridCount}>
                  {b.kind === 'all'
                    ? `${divisionProducts.length} products`
                    : `${b.count} products`}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  gradientLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    left: -120,
    top: 30,
    borderRadius: 140,
  },
  gradientRight: {
    position: 'absolute',
    width: 320,
    height: 320,
    right: -140,
    bottom: 50,
    borderRadius: 160,
  },
  inner: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
  },
  topBarText: { flex: 1 },
  screenTitle: { fontSize: 20, fontWeight: '900' },
  screenSubtitle: { marginTop: 2, fontWeight: '600', fontSize: 13 },
  gridContent: { paddingBottom: 24 },
  gridRow: { gap: 10, marginBottom: 10 },
  gridCell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 0,
  },
  gridImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(248,250,252,0.95)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridImage: { width: '100%', height: '100%' },
  gridEmoji: { fontSize: 28, lineHeight: 34 },
  gridName: {
    marginTop: 8,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
  gridCount: {
    marginTop: 4,
    fontWeight: '600',
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default CategoryBrandGridScreen;
