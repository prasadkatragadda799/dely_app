import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGetCategoryTreeQuery,
  useGetOffersQuery,
  useGetProductsQuery,
} from '../../products/api/productsApi';
import { API_V1_BASE_URL } from '../../../services/api/config';
import { useCart } from '../../../hooks/useCart';
import ProductCard from '../../../shared/ui/ProductCard';
import { useAppDispatch } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
  VOICE_NOT_AVAILABLE_MESSAGE,
} from '../../../utils/voice';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import type { Deal } from '../../../types';

type DivisionKey = 'fmcg' | 'homeKitchen';

const DIVISION_TRACK_PAD = 4;

const divisions: Array<{
  key: DivisionKey;
  label: string;
  shortLabel: string;
  segmentLabel: string;
  icon: string;
  tagline: string;
}> = [
  {
    key: 'fmcg',
    label: 'FMCG & Groceries',
    shortLabel: 'FMCG',
    segmentLabel: 'FMCG',
    icon: 'basket-outline',
    tagline: 'Food, snacks & daily essentials',
  },
  {
    key: 'homeKitchen',
    label: 'Home & Kitchen',
    shortLabel: 'Home & Kitchen',
    segmentLabel: 'Home & kitchen',
    icon: 'sofa-outline',
    tagline: 'Cookware, décor & home care',
  },
];

