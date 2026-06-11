import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
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
import { useAuth } from '../../../hooks/useAuth';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
  VOICE_NOT_AVAILABLE_MESSAGE,
} from '../../../utils/voice';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import {
  useGetDeliveryLocationsQuery,
  useCheckServiceLocationQuery,
  useGetCompaniesQuery,
  useGetKycStatusQuery,
} from '../../../services/api/mobileApi';
import type { Deal } from '../../../types';
import { palette, shadow, getDivision } from '../../../utils/theme';
import AppImage, { prefetchImages } from '../../../shared/ui/AppImage';

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
    label: 'Food-FMCG',
    shortLabel: 'Food-FMCG',
    segmentLabel: 'Food-FMCG',
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
  const route = useRoute<any>();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { data: kycEnvelope } = useGetKycStatusQuery(undefined, { skip: !user });
  const kycStatus: string | null = useMemo(() => {
    const d: any = kycEnvelope?.data;
    return d?.kyc_status ?? d?.kycStatus ?? null;
  }, [kycEnvelope]);
  const isKycVerified = kycStatus === 'verified';
  const isKycLoaded = kycStatus !== null;
  // Customer's default delivery pincode — drives zone serviceability (show-all, mark-unavailable).
  const { data: deliveryLocationsEnvelope } = useGetDeliveryLocationsQuery();
  const deliveryLocations = (deliveryLocationsEnvelope?.data as any[]) ?? [];
  const defaultLocation = deliveryLocations.find((l: any) => l.is_default) ?? deliveryLocations[0];
  const defaultPincode: string = defaultLocation?.pincode ?? '';
  const pincode = defaultPincode || undefined;
  const { data: fmcgProds = [], isLoading: isFmcgLoading, isError: isFmcgError } = useGetProductsQuery({ category: 'fmcg', pincode });
  const { data: kitchenProds = [], isLoading: isKitchenLoading } = useGetProductsQuery({ category: 'kitchen', pincode });
  const { data: homeProds = [], isLoading: isHomeLoading } = useGetProductsQuery({ category: 'home', pincode });
  const allProducts = useMemo(() => [...fmcgProds, ...kitchenProds, ...homeProds], [fmcgProds, kitchenProds, homeProds]);
  const isProductsLoading = isFmcgLoading || isKitchenLoading || isHomeLoading;
  const isProductsError = isFmcgError;
  const { data: offers = [] } = useGetOffersQuery();
  const { data: companiesEnvelope } = useGetCompaniesQuery();
  const isScreenLoading = isProductsLoading;
  const { add } = useCart();
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('fmcg');
  const { data: categoryTreeRoots = [] } = useGetCategoryTreeQuery(activeDivision);
  const [currentLocationText, setCurrentLocationText] = useState('Fetching location...');
  const manualLocationSet = useRef(false);

  // Location availability check
  const { data: locationCheckEnvelope } = useCheckServiceLocationQuery(defaultPincode, {
    skip: !defaultPincode,
  });
  const locationCheckData = locationCheckEnvelope?.data;
  const isLocationUnavailable =
    !!locationCheckData && locationCheckData.restricted && !locationCheckData.available;
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isListening, setIsListening] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [heroDealIndex, setHeroDealIndex] = useState(0);
  const tabBarHeight = useBottomTabBarHeight();

  const { width: windowWidth } = useWindowDimensions();
  const contentPad = 14;
  /** One carousel page = full screen width so paging aligns (narrow slides were drifting left). */
  const heroPageWidth = Math.max(320, windowWidth);
  const heroCardWidth = Math.max(260, windowWidth - contentPad * 2);
  const gridGap = 8;
  const gridCellWidth = Math.floor((windowWidth - contentPad * 2 - gridGap * 2) / 3);
  const gridCellWidthFour = (windowWidth - contentPad * 2 - gridGap * 3) / 4;

  const isHomeKitchen = activeDivision === 'homeKitchen';
  const dz = getDivision(activeDivision);
  const primary = dz.primary;
  const primaryBorder = dz.border;
  const primaryText = dz.primaryDeep;

  const selectDivision = useCallback(
    (key: DivisionKey) => {
      setActiveDivision(key);
      dispatch(setHomeDivision(key));
      setQuery('');
      setActiveCategory('All');
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

    return byCategory;
  }, [
    activeDivision,
    allProducts,
    query,
    activeCategory,
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

  const apiCompanies: Array<{ id: string; name: string; logoUrl?: string }> = useMemo(() => {
    const items = (companiesEnvelope?.data as any)?.items ?? [];
    return items
      .filter((c: any) => c?.name)
      .map((c: any) => ({ id: String(c.id), name: String(c.name).trim(), logoUrl: c.logoUrl ?? undefined }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [companiesEnvelope]);

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

  const companies = useMemo(() => {
    // Only show companies that have products in the active division
    const divisionNames = new Set(Object.keys(companyCountMap));
    const filtered = apiCompanies.filter(c => divisionNames.has(c.name));
    if (filtered.length > 0) {
      return ['All', ...filtered.map(c => c.name)];
    }
    // Fallback: derive from loaded products (already division-filtered)
    const set = new Set<string>();
    divisionProducts.forEach(p => {
      const n = p.companyName?.trim();
      if (n) set.add(n);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [apiCompanies, divisionProducts, companyCountMap]);

  const companyLogoByName = useMemo(() => {
    const map: Record<string, string> = {};
    // Seed from product data first (may have logos for fewer companies).
    divisionProducts.forEach(p => {
      const name = p.companyName?.trim();
      const url = p.companyLogoUrl?.trim();
      if (name && url && map[name] === undefined) {
        map[name] = url;
      }
    });
    // Override/fill with API logos, which are authoritative and cover all companies.
    apiCompanies.forEach(c => {
      if (c.logoUrl && c.name) {
        map[c.name] = c.logoUrl;
      }
    });
    return map;
  }, [divisionProducts, apiCompanies]);

  const dealsForDivision = useMemo(() => {
    const color = isHomeKitchen ? '#22C55E' : '#3B82F6';
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
        title: isHomeKitchen ? 'Home & Kitchen' : 'Food-FMCG',
        subtitle: 'Offers will appear here soon',
        color: primary,
      },
    ];
  }, [dealsForDivision, isHomeKitchen, primary]);

  const companyGridItems = useMemo(
    () => companies.filter((c): c is string => c !== 'All'),
    [companies],
  );

  const categoryGridItems = useMemo(() => {
    if (categoryTreeRoots.length > 0) {
      return categoryTreeRoots.map(n => {
        const collectIds = (node: typeof n): string[] => {
          const ids = [String(node.id)];
          (node.children ?? []).forEach((c: typeof n) => ids.push(...collectIds(c)));
          return ids;
        };
        const collectNames = (node: typeof n): string[] => {
          const names = [node.name];
          (node.children ?? []).forEach((c: typeof n) => names.push(...collectNames(c)));
          return names;
        };
        const collectSlugs = (node: typeof n): string[] => {
          const slugs = node.slug ? [String(node.slug)] : [];
          (node.children ?? []).forEach((c: typeof n) => slugs.push(...collectSlugs(c)));
          return slugs;
        };
        return {
          key: String(n.id),
          name: n.name,
          imageUrl: String(n.image_url ?? '').trim() || undefined,
          icon: n.icon ?? undefined,
          count:
            typeof n.product_count === 'number'
              ? n.product_count
              : categoryCountMap[n.name] ?? 0,
          categoryFilter: {
            ids: collectIds(n),
            names: collectNames(n),
            slugs: collectSlugs(n),
          },
        };
      });
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
        categoryFilter: undefined as { ids: string[]; names: string[]; slugs: string[] } | undefined,
      }));
  }, [categoryTreeRoots, categories, categoryCountMap]);

  const visibleProducts = filteredProducts.slice(0, 6);

  // Warm the image cache for everything visible on this screen so it appears
  // instantly instead of fetching lazily as the user scrolls.
  useEffect(() => {
    prefetchImages(heroDeals.map(d => d.image), heroCardWidth);
    prefetchImages(categoryGridItems.map(c => c.imageUrl), 90);
    prefetchImages(companyGridItems.map(c => companyLogoByName[c]), 90);
    prefetchImages(visibleProducts.map(p => p.image), 220);
  }, [heroDeals, categoryGridItems, companyGridItems, companyLogoByName, visibleProducts, heroCardWidth]);

  const onHeroMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / heroPageWidth);
    setHeroDealIndex(
      Math.max(0, Math.min(heroDeals.length - 1, idx)),
    );
  };

  React.useEffect(() => {
    Voice.onSpeechResults = e => {
      const value = e.value?.[0] ?? '';
      setQuery(value);
      setIsListening(false);
      if (value.trim()) {
        navigation.navigate('ProductOverview', {
          division: activeDivision,
          search: value.trim(),
        });
      }
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
  }, [appAlert, activeDivision, navigation]);

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
        Geolocation.getCurrentPosition(
          pos => resolve(pos),
          err => reject(err),
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

      if (!manualLocationSet.current) {
        setCurrentLocationText(resolvedText || fallbackLocationText);
      }
      setIsLocating(false);
    } catch {
      if (!manualLocationSet.current) {
        setCurrentLocationText(fallbackLocationText);
      }
      setIsLocating(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  React.useEffect(() => {
    const picked = route.params?.location;
    if (picked?.text) {
      manualLocationSet.current = true;
      setCurrentLocationText(picked.text);
    }
  }, [route.params?.location]);

  React.useEffect(() => {
    setHeroDealIndex(0);
  }, [activeDivision, heroDeals.length]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(tabBarHeight + 28, 100) },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

      {/* ─── Colored hero header: delivery location + quick actions ─── */}
      <View style={[styles.headerHero, { backgroundColor: primary }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.headerLocBtn}
            onPress={() => navigation.navigate('LocationPicker')}
            disabled={isLocating}
            activeOpacity={0.85}>
            <View style={styles.headerLocPin}>
              <Icon name="map-marker" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.headerLocTextWrap}>
              <Text style={styles.headerLocLabel}>Delivery to</Text>
              <View style={styles.headerLocCityRow}>
                <Text style={styles.headerLocCity} numberOfLines={1}>
                  {isLocating ? 'Locating…' : currentLocationText}
                </Text>
                <Icon name="chevron-down" size={18} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.headerIconBtn}
              activeOpacity={0.85}>
              <Icon name="bell-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.getParent?.()?.navigate('Cart')}
              style={styles.headerIconBtn}
              activeOpacity={0.85}>
              <Icon name="cart-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.getParent?.()?.navigate('Profile')}
              style={styles.headerIconBtn}
              activeOpacity={0.85}>
              <Icon name="account-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Elevated search bar overlapping the header's bottom edge */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={primary} />
        <TextInput
          style={[styles.search, { color: palette.ink }]}
          placeholder={
            isHomeKitchen
              ? 'Search kitchen & home essentials...'
              : 'Search groceries & daily needs...'
          }
          placeholderTextColor={palette.faint}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={() => {
            const q = query.trim();
            if (!q) return;
            navigation.navigate('ProductOverview', {
              division: activeDivision,
              search: q,
            });
          }}
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

      {/* Division segmented toggle */}
      <View
        style={[styles.divisionTrackOuter, { borderColor: primaryBorder }]}
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
                  color={isActive ? '#FFFFFF' : palette.muted}
                />
                <Text
                  style={[
                    styles.divisionTrackLabel,
                    { color: isActive ? '#FFFFFF' : palette.body },
                  ]}
                  numberOfLines={1}>
                  {item.segmentLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text style={styles.divisionTaglineCaption} numberOfLines={2}>
        {divisions.find(d => d.key === activeDivision)?.tagline}
      </Text>

      {/* Location unavailability banner */}
      {isLocationUnavailable && (
        <View style={styles.locationUnavailableBanner}>
          <Icon name="map-marker-off" size={20} color="#92400E" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationUnavailableTitle}>Products not available in your location</Text>
            <Text style={styles.locationUnavailableSubtitle}>
              We don't deliver to pincode {defaultPincode} yet. Update your delivery address to check availability.
            </Text>
          </View>
        </View>
      )}

      {/* KYC verification banner */}
      {isKycLoaded && !isKycVerified && (
        <View style={[
          styles.kycPendingBanner,
          kycStatus === 'rejected' && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
        ]}>
          <Icon
            name={kycStatus === 'rejected' ? 'shield-remove-outline' : 'shield-alert-outline'}
            size={20}
            color={kycStatus === 'rejected' ? '#991B1B' : '#92400E'}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.kycPendingTitle, kycStatus === 'rejected' && { color: '#991B1B' }]}>
              {kycStatus === 'pending' ? 'KYC Under Review' : kycStatus === 'rejected' ? 'KYC Rejected' : 'KYC Verification Pending'}
            </Text>
            <Text style={[styles.kycPendingSubtitle, kycStatus === 'rejected' && { color: '#B91C1C' }]}>
              {kycStatus === 'pending'
                ? 'Your documents are being reviewed. Shopping is enabled once verified.'
                : kycStatus === 'rejected'
                ? 'Your KYC was rejected. Please update and resubmit your documents.'
                : 'Complete KYC to unlock browsing and shopping.'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.getParent?.()?.navigate('Profile')}
            style={styles.kycPendingBtn}
            activeOpacity={0.85}>
            <Text style={[styles.kycPendingBtnText, kycStatus === 'rejected' && { color: '#991B1B' }]}>
              {kycStatus === 'rejected' ? 'Resubmit' : kycStatus === 'pending' ? 'View' : 'Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isScreenLoading ? (
        <View style={styles.screenLoaderWrap}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : null}

      {isKycLoaded && !isKycVerified ? (
        <View style={styles.kycWall}>
          <Icon name="shield-lock-outline" size={52} color="#CBD5E1" />
          <Text style={styles.kycWallTitle}>Catalog locked</Text>
          <Text style={styles.kycWallSubtitle}>
            Complete your KYC verification to browse products and place orders.
          </Text>
          <TouchableOpacity
            style={[styles.kycWallBtn, { backgroundColor: primary }]}
            onPress={() => navigation.getParent?.()?.navigate('Profile')}
            activeOpacity={0.88}>
            <Text style={styles.kycWallBtnText}>
              {kycStatus === 'pending' ? 'View KYC status' : kycStatus === 'rejected' ? 'Resubmit KYC' : 'Complete KYC'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() =>
                navigation.navigate('ProductOverview', { division: activeDivision })
              }
              style={[
                styles.heroSlideCard,
                { width: heroCardWidth },
                !item.image && { backgroundColor: item.color },
              ]}>
              {item.image ? (
                <AppImage
                  uri={item.image}
                  width={heroCardWidth}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  backgroundColor="transparent"
                />
              ) : null}
              <View style={styles.heroScrimSoft} pointerEvents="none" />
              <View style={styles.heroScrimStrong} pointerEvents="none" />
              {item.id !== 'placeholder-hero' ? (
                <View style={styles.heroBadge}>
                  <Icon name="sale" size={12} color="#FFFFFF" />
                  <Text style={styles.heroBadgeText}>OFFER</Text>
                </View>
              ) : null}
              <View style={styles.heroSlideTextBlock}>
                <Text style={styles.heroSlideTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.heroSlideSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
                {item.id !== 'placeholder-hero' ? (
                  <View style={styles.heroCta}>
                    <Text style={[styles.heroCtaText, { color: item.color }]}>
                      Shop now
                    </Text>
                    <Icon name="arrow-right" size={14} color={item.color} />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
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

      {isProductsError ? (
        <Text style={styles.stateErrorText}>
          Could not fetch latest products. Showing fallback catalog.
        </Text>
      ) : null}

      <View style={styles.paperSection}>
        <Text style={[styles.paperSectionTitle, { color: primaryText }]}>
          Quick links
        </Text>
        <View style={styles.quickGrid}>
          {(
            [
              {
                label: 'Top offers',
                icon: 'sale' as const,
                tint: '#F97316',
                onPress: () =>
                  navigation.navigate('ProductOverview', {
                    division: activeDivision,
                  }),
              },
              {
                label: 'Brands',
                icon: 'storefront-outline' as const,
                tint: '#2563EB',
                onPress: () =>
                  navigation.navigate('CategoryBrowse', {
                    division: activeDivision,
                    mode: 'brands',
                  }),
              },
              {
                label: 'Categories',
                icon: 'view-grid-outline' as const,
                tint: '#7C3AED',
                onPress: () =>
                  navigation.navigate('CategoryBrowse', {
                    division: activeDivision,
                  }),
              },
              {
                label: 'Orders',
                icon: 'truck-outline' as const,
                tint: '#0EA5E9',
                onPress: () => navigation.navigate('Orders'),
              },
              {
                label: 'Wishlist',
                icon: 'heart-outline' as const,
                tint: '#EC4899',
                onPress: () => navigation.navigate('Wishlist'),
              },
              {
                label: 'Browse all',
                icon: 'text-search' as const,
                tint: '#14B8A6',
                onPress: () =>
                  navigation.navigate('ProductOverview', {
                    division: activeDivision,
                  }),
              },
            ] as const
          ).map(cell => (
            <TouchableOpacity
              key={cell.label}
              style={[styles.quickCell, { width: gridCellWidth }]}
              onPress={cell.onPress}
              activeOpacity={0.9}>
              <View
                style={[
                  styles.quickCellIconWrap,
                  { backgroundColor: `${cell.tint}1A` },
                ]}>
                <Icon name={cell.icon} size={24} color={cell.tint} />
              </View>
              <Text
                style={[styles.quickCellLabel, { color: palette.ink }]}
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
        {companyGridItems.length === 0 ? (
          <Text style={styles.gridEmptyHint}>
            Companies appear when products are linked to sellers.
          </Text>
        ) : (
          <>
            {Array.from(
              { length: Math.min(2, Math.ceil(companyGridItems.length / 4)) },
              (_, row) => (
                <View
                  key={`co-row-${row}`}
                  style={[styles.gridRowFour, { gap: gridGap, marginBottom: gridGap }]}>
                  {companyGridItems.slice(row * 4, row * 4 + 4).map(c => {
                    const logo = companyLogoByName[c];
                    const count = companyCountMap[c] ?? 0;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.gridCellTall,
                          {
                            width: gridCellWidthFour,
                            borderColor: primaryBorder,
                            backgroundColor: '#FFFFFF',
                          },
                        ]}
                        onPress={() =>
                          navigation.navigate('ProductOverview', {
                            division: activeDivision,
                            company: c,
                          })
                        }
                        activeOpacity={0.92}>
                        <View
                          style={[
                            styles.gridCellLogoBox,
                            { borderColor: primaryBorder, height: 64 },
                          ]}>
                          {logo ? (
                            <Image
                              source={{ uri: logo }}
                              style={styles.gridCellLogoImg}
                              resizeMode="contain"
                            />
                          ) : (
                            <Icon name="domain" size={22} color={primary} />
                          )}
                        </View>
                        <Text
                          style={[styles.gridCellName, { color: primaryText }]}
                          numberOfLines={2}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ),
            )}
            {companyGridItems.length > 8 ? (
              <TouchableOpacity
                style={[styles.viewAllRow, { borderColor: primaryBorder }]}
                onPress={() =>
                  navigation.navigate('CategoryBrowse', {
                    division: activeDivision,
                    mode: 'companies',
                  })
                }
                activeOpacity={0.85}>
                <Text style={[styles.viewAllRowText, { color: primary }]}>
                  View all {companyGridItems.length} companies
                </Text>
                <Icon name="chevron-right" size={16} color={primary} />
              </TouchableOpacity>
            ) : null}
          </>
        )}
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
          <>
            {Array.from(
              { length: Math.min(2, Math.ceil(categoryGridItems.length / 4)) },
              (_, row) => (
                <View
                  key={`cat-row-${row}`}
                  style={[styles.gridRowFour, { gap: gridGap, marginBottom: gridGap }]}>
                  {categoryGridItems.slice(row * 4, row * 4 + 4).map(cat => {
                    const active = activeCategory === cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.gridCellTall,
                          {
                            width: gridCellWidthFour,
                            borderColor: active ? primary : primaryBorder,
                            backgroundColor: '#FFFFFF',
                          },
                        ]}
                        onPress={() => {
                          setActiveCategory(cat.name);
                          navigation.navigate('CategoryBrowse', {
                            division: activeDivision,
                            parentNodeId: cat.key,
                          });
                        }}
                        activeOpacity={0.92}>
                        <View
                          style={[
                            styles.gridCellLogoBox,
                            { borderColor: primaryBorder, height: 64 },
                          ]}>
                          {cat.imageUrl ? (
                            <AppImage
                              uri={cat.imageUrl}
                              width={90}
                              style={styles.gridCellPhoto}
                              resizeMode="cover"
                            />
                          ) : cat.icon ? (
                            <Text style={styles.gridCellEmoji}>{cat.icon}</Text>
                          ) : (
                            <Icon
                              name="view-grid-plus-outline"
                              size={22}
                              color={primary}
                            />
                          )}
                        </View>
                        <Text
                          style={[styles.gridCellName, { color: primaryText }]}
                          numberOfLines={2}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ),
            )}
            {categoryGridItems.length > 8 ? (
              <TouchableOpacity
                style={[styles.viewAllRow, { borderColor: primaryBorder }]}
                onPress={() =>
                  navigation.navigate('CategoryBrowse', { division: activeDivision })
                }
                activeOpacity={0.85}>
                <Text style={[styles.viewAllRowText, { color: primary }]}>
                  View all {categoryGridItems.length} categories
                </Text>
                <Icon name="chevron-right" size={16} color={primary} />
              </TouchableOpacity>
            ) : null}
          </>
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
        style={styles.productsGrid}
        columnWrapperStyle={styles.productsGridRow}
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
        ListEmptyComponent={
          <Text style={styles.gridEmptyHint}>
            No recommendations yet — explore categories above.
          </Text>
        }
      />
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1 },
  content: { paddingHorizontal: 14 },
  headerHero: {
    marginHorizontal: -14,
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    ...shadow.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  headerLocPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerLocTextWrap: { flex: 1, minWidth: 0 },
  headerLocLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerLocCityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerLocCity: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  divisionSectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divisionTrackOuter: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    padding: DIVISION_TRACK_PAD,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: palette.lineSoft,
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
    color: palette.muted,
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
    ...shadow.xs,
  },
  locationPillTextWrap: { flex: 1, minWidth: 0 },
  locationPillTitle: { fontSize: 13, fontWeight: '800' },
  locationPillSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  searchWrap: {
    marginTop: -24,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.md,
  },
  search: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 13,
    fontSize: 14,
    fontWeight: '600',
  },
  micBtn: { paddingLeft: 8, paddingVertical: 8 },
  paperSectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '900',
  },
  heroCarouselList: { marginTop: 4, marginHorizontal: -14 },
  screenLoaderWrap: { alignItems: 'center', paddingVertical: 32 },
  heroSlideCard: {
    position: 'relative',
    height: 182,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroScrimSoft: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroScrimStrong: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.6,
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
  heroCta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroCtaText: { fontWeight: '900', fontSize: 12 },
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
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: palette.surface,
    ...shadow.sm,
  },
  quickCellIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 999,
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
  gridRowFour: { flexDirection: 'row', justifyContent: 'flex-start' },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    gap: 4,
  },
  viewAllRowText: { fontSize: 13, fontWeight: '700' },
  gridCellTall: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...shadow.xs,
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
  locationUnavailableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 12,
  },
  locationUnavailableTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  locationUnavailableSubtitle: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  productsGrid: { marginHorizontal: 4 },
  productsGridRow: { justifyContent: 'space-between' },

  // KYC pending banner
  kycPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    gap: 4,
  },
  kycPendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  kycPendingSubtitle: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
    flexShrink: 1,
  },
  kycPendingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FDE68A',
    marginLeft: 8,
  },
  kycPendingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },

  // KYC catalog gate
  kycWall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
    gap: 12,
  },
  kycWallTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  kycWallSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  kycWallBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  kycWallBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

export default HomeScreen;
