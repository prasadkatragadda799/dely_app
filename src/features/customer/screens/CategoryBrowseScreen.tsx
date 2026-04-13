import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../../../hooks/useCart';
import ProductCard from '../../../shared/ui/ProductCard';
import { Product } from '../../../types';
import {
  ShopCategoryNode,
  useGetCategoryTreeQuery,
  useGetProductsQuery,
} from '../../products/api/productsApi';

type DivisionKey = 'fmcg' | 'homeKitchen';

type RouteParams = {
  division: DivisionKey;
  /** Rail + product grid: `brands` / `companies` match Shop by brand / Shop by company → See all. */
  mode?: 'categories' | 'brands' | 'companies';
};

type SortKey = 'relevance' | 'priceAsc' | 'priceDesc';

type CategoryLeaf = {
  key: string;
  kind: 'leaf';
  label: string;
  /** Every admin Category id in this row’s subtree (node + descendants). */
  matchCategoryIds: string[];
  /** Subtree category names — fallback when `shopCategoryId` is missing on a product. */
  matchNames: string[];
  /** Subtree category slugs from API — stable vs stray spaces in names. */
  matchSlugs: string[];
  imageUrl?: string;
  icon?: string;
  count: number;
};

type BrandLeaf = {
  key: string;
  kind: 'leaf';
  label: string;
  brandName: string;
  imageUrl?: string;
  count: number;
};

type CompanyLeaf = {
  key: string;
  kind: 'leaf';
  label: string;
  companyName: string;
  imageUrl?: string;
  count: number;
};

type SidebarItem =
  | { key: string; kind: 'all' }
  | CategoryLeaf
  | BrandLeaf
  | CompanyLeaf;

function isCategoryLeaf(item: SidebarItem): item is CategoryLeaf {
  return item.kind === 'leaf' && 'matchCategoryIds' in item;
}

function isBrandLeaf(item: SidebarItem): item is BrandLeaf {
  return item.kind === 'leaf' && 'brandName' in item;
}

function isCompanyLeaf(item: SidebarItem): item is CompanyLeaf {
  return item.kind === 'leaf' && 'companyName' in item;
}

type SubtreeMatchScope = {
  ids: string[];
  names: string[];
  slugs: string[];
};

function normalizeCategoryId(s: string): string {
  return String(s).trim().toLowerCase();
}

/** Ids, display names, and slugs under `node` (admin tree / product.category). */
function collectSubtreeMatchMeta(node: ShopCategoryNode): SubtreeMatchScope {
  const ids: string[] = [];
  const names: string[] = [];
  const slugs: string[] = [];
  const walk = (n: ShopCategoryNode) => {
    ids.push(String(n.id));
    names.push(n.name);
    const slug = String(n.slug ?? '').trim();
    if (slug) {
      slugs.push(slug);
    }
    for (const c of (n.children ?? []).filter(Boolean) as ShopCategoryNode[]) {
      walk(c);
    }
  };
  walk(node);
  return { ids, names, slugs };
}

function productMatchesSubtree(p: Product, scope: SubtreeMatchScope): boolean {
  const idSet = new Set(scope.ids.map(normalizeCategoryId));
  const pid = p.shopCategoryId ? normalizeCategoryId(p.shopCategoryId) : '';
  if (pid && idSet.has(pid)) {
    return true;
  }
  const pslug = p.shopCategorySlug?.trim().toLowerCase();
  if (pslug) {
    for (const s of scope.slugs) {
      if (String(s).trim().toLowerCase() === pslug) {
        return true;
      }
    }
  }
  const sub = p.subCategory?.trim();
  if (sub) {
    for (const n of scope.names) {
      if (n.trim() === sub) {
        return true;
      }
    }
  }
  return false;
}

function countProductsForSubtree(
  products: Product[],
  scope: SubtreeMatchScope,
): number {
  return products.filter(p => productMatchesSubtree(p, scope)).length;
}

/**
 * One sidebar row per admin category node (parent before children), same order as admin tree.
 * Selecting a parent shows products in that category or any subcategory (by id or name).
 */
function buildSidebarFromAdminTree(
  roots: ShopCategoryNode[],
  products: Product[],
  showImages: boolean,
): CategoryLeaf[] {
  const rows: CategoryLeaf[] = [];
  const walk = (node: ShopCategoryNode) => {
    const meta = collectSubtreeMatchMeta(node);
    rows.push({
      key: `cat-${node.id}`,
      kind: 'leaf',
      label: node.name,
      matchCategoryIds: meta.ids,
      matchNames: meta.names,
      matchSlugs: meta.slugs,
      imageUrl: showImages
        ? String(node.image_url ?? '').trim() || undefined
        : undefined,
      icon: node.icon ?? undefined,
      count: countProductsForSubtree(products, meta),
    });
    const children = (node.children ?? []).filter(Boolean) as ShopCategoryNode[];
    for (const ch of children) {
      walk(ch);
    }
  };
  for (const r of roots) {
    walk(r);
  }
  return rows;
}