const HomeScreen = () => {
  const { alert: appAlert } = useAppAlert();
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
  const [activeCompany, setActiveCompany] = useState<string>('All');
  const [isListening, setIsListening] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [heroDealIndex, setHeroDealIndex] = useState(0);
  const [stripDealIndex, setStripDealIndex] = useState(0);
  const tabBarHeight = useBottomTabBarHeight();

  const { width: windowWidth } = useWindowDimensions();
  const contentPad = 14;
  /** One carousel page = full screen width so paging aligns (narrow slides were drifting left). */
  const heroPageWidth = Math.max(320, windowWidth);
  const heroCardWidth = Math.max(260, windowWidth - contentPad * 2);
  const gridGap = 8;
  const gridCellWidth = (windowWidth - contentPad * 2 - gridGap * 2) / 3;
  const stripCardWidth = Math.min(200, windowWidth * 0.52);

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

  const selectDivision = useCallback(
    (key: DivisionKey) => {
      setActiveDivision(key);
      dispatch(setHomeDivision(key));
      setQuery('');
      setActiveCategory('All');
      setActiveCompany('All');
    },
    [dispatch],
  );

  const divisionThumbX = useRef(
    new Animated.Value(DIVISION_TRACK_PAD),
  ).current;
  const [divisionThumbSegmentPx, setDivisionThumbSegmentPx] = useState(0);

  const onDivisionTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const inner = w - DIVISION_TRACK_PAD * 2;
    setDivisionThumbSegmentPx(Math.max(0, inner / 2));
  }, []);

  useEffect(() => {
    if (divisionThumbSegmentPx <= 0) return;
    const to =
      activeDivision === 'fmcg'
        ? DIVISION_TRACK_PAD
        : DIVISION_TRACK_PAD + divisionThumbSegmentPx;
    Animated.spring(divisionThumbX, {
      toValue: to,
      useNativeDriver: true,
      friction: 9,
      tension: 95,
    }).start();
  }, [activeDivision, divisionThumbSegmentPx, divisionThumbX]);

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

    const byCompany =
      activeCompany === 'All'
        ? byCategory
        : byCategory.filter(p => p.companyName === activeCompany);

    return byCompany;
  }, [
    activeDivision,
    allProducts,
    query,
    activeCategory,
    activeCompany,
  ]);

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

  const companies = useMemo(() => {
    const set = new Set<string>();
    divisionProducts.forEach(p => {
      const n = p.companyName?.trim();
      if (n) set.add(n);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [divisionProducts]);

  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.subCategory || 'Other';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const companyCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    divisionProducts.forEach(p => {
      const key = p.companyName?.trim();
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [divisionProducts]);

  const companyLogoByName = useMemo(() => {
    const map: Record<string, string> = {};
    divisionProducts.forEach(p => {
      const name = p.companyName?.trim();
      const url = p.companyLogoUrl?.trim();
      if (name && url && map[name] === undefined) {
        map[name] = url;
      }
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

  const heroDeals = useMemo((): Deal[] => {
    if (dealsForDivision.length > 0) return dealsForDivision;
    return [
      {
        id: 'placeholder-hero',
        title: isHomeKitchen ? 'Home & Kitchen' : 'FMCG & Groceries',
        subtitle: 'Offers will appear here soon',
        color: primary,
      },
    ];
  }, [dealsForDivision, isHomeKitchen, primary]);

  const companyGridItems = useMemo(
    () => companies.filter((c): c is string => c !== 'All').slice(0, 9),
    [companies],
  );

  const categoryGridItems = useMemo(() => {
    if (categoryTreeRoots.length > 0) {
      return categoryTreeRoots.slice(0, 9).map(n => ({
        key: String(n.id),
        name: n.name,
        imageUrl: String(n.image_url ?? '').trim() || undefined,
        icon: n.icon ?? undefined,
        count:
          typeof n.product_count === 'number'
            ? n.product_count
            : categoryCountMap[n.name] ?? 0,
      }));
    }
    return categories
      .filter((c): c is string => c !== 'All')
      .slice(0, 9)
      .map(c => ({
        key: c,
        name: c,
        imageUrl: undefined as string | undefined,
        icon: undefined as string | undefined,
        count: categoryCountMap[c] ?? 0,
      }));
  }, [categoryTreeRoots, categories, categoryCountMap]);

  const visibleProducts = filteredProducts.slice(0, 4);

  const onHeroMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / heroPageWidth);
    setHeroDealIndex(
      Math.max(0, Math.min(heroDeals.length - 1, idx)),
    );
  };

  const onStripMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (stripCardWidth + 10));
    setStripDealIndex(
      Math.max(0, Math.min(heroDeals.length - 1, idx)),
    );
  };
  React.useEffect(() => {
    Voice.onSpeechResults = e => {
      const value = e.value?.[0] ?? '';
      setQuery(value);
      setIsListening(false);
    };

    Voice.onSpeechError = e => {
      setIsListening(false);
      void appAlert({
        title: 'Voice search',
        message: e.error?.message ?? 'Could not recognize speech',
      });
    };

    Voice.onSpeechEnd = () => setIsListening(false);

    return () => {
      try {
        Voice.destroy();
      } catch {
        // ignore
      }
    };
  }, [appAlert]);

  const fetchCurrentLocation = useCallback(async () => {
    const fallbackLocationText = 'Location unavailable';
    const googleMapsApiKey = String(
      (globalThis as any)?.process?.env?.GOOGLE_MAPS_API_KEY ?? '',
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

  React.useEffect(() => {
    setHeroDealIndex(0);
    setStripDealIndex(0);
  }, [activeDivision, heroDeals.length]);

  const activeDivisionMeta = divisions.find(d => d.key === activeDivision);

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
            paddingBottom: Math.max(tabBarHeight + 28, 100),
          },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
      <View style={styles.paperHeader}>
        <View style={styles.paperHeaderTop}>
          <View style={styles.paperBrandBlock}>
            <View style={[styles.paperLogoMark, { backgroundColor: primarySoft }]}>
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.paperLogoImage}
                resizeMode="contain"
                accessibilityLabel="Dely"
              />
            </View>
            <View style={styles.paperShopFor}>
              <Text style={[styles.paperShopForLabel, { color: '#64748B' }]}>
                Shop for
              </Text>
              <Text
                style={[styles.paperShopForValue, { color: primaryText }]}
                numberOfLines={2}>
                {activeDivisionMeta?.label ?? 'FMCG & Groceries'}
              </Text>
            </View>
          </View>
          <View style={styles.paperHeaderActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.paperIconBtn, { borderColor: primaryBorder }]}
              activeOpacity={0.9}>
              <Icon name="bell-outline" size={22} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.getParent?.()?.navigate('Cart')}
              style={[styles.paperIconBtn, { borderColor: primaryBorder }]}
              activeOpacity={0.9}>
              <Icon name="cart-outline" size={22} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paperIconBtn, { borderColor: primaryBorder }]}
              onPress={() => navigation.getParent?.()?.navigate('Profile')}
              activeOpacity={0.9}>
              <Icon name="account-outline" size={22} color={primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: '#FFFFFF',
            borderColor: primaryBorder,
          },
        ]}>
        <Icon name="magnify" size={20} color={primary} />
        <TextInput
          style={[styles.search, { color: primaryText }]}
          placeholder={
            isHomeKitchen
              ? 'Search kitchen & home essentials...'
              : 'Search groceries & daily needs...'
          }
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity
          onPress={async () => {
            try {
              if (!isVoiceSearchAvailable) {
                await appAlert({
                  title: 'Voice search',
                  message: VOICE_NOT_AVAILABLE_MESSAGE,
                });
                return;
              }

              if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                  PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                  await appAlert({
                    title: 'Microphone permission',
                    message:
                      'Please allow microphone access to use voice search.',
                  });
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
              await appAlert({
                title: 'Voice search',
                message: err?.message ?? 'Could not start voice search',
              });
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

      <Text style={[styles.divisionSectionLabel, { color: primaryText }]}>
        What are you shopping for?
      </Text>
      <View
        style={[
          styles.divisionTrackOuter,
          { borderColor: primaryBorder, backgroundColor: '#E8EEF4' },
        ]}
        onLayout={onDivisionTrackLayout}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.divisionPillThumb,
            {
              width: Math.max(divisionThumbSegmentPx, 1),
              opacity: divisionThumbSegmentPx > 0 ? 1 : 0,
              backgroundColor: primary,
              transform: [{ translateX: divisionThumbX }],
            },
          ]}
        />
        <View style={styles.divisionTrackRow}>
          {divisions.map(item => {
            const isActive = item.key === activeDivision;
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.divisionTrackHit}
                onPress={() => selectDivision(item.key)}
                activeOpacity={0.88}>
                <Icon
                  name={item.icon}
                  size={22}
                  color={isActive ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.divisionTrackLabel,
                    { color: isActive ? '#FFFFFF' : '#475569' },
                  ]}
                  numberOfLines={1}>
                  {item.segmentLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text
        style={[styles.divisionTaglineCaption, { color: '#64748B' }]}
        numberOfLines={2}>
        {divisions.find(d => d.key === activeDivision)?.tagline}
      </Text>

      <TouchableOpacity
        style={[
          styles.locationPill,
          { borderColor: primaryBorder, backgroundColor: '#FFFFFF' },
        ]}
        onPress={fetchCurrentLocation}
        disabled={isLocating}
        activeOpacity={0.9}>
        <Icon name="map-marker-outline" size={20} color={primary} />
        <View style={styles.locationPillTextWrap}>
          <Text style={[styles.locationPillTitle, { color: primaryText }]}>
            Delivery location
          </Text>
          <Text
            style={[styles.locationPillSub, { color: '#64748B' }]}
            numberOfLines={1}>
            {isLocating ? 'Locating…' : currentLocationText}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color="#94A3B8" />
      </TouchableOpacity>

      <Text style={[styles.paperSectionTitle, { color: primaryText }]}>
        Featured offers
      </Text>
      <FlatList
        data={heroDeals}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: heroPageWidth,
          offset: heroPageWidth * index,
          index,
        })}
        onMomentumScrollEnd={onHeroMomentumEnd}
        style={[styles.heroCarouselList, { width: heroPageWidth }]}
        renderItem={({ item }) => (
          <View
            style={{
              width: heroPageWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={[
                styles.heroSlideCard,
                {
                  width: heroCardWidth,
                  backgroundColor: item.color,
                },
              ]}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.heroSlideOverlay} />
              <View style={styles.heroSlideTextBlock}>
                <Text style={styles.heroSlideTitle}>{item.title}</Text>
                <Text style={styles.heroSlideSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <View style={styles.carouselDots}>
        {heroDeals.map((d, i) => (
          <View
            key={`hero-dot-${d.id}`}
            style={[
              styles.carouselDot,
              i === heroDealIndex && {
                backgroundColor: primary,
                width: 20,
              },
            ]}
          />
        ))}
      </View>

      {isProductsLoading ? (
        <Text style={[styles.stateText, { color: primary }]}>Loading products...</Text>
      ) : null}
      {isProductsError ? (
        <Text style={styles.stateErrorText}>
          Could not fetch latest products. Showing fallback catalog.
        </Text>
      ) : null}

      <View style={styles.paperSection}>
        <Text style={[styles.paperSectionTitle, { color: primaryText }]}>
          Quick links
        </Text>
        <View style={[styles.quickGrid, { gap: gridGap }]}>
          {(
            [
              {
                label: 'Top offers',
                icon: 'fire' as const,
                onPress: () =>
                  navigation.navigate('ProductOverview', {
                    division: activeDivision,
                  }),
              },
              {
                label: 'Brands',
                icon: 'storefront-outline' as const,
                onPress: () =>
                  navigation.navigate('CategoryBrowse', {
                    division: activeDivision,
                    mode: 'brands',
                  }),
              },
              {
                label: 'Categories',
                icon: 'view-grid-outline' as const,
                onPress: () =>
                  navigation.navigate('CategoryBrowse', {
                    division: activeDivision,
                  }),
              },
              {
                label: 'Orders',
                icon: 'truck-outline' as const,
                onPress: () => navigation.navigate('Orders'),
              },
              {
                label: 'Wishlist',
                icon: 'heart-outline' as const,
                onPress: () => navigation.navigate('Wishlist'),
              },
              {
                label: 'Browse all',
                icon: 'text-search' as const,
                onPress: () =>
                  navigation.navigate('ProductOverview', {
                    division: activeDivision,
                  }),
              },
            ] as const
          ).map(cell => (
            <TouchableOpacity
              key={cell.label}
              style={[
                styles.quickCell,
                {
                  width: gridCellWidth,
                  borderColor: primaryBorder,
                  backgroundColor: '#FFFFFF',
                },
              ]}
              onPress={cell.onPress}
              activeOpacity={0.92}>
              <View
                style={[
                  styles.quickCellIconWrap,
                  { backgroundColor: primarySoft },
                ]}>
                <Icon name={cell.icon} size={22} color={primary} />
              </View>
              <Text
                style={[styles.quickCellLabel, { color: primaryText }]}
                numberOfLines={2}>
                {cell.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.paperSection}>
        <View style={styles.paperSectionHeaderRow}>
          <Text style={[styles.paperSectionTitle, { color: primaryText, marginBottom: 0 }]}>
            Shop by company
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CategoryBrowse', {
                division: activeDivision,
                mode: 'companies',
              })
            }
            activeOpacity={0.9}>
            <Text style={[styles.viewAllLink, { color: primary }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {activeCompany !== 'All' ? (
          <TouchableOpacity
            onPress={() => setActiveCompany('All')}
            style={styles.clearFilterLink}
            activeOpacity={0.85}>
            <Text style={[styles.clearFilterLinkText, { color: primary }]}>
              Show all companies
            </Text>
          </TouchableOpacity>
        ) : null}
        {companyGridItems.length === 0 ? (
          <Text style={styles.gridEmptyHint}>
            Companies appear when products are linked to sellers.
          </Text>
        ) : (
          Array.from(
            { length: Math.ceil(companyGridItems.length / 3) },
            (_, row) => (
              <View
                key={`co-row-${row}`}
                style={[styles.gridRowThree, { gap: gridGap, marginBottom: gridGap }]}>
                {companyGridItems.slice(row * 3, row * 3 + 3).map(c => {
                  const logo = companyLogoByName[c];
                  const count = companyCountMap[c] ?? 0;
                  const active = activeCompany === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.gridCellTall,
                        {
                          width: gridCellWidth,
                          borderColor: active ? primary : primaryBorder,
                          backgroundColor: '#FFFFFF',
                        },
                      ]}
                      onPress={() => setActiveCompany(c)}
                      activeOpacity={0.92}>
                      <View
                        style={[
                          styles.gridCellLogoBox,
                          { borderColor: primaryBorder },
                        ]}>
                        {logo ? (
                          <Image
                            source={{ uri: logo }}
                            style={styles.gridCellLogoImg}
                            resizeMode="contain"
                          />
                        ) : (
                          <Icon name="domain" size={26} color={primary} />
                        )}
                      </View>
                      <Text
                        style={[styles.gridCellName, { color: primaryText }]}
                        numberOfLines={3}>
                        {c}
                      </Text>
                      <Text style={styles.gridCellCount}>{count} items</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ),
          )
        )}
      </View>

      <Text style={[styles.paperSectionTitle, { color: primaryText }]}>
        More offers
      </Text>
      <FlatList
        data={heroDeals}
        keyExtractor={item => `strip-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={stripCardWidth + 10}
        decelerationRate="fast"
        onMomentumScrollEnd={onStripMomentumEnd}
        style={styles.stripCarouselList}
        contentContainerStyle={styles.stripCarouselContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.stripCard,
              {
                width: stripCardWidth,
                backgroundColor: item.color,
              },
            ]}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.stripOverlay} />
            <Text style={styles.stripTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.stripSubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />
      <View style={styles.carouselDots}>
        {heroDeals.map((d, i) => (
          <View
            key={`strip-dot-${d.id}`}
            style={[
              styles.carouselDot,
              i === stripDealIndex && {
                backgroundColor: primary,
                width: 20,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.paperSection}>
        <View style={styles.paperSectionHeaderRow}>
          <Text style={[styles.paperSectionTitle, { color: primaryText, marginBottom: 0 }]}>
            Shop by category
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CategoryBrowse', { division: activeDivision })
            }
            activeOpacity={0.9}>
            <Text style={[styles.viewAllLink, { color: primary }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {activeCategory !== 'All' ? (
          <TouchableOpacity
            onPress={() => setActiveCategory('All')}
            style={styles.clearFilterLink}
            activeOpacity={0.85}>
            <Text style={[styles.clearFilterLinkText, { color: primary }]}>
              Show all categories
            </Text>
          </TouchableOpacity>
        ) : null}
        {categoryGridItems.length === 0 ? (
          <Text style={styles.gridEmptyHint}>
            Categories will show when the catalog is loaded.
          </Text>
        ) : (
          Array.from(
            { length: Math.ceil(categoryGridItems.length / 3) },
            (_, row) => (
              <View
                key={`cat-row-${row}`}
                style={[styles.gridRowThree, { gap: gridGap, marginBottom: gridGap }]}>
                {categoryGridItems.slice(row * 3, row * 3 + 3).map(cat => {
                  const active = activeCategory === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.gridCellTall,
                        {
                          width: gridCellWidth,
                          borderColor: active ? primary : primaryBorder,
                          backgroundColor: '#FFFFFF',
                        },
                      ]}
                      onPress={() => {
                        setActiveCategory(cat.name);
                        navigation.navigate('ProductOverview', {
                          division: activeDivision,
                          subCategory: cat.name,
                        });
                      }}
                      activeOpacity={0.92}>
                      <View
                        style={[
                          styles.gridCellLogoBox,
                          { borderColor: primaryBorder },
                        ]}>
                        {cat.imageUrl ? (
                          <Image
                            source={{ uri: cat.imageUrl }}
                            style={styles.gridCellPhoto}
                            resizeMode="cover"
                          />
                        ) : cat.icon ? (
                          <Text style={styles.gridCellEmoji}>{cat.icon}</Text>
                        ) : (
                          <Icon
                            name="view-grid-plus-outline"
                            size={26}
                            color={primary}
                          />
                        )}
                      </View>
                      <Text
                        style={[styles.gridCellName, { color: primaryText }]}
                        numberOfLines={3}>
                        {cat.name}
                      </Text>
                      <Text style={styles.gridCellCount}>
                        {cat.count} items
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ),
          )
        )}
      </View>


      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>
          {isHomeKitchen ? 'Recommended for your home' : 'Recommended for you'}
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
            onAdd={(p, tier) => add(p, 1, tier)}
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
  paperHeader: { marginBottom: 2 },
  paperHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paperBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  paperLogoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  paperLogoImage: {
    width: 34,
    height: 34,
  },
  paperShopFor: { flex: 1, minWidth: 0 },
  paperShopForLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paperShopForValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  paperHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paperIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  divisionSectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divisionTrackOuter: {
    borderRadius: 999,
    borderWidth: 1,
    padding: DIVISION_TRACK_PAD,
    position: 'relative',
    overflow: 'hidden',
  },
  divisionPillThumb: {
    position: 'absolute',
    top: DIVISION_TRACK_PAD,
    bottom: DIVISION_TRACK_PAD,
    left: 0,
    borderRadius: 999,
  },
  divisionTrackRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  divisionTrackHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  divisionTrackLabel: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  divisionTaglineCaption: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  locationPill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  locationPillTextWrap: { flex: 1, minWidth: 0 },
  locationPillTitle: { fontSize: 13, fontWeight: '800' },
  locationPillSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  searchWrap: {
    marginTop: 14,
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
  paperSectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '900',
  },
  heroCarouselList: { marginTop: 4, marginHorizontal: -14 },
  heroSlideCard: {
    position: 'relative',
    height: 168,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroSlideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroSlideTextBlock: {
    padding: 16,
    zIndex: 2,
  },
  heroSlideTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroSlideSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    marginTop: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  paperSection: { marginTop: 4 },
  paperSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  viewAllLink: { fontSize: 13, fontWeight: '900' },
  clearFilterLink: { marginTop: -4, marginBottom: 8 },
  clearFilterLinkText: { fontSize: 12, fontWeight: '800' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCell: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  quickCellIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCellLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  gridEmptyHint: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 4,
  },
  gridRowThree: { flexDirection: 'row', justifyContent: 'flex-start' },
  gridCellTall: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  gridCellLogoBox: {
    width: '100%',
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellLogoImg: { width: '80%', height: '80%' },
  gridCellPhoto: { width: '100%', height: '100%' },
  gridCellEmoji: { fontSize: 28 },
  gridCellName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 36,
  },
  gridCellCount: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  stripCarouselList: { marginTop: 4, marginHorizontal: -14 },
  stripCarouselContent: { paddingHorizontal: 14, paddingVertical: 4 },
  stripCard: {
    position: 'relative',
    height: 100,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  stripOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  stripTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, zIndex: 2 },
  stripSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 11,
    marginTop: 4,
    zIndex: 2,
  },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0B3B8F' },
  seeAll: { color: '#1D4ED8', fontWeight: '900' },
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
