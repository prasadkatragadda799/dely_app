import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGetCategoryTreeQuery,
  useGetOffersQuery,
  useGetProductsQuery,
} from '../../products/api/productsApi';
import { API_V1_BASE_URL } from '../../../services/api/config';
import { useCart } from '../../../hooks/useCart';
import DealCard from '../../../shared/ui/DealCard';
import ProductCard from '../../../shared/ui/ProductCard';
import { useAppDispatch } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
  VOICE_NOT_AVAILABLE_MESSAGE,
} from '../../../utils/voice';
import { defaultPriceTier } from '../../../utils/productPricing';

type DivisionKey = 'fmcg' | 'homeKitchen';

const divisions: Array<{ key: DivisionKey; label: string; icon: string }> = [
  { key: 'fmcg', label: 'FMCG', icon: 'basket-outline' },
  {
    key: 'homeKitchen',
    label: 'Home & Kitchen',
    icon: 'sofa-outline',
  },
];

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { data: allProducts = [], isLoading: isProductsLoading, isError: isProductsError } = useGetProductsQuery();
  const { data: offers = [] } = useGetOffersQuery();
  const { add } = useCart();
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('fmcg');
  const { data: categoryTreeRoots = [] } = useGetCategoryTreeQuery(activeDivision);
  const [currentLocationText, setCurrentLocationText] = useState('Fetching location...');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeBrand, setActiveBrand] = useState<string>('All');
  const [isListening, setIsListening] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const isHomeKitchen = activeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primarySoft = isHomeKitchen
    ? 'rgba(22,163,74,0.12)'
    : 'rgba(29,78,216,0.12)';
  const primaryBorder = isHomeKitchen
    ? 'rgba(22,163,74,0.25)'
    : 'rgba(29,78,216,0.25)';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';
  const secondary = isHomeKitchen ? '#22C55E' : '#2563EB';

  const filteredProducts = useMemo(() => {
    const base =
      activeDivision === 'homeKitchen'
        ? allProducts.filter(
            p => p.category === 'home' || p.category === 'kitchen',
          )
        : allProducts.filter(p => p.category === 'fmcg');

    const q = query.trim().toLowerCase();
    const byQuery =
      !q ? base : base.filter(p => p.name.toLowerCase().includes(q));

    const byCategory =
      activeCategory === 'All'
        ? byQuery
        : byQuery.filter(p => p.subCategory === activeCategory);

    const byBrand =
      activeBrand === 'All'
        ? byCategory
        : byCategory.filter(p => p.brand === activeBrand);

    return byBrand;
  }, [activeDivision, allProducts, query, activeCategory, activeBrand]);

  const divisionProducts = useMemo(() => {
    return activeDivision === 'homeKitchen'
      ? allProducts.filter(p => p.category === 'home' || p.category === 'kitchen')
      : allProducts.filter(p => p.category === 'fmcg');
  }, [activeDivision, allProducts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    divisionProducts.forEach(p => {
      if (p.subCategory) set.add(p.subCategory);
    });
    return ['All', ...Array.from(set)];
  }, [divisionProducts]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    divisionProducts.forEach(p => {
      if (p.brand) set.add(p.brand);
    });
    return ['All', ...Array.from(set)];
  }, [divisionProducts]);

  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.subCategory || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  /** Use API category images as boxed tiles when the catalog exposes at least one image. */
  const showCategoryImageBoxes = useMemo(
    () =>
      categoryTreeRoots.length > 0 &&
      categoryTreeRoots.some(n => Boolean(String(n.image_url ?? '').trim())),
    [categoryTreeRoots],
  );

  const brandCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.brand || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const dealsForDivision = useMemo(() => {
    const color = isHomeKitchen ? '#16A34A' : '#1D4ED8';
    return offers.map(d => ({
      ...d,
      color,
      image: d.imageHomeKitchen ?? d.imageFmcg ?? d.image,
    }));
  }, [isHomeKitchen, offers]);

  const visibleProducts = filteredProducts.slice(0, 2);
  React.useEffect(() => {
    Voice.onSpeechResults = e => {
      const value = e.value?.[0] ?? '';
      setQuery(value);
      setIsListening(false);
    };

    Voice.onSpeechError = e => {
      setIsListening(false);
      Alert.alert(
        'Voice Search',
        e.error?.message ?? 'Could not recognize speech',
      );
    };

    Voice.onSpeechEnd = () => setIsListening(false);

    return () => {
      try {
        Voice.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  const fetchCurrentLocation = useCallback(async () => {
    const fallbackLocationText = 'Location unavailable';
    const googleMapsApiKey = String(
      (globalThis as any)?.process?.env?.GOOGLE_MAPS_API_KEY ??
        'AIzaSyAdChtoHHteVfd5O3Rmief-49HE_HX1IVo',
    ).trim();

    const requestLocationPermissionAndroid = async () => {
      if (Platform.OS !== 'android') return true;
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch {
        return false;
      }
    };

    try {
      setIsLocating(true);
      const hasPermission = await requestLocationPermissionAndroid();
      if (!hasPermission) {
        setCurrentLocationText('Location permission denied');
        setIsLocating(false);
        return;
      }

      const position = await new Promise<any>((resolve, reject) => {
        const geo = (globalThis as any)?.navigator?.geolocation;
        if (!geo?.getCurrentPosition) {
          reject(new Error('Geolocation not available'));
          return;
        }
        geo.getCurrentPosition(
          (pos: any) => resolve(pos),
          (err: any) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
        );
      });

      const lat = position?.coords?.latitude;
      const lng = position?.coords?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('Missing lat/lng');
      }

      let resolvedText = '';
      try {
        const apiKeyQuery = googleMapsApiKey
          ? `&api_key=${encodeURIComponent(googleMapsApiKey)}`
          : '';
        const url = `${API_V1_BASE_URL}/maps/reverse-geocode?lat=${lat}&lng=${lng}${apiKeyQuery}`;
        const response = await fetch(url);
        if (response.ok) {
          const json = await response.json();
          const data = json?.data;
          resolvedText =
            [data?.city, data?.state].filter(Boolean).join(', ') ||
            data?.address_line1 ||
            '';
        }
      } catch {
        // Ignore API failure; Google endpoint fallback below.
      }

      if (!resolvedText && googleMapsApiKey) {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
          `${lat},${lng}`,
        )}&key=${encodeURIComponent(googleMapsApiKey)}`;
        const googleResponse = await fetch(googleUrl);
        if (googleResponse.ok) {
          const googleJson = await googleResponse.json();
          const first = googleJson?.results?.[0];
          const components = Array.isArray(first?.address_components)
            ? first.address_components
            : [];
          const cityComp = components.find((c: any) =>
            Array.isArray(c?.types) &&
            (c.types.includes('locality') || c.types.includes('sublocality')),
          );
          const stateComp = components.find((c: any) =>
            Array.isArray(c?.types) &&
            c.types.includes('administrative_area_level_1'),
          );
          resolvedText =
            [cityComp?.long_name, stateComp?.long_name].filter(Boolean).join(', ') ||
            first?.formatted_address ||
            '';
        }
      }

      setCurrentLocationText(resolvedText || fallbackLocationText);
      setIsLocating(false);
    } catch {
      setCurrentLocationText(fallbackLocationText);
      setIsLocating(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Gradient-like backdrop (simulated with translucent layers) */}
      <View
        style={[
          styles.gradientLeft,
          { backgroundColor: primary, opacity: 0.22 },
        ]}
      />
      <View
        style={[
          styles.gradientRight,
          { backgroundColor: secondary, opacity: 0.18 },
        ]}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 10,
            // keep content above floating bottom tab bar
            paddingBottom: 96,
          },
        ]}>
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.addressTitle, { color: primaryText }]}>
            {isHomeKitchen ? 'Home & Kitchen' : 'FMCG'}
          </Text>
          <View style={styles.locationRow}>
            <Text
              style={[styles.addressText, { color: primary }]}
              numberOfLines={1}
            >
              {currentLocationText}
            </Text>
            <TouchableOpacity
              onPress={fetchCurrentLocation}
              disabled={isLocating}
              style={[styles.retryLocationBtn, { borderColor: primaryBorder }]}
              activeOpacity={0.9}>
              <Icon
                name={isLocating ? 'loading' : 'refresh'}
                size={12}
                color={primary}
              />
              <Text style={[styles.retryLocationText, { color: primary }]}>
                {isLocating ? 'Locating' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: primarySoft }]}
          onPress={() => navigation.getParent?.()?.navigate('Profile')}
          activeOpacity={0.9}
        >
          <Icon name="account-outline" size={20} color={primary} />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.divisionSegment,
          { borderColor: primaryBorder, backgroundColor: 'rgba(255,255,255,0.52)' },
        ]}>
        {divisions.map((item, index) => {
          const isActive = item.key === activeDivision;
          return (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={[
                  styles.divisionOption,
                  {
                    borderColor: primaryBorder,
                    backgroundColor: isActive
                      ? primary
                      : 'rgba(255,255,255,0.25)',
                  },
                ]}
                onPress={() => {
                  setActiveDivision(item.key);
                  dispatch(setHomeDivision(item.key));
                  setQuery('');
                  setActiveCategory('All');
                  setActiveBrand('All');
                }}
                activeOpacity={0.95}>
                {isActive ? <View style={styles.divisionSheen} /> : null}
                <View style={styles.divisionContent}>
                  <Icon
                    name={item.icon}
                    size={16}
                    color={isActive ? '#FFFFFF' : primary}
                  />
                  <Text
                    style={[
                      styles.divisionOptionText,
                      { color: isActive ? '#FFFFFF' : primary },
                      { marginLeft: 6 },
                    ]}>
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
              {index === 0 ? (
                <View
                  style={[
                    styles.divisionDivider,
                    { backgroundColor: primaryBorder },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: 'rgba(255,255,255,0.65)',
            borderColor: primaryBorder,
          },
        ]}
      >
        <Icon name="magnify" size={20} color={primary} />
        <TextInput
          style={[styles.search, { color: primaryText }]}
          placeholder={
            isHomeKitchen
              ? 'Search kitchen & home essentials...'
              : 'Search FMCG essentials...'
          }
          placeholderTextColor={primary}
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity
          onPress={async () => {
            try {
              if (!isVoiceSearchAvailable) {
                Alert.alert('Voice Search', VOICE_NOT_AVAILABLE_MESSAGE);
                return;
              }

              if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                  PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                  Alert.alert(
                    'Microphone permission',
                    'Please allow microphone access to use voice search.',
                  );
                  return;
                }
              }

              if (isListening) {
                setIsListening(false);
                await Voice.stop();
                return;
              }

              setQuery('');
              setIsListening(true);
              await Voice.start('en-US');
            } catch (err: any) {
              setIsListening(false);
              Alert.alert(
                'Voice Search',
                err?.message ?? 'Could not start voice search',
              );
            }
          }}
          style={styles.micBtn}
          activeOpacity={0.9}>
          <Icon
            name={isListening ? 'microphone' : 'microphone-outline'}
            size={20}
            color={primary}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.banner,
          {
            backgroundColor: primary,
          },
        ]}
      >
        <View
          style={[
            styles.bannerOverlayLeft,
            { backgroundColor: secondary, opacity: 0.28 },
          ]}
        />
        <View
          style={[
            styles.bannerOverlayRight,
            { backgroundColor: '#FFFFFF', opacity: 0.12 },
          ]}
        />
        <Text style={styles.bannerTitle}>
          {isHomeKitchen ? 'Home & Kitchen Deals' : 'FMCG Deals'}
        </Text>
        <Text style={styles.bannerSubtitle}>
          {isHomeKitchen
            ? 'Premium kitchen essentials & offers'
            : 'Min Rs 150 Off + Rs 100 Cashback'}
        </Text>
      </View>

      <FlatList
        data={dealsForDivision}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <DealCard deal={item} />}
      />
      {isProductsLoading ? (
        <Text style={[styles.stateText, { color: primary }]}>Loading products...</Text>
      ) : null}
      {isProductsError ? (
        <Text style={styles.stateErrorText}>
          Could not fetch latest products. Showing fallback catalog.
        </Text>
      ) : null}

      <View style={styles.filterBlock}>
        <View style={styles.filterTitleRow}>
          <Text style={[styles.filterTitle, { color: primaryText }]}>
            Shop by Category
          </Text>
          <View style={styles.filterTitleRight}>
            <Text style={[styles.filterMeta, { color: primary }]}>
              {showCategoryImageBoxes
                ? categoryTreeRoots.length
                : categories.length - 1}{' '}
              options
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('CategoryBrandGrid', {
                  division: activeDivision,
                  kind: 'categories',
                })
              }
              activeOpacity={0.9}>
              <Text style={[styles.seeAll, { color: primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showCategoryImageBoxes ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBoxesRow}>
            <TouchableOpacity
              style={styles.categoryBoxTile}
              onPress={() => setActiveCategory('All')}
              activeOpacity={0.95}>
              <View
                style={[
                  styles.categoryBoxImageWrap,
                  { borderColor: primaryBorder },
                  activeCategory === 'All' && {
                    borderColor: primary,
                    borderWidth: 2,
                  },
                ]}>
                <Icon name="shape-outline" size={28} color={primary} />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.categoryBoxName, { color: primaryText }]}>
                All
              </Text>
              <Text style={styles.categoryBoxCount}>
                {divisionProducts.length} products
              </Text>
            </TouchableOpacity>
            {categoryTreeRoots.map(node => {
              const img = String(node.image_url ?? '').trim();
              const count =
                typeof node.product_count === 'number'
                  ? node.product_count
                  : categoryCountMap[node.name] ?? 0;
              return (
                <TouchableOpacity
                  key={node.id}
                  style={styles.categoryBoxTile}
                  onPress={() => {
                    setActiveCategory(node.name);
                    navigation.navigate('ProductOverview', {
                      division: activeDivision,
                      subCategory: node.name,
                    });
                  }}
                  activeOpacity={0.95}>
                  <View
                    style={[
                      styles.categoryBoxImageWrap,
                      { borderColor: primaryBorder },
                      activeCategory === node.name && {
                        borderColor: primary,
                        borderWidth: 2,
                      },
                    ]}>
                    {img ? (
                      <Image
                        source={{ uri: img }}
                        style={styles.categoryBoxImage}
                        resizeMode="cover"
                      />
                    ) : node.icon ? (
                      <Text style={styles.categoryBoxEmoji}>{node.icon}</Text>
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
                    style={[styles.categoryBoxName, { color: primaryText }]}>
                    {node.name}
                  </Text>
                  <Text style={styles.categoryBoxCount}>{count} products</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {categories.map(cat => {
              const active = cat === activeCategory;
              const count =
                cat === 'All' ? divisionProducts.length : categoryCountMap[cat] ?? 0;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    if (cat === 'All') {
                      setActiveCategory('All');
                      return;
                    }
                    navigation.navigate('ProductOverview', {
                      division: activeDivision,
                      subCategory: cat,
                    });
                  }}
                  style={[
                    styles.filterCard,
                    active && {
                      backgroundColor: primary,
                      borderColor: primary,
                    },
                  ]}
                  activeOpacity={0.95}>
                  <View
                    style={[
                      styles.filterCardIconWrap,
                      active && { backgroundColor: 'rgba(255,255,255,0.22)' },
                    ]}>
                    <Icon
                      name={
                        cat === 'All' ? 'shape-outline' : 'view-grid-plus-outline'
                      }
                      size={14}
                      color={active ? '#FFFFFF' : primary}
                    />
                  </View>
                  <View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.filterCardTitle,
                        active ? { color: '#FFFFFF' } : { color: primaryText },
                      ]}>
                      {cat}
                    </Text>
                    <Text
                      style={[
                        styles.filterCardSub,
                        active
                          ? { color: 'rgba(255,255,255,0.9)' }
                          : { color: '#64748B' },
                      ]}>
                      {count} products
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.filterTitleRow, { marginTop: 10 }]}>
          <Text style={[styles.filterTitle, { color: primaryText }]}>
            Shop by Brand
          </Text>
          <View style={styles.filterTitleRight}>
            <Text style={[styles.filterMeta, { color: primary }]}>
              {brands.length - 1} brands
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('CategoryBrandGrid', {
                  division: activeDivision,
                  kind: 'brands',
                })
              }
              activeOpacity={0.9}>
              <Text style={[styles.seeAll, { color: primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {brands.map(b => {
            const active = b === activeBrand;
            const count = b === 'All' ? divisionProducts.length : brandCountMap[b] ?? 0;
            return (
              <TouchableOpacity
                key={b}
                onPress={() => {
                  if (b === 'All') {
                    setActiveBrand('All');
                    return;
                  }
                  navigation.navigate('ProductOverview', {
                    division: activeDivision,
                    brand: b,
                  });
                }}
                style={[
                  styles.filterCard,
                  active && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                activeOpacity={0.95}>
                <View style={[styles.filterCardIconWrap, active && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <Icon
                    name={b === 'All' ? 'storefront-outline' : 'tag-outline'}
                    size={14}
                    color={active ? '#FFFFFF' : primary}
                  />
                </View>
                <View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.filterCardTitle,
                      active ? { color: '#FFFFFF' } : { color: primaryText },
                    ]}>
                    {b}
                  </Text>
                  <Text
                    style={[
                      styles.filterCardSub,
                      active ? { color: 'rgba(255,255,255,0.9)' } : { color: '#64748B' },
                    ]}>
                    {count} products
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>
          {isHomeKitchen ? 'Kitchen Essentials' : 'FMCG Picks'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductOverview', { division: activeDivision })}
          activeOpacity={0.9}
        >
          <Text style={[styles.seeAll, { color: primary }]}>See all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        key="home-products-grid-2-cols"
        data={visibleProducts}
        keyExtractor={item => item.id}
        numColumns={2}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onAdd={p => add(p, 1, defaultPriceTier(p))}
            accentColor={primary}
            onCardPress={() =>
              navigation.navigate('ProductOverview', {
                division: activeDivision,
                productId: item.id,
              })
            }
          />
        )}
      />
      </ScrollView>
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
  container: { flex: 1 },
  content: { paddingHorizontal: 14 },
  topBar: {
    marginTop: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressTitle: { fontSize: 24, fontWeight: '900', color: '#0B3B8F' },
  addressText: {
    marginTop: 2,
    color: '#1D4ED8',
    maxWidth: 170,
    fontWeight: '500',
  },
  locationRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  retryLocationText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F1FF',
  },
  serviceRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  activeServicePill: {
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  servicePillText: { color: '#1D4ED8', fontWeight: '900', fontSize: 12 },
  activeServicePillText: { color: '#FFFFFF' },
  divisionSegment: {
    marginTop: 14,
    flexDirection: 'row',
    borderRadius: 22,
    padding: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divisionOption: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divisionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divisionOptionText: {
    fontWeight: '900',
    fontSize: 12,
  },
  divisionDivider: {
    width: 1,
    marginVertical: 6,
    opacity: 0.9,
  },
  divisionSheen: {
    position: 'absolute',
    left: -20,
    top: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '25deg' }],
  },
  searchWrap: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  search: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    color: '#0B3B8F',
  },
  micBtn: { paddingLeft: 8, paddingVertical: 8 },
  banner: {
    marginVertical: 12,
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
  },
  bannerOverlayLeft: {
    position: 'absolute',
    width: 220,
    height: 220,
    left: -110,
    top: -120,
    borderRadius: 110,
  },
  bannerOverlayRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    right: -130,
    bottom: -170,
    borderRadius: 130,
  },
  bannerTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  bannerSubtitle: { color: '#FFFFFF', marginTop: 4, fontWeight: '700' },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0B3B8F' },
  seeAll: { color: '#1D4ED8', fontWeight: '900' },
  filterBlock: {
    marginTop: 12,
    paddingHorizontal: 2,
  },
  filterTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterTitleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  filterTitle: {
    fontWeight: '900',
    fontSize: 14,
  },
  filterMeta: { fontWeight: '800', fontSize: 12 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    gap: 10,
  },
  categoryBoxesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 8,
    gap: 4,
    paddingRight: 8,
  },
  categoryBoxTile: {
    width: 96,
    alignItems: 'center',
    marginRight: 10,
  },
  categoryBoxImageWrap: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(248,250,252,0.95)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBoxImage: {
    width: '100%',
    height: '100%',
  },
  categoryBoxEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  categoryBoxName: {
    marginTop: 8,
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 96,
  },
  categoryBoxCount: {
    marginTop: 2,
    fontWeight: '600',
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  filterCard: {
    width: 146,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCardTitle: { fontWeight: '900', fontSize: 12, maxWidth: 94 },
  filterCardSub: { fontWeight: '700', fontSize: 11, marginTop: 1 },
  stateText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  stateErrorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
});

export default HomeScreen;