function productMatchesCategoryLeaf(p: Product, leaf: CategoryLeaf): boolean {
  return productMatchesSubtree(p, {
    ids: leaf.matchCategoryIds,
    names: leaf.matchNames,
    slugs: leaf.matchSlugs,
  });
}

function effectivePrice(p: Product): number {
  const opts = p.priceOptions;
  if (opts && opts.length > 0) {
    return Math.min(...opts.map(o => o.sellingPrice));
  }
  return p.price;
}

/** Avoid empty / broken URLs showing as solid color blocks in the sidebar. */
function SidebarCategoryImage({
  uri,
  accent,
}: {
  uri: string;
  accent: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed || !uri.trim()) {
    return <Icon name="tag-outline" size={18} color={accent} />;
  }
  return (
    <Image
      source={{ uri }}
      style={sideThumbStyles.image}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const sideThumbStyles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});

/** Brand logos in the rail use contain so wide marks stay readable. */
function SidebarBrandLogo({
  uri,
  accent,
}: {
  uri: string;
  accent: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed || !uri.trim()) {
    return <Icon name="tag-outline" size={20} color={accent} />;
  }
  return (
    <Image
      source={{ uri }}
      style={sideThumbStyles.image}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const CategoryBrowseScreen = () => {
  const navigation = useNavigation<any>();
  const { add } = useCart();
  const { width: windowWidth } = useWindowDimensions();
  const route = useRoute<any>();
  const p = route.params as Partial<RouteParams> | undefined;
  const division: DivisionKey =
    p?.division === 'homeKitchen' ? 'homeKitchen' : 'fmcg';
  const browseMode: 'categories' | 'brands' | 'companies' =
    p?.mode === 'companies'
      ? 'companies'
      : p?.mode === 'brands'
        ? 'brands'
        : 'categories';

  const { data: allProducts = [] } = useGetProductsQuery();
  const { data: categoryTreeRoots = [] } = useGetCategoryTreeQuery(division, {
    skip: browseMode !== 'categories',
  });

  const [selectedKey, setSelectedKey] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [priceDropOnly, setPriceDropOnly] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);

  React.useEffect(() => {
    setSelectedKey('all');
  }, [browseMode, division]);

  const isHomeKitchen = division === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primarySoft = isHomeKitchen
    ? 'rgba(22,163,74,0.12)'
    : 'rgba(29,78,216,0.12)';
  const primaryBorder = isHomeKitchen
    ? 'rgba(22,163,74,0.25)'
    : 'rgba(29,78,216,0.25)';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';
  const discountGreen = '#16A34A';

  const divisionProducts = useMemo(() => {
    return division === 'homeKitchen'
      ? allProducts.filter(
          p => p.category === 'home' || p.category === 'kitchen',
        )
      : allProducts.filter(p => p.category === 'fmcg');
  }, [division, allProducts]);

  const brandCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(pr => {
      const key = pr.brand || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const brandLogoByName = useMemo(() => {
    const map: Record<string, string> = {};
    divisionProducts.forEach(pr => {
      const name = pr.brand?.trim();
      const url = pr.brandLogoUrl?.trim();
      if (name && url && map[name] === undefined) {
        map[name] = url;
      }
    });
    return map;
  }, [divisionProducts]);

  const companyCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(pr => {
      const key = pr.companyName?.trim();
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const companyLogoByName = useMemo(() => {
    const map: Record<string, string> = {};
    divisionProducts.forEach(pr => {
      const name = pr.companyName?.trim();
      const url = pr.companyLogoUrl?.trim();
      if (name && url && map[name] === undefined) {
        map[name] = url;
      }
    });
    return map;
  }, [divisionProducts]);

  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.subCategory || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const showCategoryImages = useMemo(
    () =>
      categoryTreeRoots.length > 0 &&
      categoryTreeRoots.some(n => Boolean(String(n.image_url ?? '').trim())),
    [categoryTreeRoots],
  );

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const allItem: SidebarItem = { key: 'all', kind: 'all' };
    if (browseMode === 'brands') {
      const names = new Set<string>();
      divisionProducts.forEach(pr => {
        if (pr.brand) names.add(pr.brand);
      });
      return [
        allItem,
        ...Array.from(names)
          .sort((a, b) => a.localeCompare(b))
          .map(name => ({
            key: `brand-${name}`,
            kind: 'leaf' as const,
            label: name,
            brandName: name,
            count: brandCountMap[name] ?? 0,
            imageUrl: brandLogoByName[name],
          })),
      ];
    }
    if (browseMode === 'companies') {
      const names = new Set<string>();
      divisionProducts.forEach(pr => {
        const n = pr.companyName?.trim();
        if (n) names.add(n);
      });
      return [
        allItem,
        ...Array.from(names)
          .sort((a, b) => a.localeCompare(b))
          .map(name => ({
            key: `company-${name}`,
            kind: 'leaf' as const,
            label: name,
            companyName: name,
            count: companyCountMap[name] ?? 0,
            imageUrl: companyLogoByName[name],
          })),
      ];
    }
    if (categoryTreeRoots.length > 0) {
      return [
        allItem,
        ...buildSidebarFromAdminTree(
          categoryTreeRoots,
          divisionProducts,
          showCategoryImages,
        ),
      ];
    }
    const names = new Set<string>();
    divisionProducts.forEach(pr => {
      if (pr.subCategory) names.add(pr.subCategory);
    });
    return [
      allItem,
      ...Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({
          key: `leaf-${name}`,
          kind: 'leaf' as const,
          label: name,
          matchCategoryIds: [] as string[],
          matchNames: [name],
          matchSlugs: [] as string[],
          count: categoryCountMap[name] ?? 0,
        })),
    ];
  }, [
    browseMode,
    brandCountMap,
    brandLogoByName,
    companyCountMap,
    companyLogoByName,
    categoryTreeRoots,
    categoryCountMap,
    divisionProducts,
    showCategoryImages,
  ]);

  const selectedLeaf = useMemo((): CategoryLeaf | BrandLeaf | CompanyLeaf | null => {
    if (selectedKey === 'all') return null;
    const item = sidebarItems.find(
      i => i.key === selectedKey && i.kind === 'leaf',
    );
    if (!item) return null;
    return isCategoryLeaf(item) ||
      isBrandLeaf(item) ||
      isCompanyLeaf(item)
      ? item
      : null;
  }, [selectedKey, sidebarItems]);

  const headerTitle =
    selectedLeaf?.label ??
    (browseMode === 'brands'
      ? 'Brands'
      : browseMode === 'companies'
        ? 'Companies'
        : isHomeKitchen
          ? 'Home & Kitchen'
          : 'Categories');

  const baseFiltered = useMemo(() => {
    if (browseMode === 'brands') {
      if (!selectedLeaf || !isBrandLeaf(selectedLeaf)) {
        return divisionProducts;
      }
      return divisionProducts.filter(
        pr => pr.brand === selectedLeaf.brandName,
      );
    }
    if (browseMode === 'companies') {
      if (!selectedLeaf || !isCompanyLeaf(selectedLeaf)) {
        return divisionProducts;
      }
      return divisionProducts.filter(
        pr => pr.companyName === selectedLeaf.companyName,
      );
    }
    if (!selectedLeaf || !isCategoryLeaf(selectedLeaf)) {
      return divisionProducts;
    }
    return divisionProducts.filter(p =>
      productMatchesCategoryLeaf(p, selectedLeaf),
    );
  }, [browseMode, divisionProducts, selectedLeaf]);

  const filteredProducts = useMemo(() => {
    let list = baseFiltered;
    if (priceDropOnly) {
      list = list.filter(p => (p.discountPercent ?? 0) >= 12);
    }
    if (popularOnly) {
      list = list.filter(p => (p.rating ?? 0) >= 4);
    }
    const out = [...list];
    if (sortKey === 'priceAsc') {
      out.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    } else if (sortKey === 'priceDesc') {
      out.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    }
    return out;
  }, [baseFiltered, sortKey, priceDropOnly, popularOnly]);

  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('Home');

  const openSearch = () =>
    navigation.navigate('ProductOverview', { division });

  /**
   * Fixed max width + % of screen; kept small so the grid stays readable.
   * Sidebar is wrapped in a clipping container — otherwise ScrollView grows
   * to fit long category labels and can take most of the row.
   */
  const sidebarWidth = Math.min(
    104,
    Math.max(84, Math.round(windowWidth * 0.23)),
  );

  const chipFeatured =
    sortKey === 'relevance' && !priceDropOnly && !popularOnly;
  const chipPriceLow =
    sortKey === 'priceAsc' && !priceDropOnly && !popularOnly;
  const chipPriceHigh =
    sortKey === 'priceDesc' && !priceDropOnly && !popularOnly;

  const onChipFeatured = () => {
    setSortKey('relevance');
    setPriceDropOnly(false);
    setPopularOnly(false);
  };
  const onChipPriceLow = () => {
    setSortKey('priceAsc');
    setPriceDropOnly(false);
    setPopularOnly(false);
  };
  const onChipPriceHigh = () => {
    setSortKey('priceDesc');
    setPriceDropOnly(false);
    setPopularOnly(false);
  };
  const onChipPriceDrop = () => {
    if (priceDropOnly) {
      setPriceDropOnly(false);
    } else {
      setPriceDropOnly(true);
      setPopularOnly(false);
      setSortKey('relevance');
    }
  };
  const onChipPopular = () => {
    if (popularOnly) {
      setPopularOnly(false);
    } else {
      setPopularOnly(true);
      setPriceDropOnly(false);
      setSortKey('relevance');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.headerIconBtn, { borderColor: primaryBorder }]}
          activeOpacity={0.9}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-left" size={22} color={primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleSlot} pointerEvents="none">
          <Text
            style={[styles.headerTitle, { color: primary }]}
            numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.headerCaption} numberOfLines={1}>
            {isHomeKitchen ? 'Home & Kitchen' : 'FMCG'} · {filteredProducts.length}{' '}
            items
          </Text>
        </View>
        <TouchableOpacity
          onPress={openSearch}
          style={[styles.headerIconBtn, { borderColor: primaryBorder }]}
          activeOpacity={0.9}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="magnify" size={22} color={primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScrollInner}>
          <TouchableOpacity
            onPress={onChipFeatured}
            style={[
              styles.toolbarChip,
              chipFeatured && {
                backgroundColor: primarySoft,
                borderColor: primary,
              },
            ]}
            activeOpacity={0.88}>
            <Icon
              name="star-outline"
              size={15}
              color={chipFeatured ? primary : '#94A3B8'}
            />
            <Text
              style={[
                styles.toolbarChipText,
                { color: chipFeatured ? primary : '#475569' },
              ]}>
              Featured
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onChipPriceLow}
            style={[
              styles.toolbarChip,
              chipPriceLow && {
                backgroundColor: primarySoft,
                borderColor: primary,
              },
            ]}
            activeOpacity={0.88}>
            <Icon
              name="sort-ascending"
              size={15}
              color={chipPriceLow ? primary : '#94A3B8'}
            />
            <Text
              style={[
                styles.toolbarChipText,
                { color: chipPriceLow ? primary : '#475569' },
              ]}>
              Price: low
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onChipPriceHigh}
            style={[
              styles.toolbarChip,
              chipPriceHigh && {
                backgroundColor: primarySoft,
                borderColor: primary,
              },
            ]}
            activeOpacity={0.88}>
            <Icon
              name="sort-descending"
              size={15}
              color={chipPriceHigh ? primary : '#94A3B8'}
            />
            <Text
              style={[
                styles.toolbarChipText,
                { color: chipPriceHigh ? primary : '#475569' },
              ]}>
              Price: high
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onChipPriceDrop}
            style={[
              styles.toolbarChip,
              priceDropOnly && {
                borderColor: discountGreen,
                backgroundColor: 'rgba(22,163,74,0.08)',
              },
            ]}
            activeOpacity={0.88}>
            <Icon
              name="arrow-down-bold"
              size={14}
              color={priceDropOnly ? discountGreen : '#94A3B8'}
            />
            <Text
              style={[
                styles.toolbarChipText,
                {
                  color: priceDropOnly ? discountGreen : '#475569',
                },
              ]}>
              Price drop
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onChipPopular}
            style={[
              styles.toolbarChip,
              popularOnly && {
                borderColor: primary,
                backgroundColor: primarySoft,
              },
            ]}
            activeOpacity={0.88}>
            <Icon
              name="trophy-outline"
              size={14}
              color={popularOnly ? primary : '#94A3B8'}
            />
            <Text
              style={[
                styles.toolbarChipText,
                { color: popularOnly ? primary : '#475569' },
              ]}>
              Popular
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.splitRow}>
        <View
          style={[styles.sidebarShell, { width: sidebarWidth }]}
          accessibilityRole="none">
          <ScrollView
            style={styles.sidebarScroll}
            contentContainerStyle={[
              styles.sidebarContent,
              { width: sidebarWidth },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}>
          {sidebarItems.map(item => {
            const active = item.key === selectedKey;
            if (item.kind === 'all') {
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setSelectedKey('all')}
                  style={[
                    styles.sideCell,
                    active && {
                      backgroundColor: primarySoft,
                      borderLeftColor: primary,
                    },
                  ]}
                  activeOpacity={0.9}>
                  <View
                    style={[
                      styles.sideImageWrap,
                      active && { borderColor: primary },
                      !active && { borderColor: '#E2E8F0' },
                    ]}>
                    <Icon name="view-grid-outline" size={18} color={primary} />
                  </View>
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.sideLabel,
                      { color: active ? primaryText : '#64748B' },
                      active && styles.sideLabelActive,
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setSelectedKey(item.key)}
                style={[
                  styles.sideCell,
                  active && {
                    backgroundColor: primarySoft,
                    borderLeftColor: primary,
                  },
                ]}
                activeOpacity={0.9}>
                <View
                  style={[
                    styles.sideImageWrap,
                    active && { borderColor: primary },
                    !active && { borderColor: '#E2E8F0' },
                  ]}>
                  {item.imageUrl ? (
                    isBrandLeaf(item) || isCompanyLeaf(item) ? (
                      <SidebarBrandLogo uri={item.imageUrl} accent={primary} />
                    ) : (
                      <SidebarCategoryImage uri={item.imageUrl} accent={primary} />
                    )
                  ) : isCategoryLeaf(item) && item.icon ? (
                    <Text style={styles.sideEmoji}>{item.icon}</Text>
                  ) : (
                    <Icon name="tag-outline" size={18} color={primary} />
                  )}
                </View>
                <Text
                  numberOfLines={3}
                  style={[
                    styles.sideLabel,
                    { color: active ? primaryText : '#64748B' },
                    active && styles.sideLabelActive,
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          </ScrollView>
        </View>

        <View style={styles.mainPane}>
          <FlatList
            style={styles.mainList}
            data={filteredProducts}
            keyExtractor={p => p.id}
            numColumns={2}
            key="grid-2"
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                onAdd={(p, tier) => add(p, 1, tier)}
                accentColor={primary}
                onCardPress={() => {
                  if (browseMode === 'brands') {
                    navigation.navigate('ProductOverview', {
                      division,
                      productId: item.id,
                      ...(selectedLeaf && isBrandLeaf(selectedLeaf)
                        ? { brand: selectedLeaf.brandName }
                        : {}),
                    });
                    return;
                  }
                  if (browseMode === 'companies') {
                    navigation.navigate('ProductOverview', {
                      division,
                      productId: item.id,
                      ...(selectedLeaf && isCompanyLeaf(selectedLeaf)
                        ? { company: selectedLeaf.companyName }
                        : {}),
                    });
                    return;
                  }
                  navigation.navigate('ProductOverview', {
                    division,
                    productId: item.id,
                    ...(selectedLeaf && isCategoryLeaf(selectedLeaf)
                      ? {
                          subCategory: selectedLeaf.label,
                          categoryFilter: {
                            ids: selectedLeaf.matchCategoryIds,
                            names: selectedLeaf.matchNames,
                            slugs: selectedLeaf.matchSlugs,
                          },
                        }
                      : {}),
                  });
                }}
              />
            )}
            ListEmptyComponent={
              <View
                style={[
                  styles.emptyWrap,
                  { width: Math.max(200, windowWidth - sidebarWidth) },
                ]}>
                <Text style={styles.emptyText}>
                  {browseMode === 'brands'
                    ? 'No products for this brand yet.'
                    : browseMode === 'companies'
                      ? 'No products for this company yet.'
                      : 'No products in this category yet.'}
                </Text>
              </View>
            }
          />
        </View>
      </View>

      <View style={[styles.promoBar, { backgroundColor: primarySoft }]}>
        <Text style={[styles.promoText, { color: primaryText }]}>
          FREE DELIVERY on orders above Rs 149
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  /** Keeps title centered without overlapping the side buttons. */
  headerTitleSlot: {
    flex: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  headerCaption: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    width: '100%',
  },
  toolbar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  toolbarScrollInner: {
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  toolbarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  toolbarChipText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    backgroundColor: '#F8FAFC',
  },
  /** Hard cap width; flexShrink 0 so the grid always keeps ~80%+ of the row. */
  sidebarShell: {
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  sideCell: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    width: '100%',
    maxWidth: '100%',
  },
  sideImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideEmoji: { fontSize: 20 },
  sideLabel: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  sideLabelActive: {
    fontWeight: '800',
  },
  mainPane: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F8FAFC',
  },
  mainList: {
    flex: 1,
  },
  gridRow: {
    paddingHorizontal: 6,
  },
  gridContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    alignSelf: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 24,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  promoBar: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  promoText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

export default CategoryBrowseScreen;
