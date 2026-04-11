import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGetProductQuery, useGetProductsQuery } from '../../products/api/productsApi';
import { useCart } from '../../../hooks/useCart';
import { useAppDispatch } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
  VOICE_NOT_AVAILABLE_MESSAGE,
} from '../../../utils/voice';
import { PriceOptionKey, Product } from '../../../types';
import { defaultPriceTier, selectedPriceOption } from '../../../utils/productPricing';
import { useWishlist } from '../../../hooks/useWishlist';
import {
  orderQuantityPlural,
  packagingDetailLine,
  packagingShortLine,
  quantityStepperTitle,
} from '../../../utils/productPackaging';
import { formatRs } from '../../../utils/formatMoney';

type DivisionKey = 'fmcg' | 'homeKitchen';
const MAX_SETS_PER_ADD = 5;

function mergeProductFromApi(
  list: Product | undefined,
  api: Product | undefined,
): Product | undefined {
  if (!list && !api) return undefined;
  if (!api) return list;
  if (!list) return api;
  const images = api.images && api.images.length > 0 ? api.images : list.images;
  const image =
    (api.image && String(api.image).trim()) ||
    list.image ||
    (images && images[0]) ||
    '';
  return {
    ...list,
    ...api,
    images: images && images.length > 0 ? images : list.images,
    image,
  };
}

function humanizeSpecKey(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/\b\w/g, s => s.toUpperCase());
}

function formatSpecValue(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function isProductPurchasable(p: Product): boolean {
  if (p.isAvailable === false) return false;
  if (p.stockQuantity !== undefined && p.stockQuantity <= 0) return false;
  return true;
}

const getProductImages = (product: Product): string[] => {
  const fromGallery = Array.isArray(product.images)
    ? product.images.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const primary = String(product.image || '').trim();
  if (primary) return [primary, ...fromGallery.filter((u) => u !== primary)];
  return fromGallery;
};

const ProductDetailCard = ({
  item,
  onAdd,
  onToggleWishlist,
  isWishlisted,
  accentColor,
  textColor,
}: {
  item: Product;
  onAdd: (product: Product, tier: PriceOptionKey) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
  accentColor: string;
  textColor: string;
}) => {
  const [tierKey, setTierKey] = React.useState<PriceOptionKey>(() =>
    defaultPriceTier(item),
  );
  React.useEffect(() => {
    setTierKey(defaultPriceTier(item));
  }, [item.id]);

  const active = selectedPriceOption(item, tierKey);
  const sellRaw = active?.sellingPrice ?? item.price;
  const discPct = active?.discount ?? item.discountPercent;
  const strikeMrpRaw =
    active?.mrp ?? Math.round(sellRaw / Math.max(1 - discPct / 100, 0.01));
  const sell = Math.round(sellRaw * 100) / 100;
  const strikeMrp = Math.round(strikeMrpRaw * 100) / 100;
  const savings = Math.max(0, Math.round((strikeMrp - sell) * 100) / 100);
  const showTierPicker = (item.priceOptions?.length ?? 0) > 1;
  const packLine = packagingShortLine(item);

  return (
    <View style={styles.productCard}>
      <View style={styles.browseCardRow}>
        <View style={styles.browseThumbWrap}>
          <Image
            source={{ uri: getProductImages(item)[0] || item.image }}
            style={styles.browseThumbImage}
          />
          <View style={[styles.discountBadge, styles.browseDiscountBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.discountBadgeText}>{Math.round(discPct)}% OFF</Text>
          </View>
        </View>

        <View style={styles.browseMain}>
          <View style={styles.productTopRow}>
            <View style={styles.productMeta}>
              <Text
                numberOfLines={2}
                style={[styles.browseProductName, { color: textColor }]}>
                {item.name}
              </Text>
              <Text style={styles.metaMuted} numberOfLines={1}>
                {item.brand ?? 'No brand'} • {item.subCategory ?? 'General'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.wishlistBtn,
                { backgroundColor: isWishlisted ? accentColor : `${accentColor}26` },
              ]}
              onPress={() => onToggleWishlist(item.id)}
              activeOpacity={0.9}>
              <Icon
                name={isWishlisted ? 'heart' : 'heart-outline'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.tagRow}>
            <View style={[styles.tagPill, { borderColor: `${accentColor}66` }]}>
              <Icon name="shape-outline" size={12} color={accentColor} />
              <Text style={[styles.tagText, { color: accentColor }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            {item.isVeg !== undefined ? (
              <View style={[styles.tagPill, { borderColor: `${accentColor}66` }]}>
                <Icon
                  name={item.isVeg ? 'leaf' : 'food-drumstick-outline'}
                  size={12}
                  color={accentColor}
                />
                <Text style={[styles.tagText, { color: accentColor }]}>
                  {item.isVeg ? 'Veg' : 'Non-veg'}
                </Text>
              </View>
            ) : null}
            {item.etaMinutes !== undefined ? (
              <View style={[styles.tagPill, { borderColor: `${accentColor}66` }]}>
                <Icon name="clock-outline" size={12} color={accentColor} />
                <Text style={[styles.tagText, { color: accentColor }]}>
                  {item.etaMinutes} min
                </Text>
              </View>
            ) : null}
          </View>

          {showTierPicker ? (
            <View style={styles.tierChipRowBrowse}>
              {item.priceOptions!.map(opt => {
                const selected = opt.key === tierKey;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.tierChipBrowse,
                      {
                        borderColor: selected ? accentColor : '#E2E8F0',
                        backgroundColor: selected ? `${accentColor}18` : '#F8FAFC',
                      },
                    ]}
                    onPress={() => setTierKey(opt.key)}
                    activeOpacity={0.9}>
                    <Text
                      style={[
                        styles.tierChipTextBrowse,
                        { color: selected ? accentColor : '#64748B' },
                      ]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.tierChipPriceBrowse, { color: textColor }]}>
                      Rs {formatRs(opt.sellingPrice)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={styles.browsePriceActions}>
            <View style={styles.priceMeta}>
              <Text style={[styles.browseSellPrice, { color: textColor }]}>
                Rs {formatRs(sell)}
              </Text>
              {strikeMrp > sell ? (
                <Text style={styles.strikePrice}>MRP {formatRs(strikeMrp)}</Text>
              ) : null}
              {savings > 0 ? (
                <Text style={[styles.discountText, { color: accentColor }]} numberOfLines={1}>
                  Save Rs {formatRs(savings)}
                </Text>
              ) : null}
              {packLine ? (
                <Text style={styles.packagingShort} numberOfLines={1}>
                  {packLine}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.addBtnCompact, { backgroundColor: accentColor }]}
              onPress={() => onAdd(item, tierKey)}
              activeOpacity={0.9}>
              <Icon name="cart-plus" size={15} color="#FFFFFF" />
              <Text style={styles.addBtnCompactText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const ProductOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const division: DivisionKey = route.params?.division ?? 'fmcg';
  const selectedProductId: string | undefined = route.params?.productId;
  const subCategoryFilter: string | undefined = route.params?.subCategory;
  const brandFilter: string | undefined = route.params?.brand;
  const categoryFilter: { ids?: string[]; names?: string[] } | undefined =
    route.params?.categoryFilter;
  const categoryFilterKey = categoryFilter
    ? `${(categoryFilter.ids ?? []).join(',')}|${(categoryFilter.names ?? []).join(',')}`
    : '';

  const { width: windowWidth } = useWindowDimensions();
  const { data: allProducts = [] } = useGetProductsQuery();
  const { add } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const dispatch = useAppDispatch();

  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedSets, setSelectedSets] = useState(1);
  const [detailTierKey, setDetailTierKey] = useState<PriceOptionKey>('unit');
  const [selectedDetailImageIndex, setSelectedDetailImageIndex] = useState(0);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const galleryRef = useRef<FlatList<string>>(null);
  const [uiAlert, setUiAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHomeKitchen = division === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primaryBorder = isHomeKitchen
    ? 'rgba(22,163,74,0.25)'
    : 'rgba(29,78,216,0.25)';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';
  const accentSecondary = isHomeKitchen ? '#22C55E' : '#2563EB';

  React.useEffect(() => {
    dispatch(setHomeDivision(division));
  }, [dispatch, division]);

  React.useEffect(() => {
    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  const showUiAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setUiAlert({ visible: true, title, message, type });
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    alertTimerRef.current = setTimeout(() => {
      setUiAlert(prev => ({ ...prev, visible: false }));
    }, 2600);
  };

  React.useEffect(() => {
    Voice.onSpeechResults = e => {
      const value = e.value?.[0] ?? '';
      setQuery(value);
      setIsListening(false);
    };

    Voice.onSpeechError = e => {
      setIsListening(false);
      showUiAlert(
        'Voice Search',
        e.error?.message ?? 'Could not recognize speech',
        'error',
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

  const divisionProducts = useMemo(() => {
    return isHomeKitchen
      ? allProducts.filter(p => p.category === 'home' || p.category === 'kitchen')
      : allProducts.filter(p => p.category === 'fmcg');
  }, [allProducts, isHomeKitchen]);

  const products = useMemo(() => {
    let list = divisionProducts;
    const cfIds = categoryFilter?.ids?.filter(Boolean) ?? [];
    const cfNames = categoryFilter?.names?.filter(Boolean) ?? [];
    if (cfIds.length > 0 || cfNames.length > 0) {
      const idSet = new Set(cfIds);
      const nameSet = new Set(cfNames);
      list = list.filter(
        p =>
          (p.shopCategoryId != null && idSet.has(p.shopCategoryId)) ||
          (p.subCategory != null && nameSet.has(p.subCategory)),
      );
    } else if (subCategoryFilter) {
      list = list.filter(p => p.subCategory === subCategoryFilter);
    }
    if (brandFilter) {
      list = list.filter(p => p.brand === brandFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p => p.name.toLowerCase().includes(q));
  }, [divisionProducts, subCategoryFilter, brandFilter, query, categoryFilterKey]);

  const listProduct = useMemo(
    () =>
      selectedProductId
        ? allProducts.find(p => p.id === selectedProductId)
        : undefined,
    [allProducts, selectedProductId],
  );

  const {
    data: fetchedProduct,
    isFetching: isProductFetching,
    isError: isProductError,
  } = useGetProductQuery(selectedProductId ?? '', {
    skip: !selectedProductId,
  });

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return undefined;
    if (fetchedProduct) {
      return mergeProductFromApi(listProduct, fetchedProduct) ?? fetchedProduct;
    }
    return listProduct;
  }, [selectedProductId, listProduct, fetchedProduct]);

  const showDetailSpinner = Boolean(
    selectedProductId && !selectedProduct && isProductFetching,
  );
  const showDetailError = Boolean(
    selectedProductId && !selectedProduct && !isProductFetching && isProductError,
  );

  const selectedPackagingDetail = useMemo(
    () => (selectedProduct ? packagingDetailLine(selectedProduct) : null),
    [selectedProduct],
  );
  const isDetailMode = Boolean(selectedProductId);

  React.useEffect(() => {
    setSelectedSets(1);
  }, [selectedProductId]);

  React.useEffect(() => {
    if (selectedProduct) {
      setDetailTierKey(defaultPriceTier(selectedProduct));
      setSelectedDetailImageIndex(0);
    }
  }, [selectedProduct?.id]);

  const detailPrice = useMemo(() => {
    if (!selectedProduct) {
      return { sell: 0, disc: 0, mrp: 0, savings: 0 };
    }
    const active = selectedPriceOption(selectedProduct, detailTierKey);
    const sellRaw = active?.sellingPrice ?? selectedProduct.price;
    const disc = active?.discount ?? selectedProduct.discountPercent;
    const mrpRaw =
      active?.mrp ?? Math.round(sellRaw / Math.max(1 - disc / 100, 0.01));
    const sell = Math.round(sellRaw * 100) / 100;
    const mrp = Math.round(mrpRaw * 100) / 100;
    const savings = Math.max(0, Math.round((mrp - sell) * 100) / 100);
    return { sell, disc, mrp, savings };
  }, [selectedProduct, detailTierKey]);
  const detailImages = useMemo(
    () => (selectedProduct ? getProductImages(selectedProduct) : []),
    [selectedProduct],
  );
  const specEntries = useMemo(
    () =>
      selectedProduct?.specifications
        ? Object.entries(selectedProduct.specifications)
        : [],
    [selectedProduct],
  );

  const canPurchase = selectedProduct ? isProductPurchasable(selectedProduct) : false;

  const stockHint = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedProduct.isAvailable === false) {
      return { text: 'Currently unavailable', tone: 'bad' as const };
    }
    const q = selectedProduct.stockQuantity;
    if (q !== undefined && q <= 0) {
      return { text: 'Out of stock', tone: 'bad' as const };
    }
    if (q !== undefined && q <= 10) {
      return { text: `Only ${q} left in stock`, tone: 'warn' as const };
    }
    return { text: 'In stock', tone: 'ok' as const };
  }, [selectedProduct]);

  const carouselWidth = windowWidth;
  const carouselHeight = Math.min(Math.round(windowWidth * 0.95), 420);

  const onGalleryMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carouselWidth <= 0 || detailImages.length === 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.min(
      detailImages.length - 1,
      Math.max(0, Math.round(x / carouselWidth)),
    );
    setSelectedDetailImageIndex(idx);
  };

  React.useEffect(() => {
    if (selectedDetailImageIndex >= detailImages.length && detailImages.length > 0) {
      setSelectedDetailImageIndex(0);
    }
  }, [detailImages.length, selectedDetailImageIndex]);

  const addSelectedProductToCart = (item: Product) => {
    add(item, selectedSets, detailTierKey);
    showUiAlert(
      'Added to cart',
      `${selectedSets} ${orderQuantityPlural(item.unit)} of ${item.name} added.`,
      'success',
    );
  };

  const buyNow = (item: Product) => {
    addSelectedProductToCart(item);
    navigation.navigate('Cart');
  };

  const productDescription = (item: Product) => {
    const eta = item.etaMinutes !== undefined ? `Delivery in ${item.etaMinutes} min.` : 'Delivery details available at checkout.';
    const vegText =
      item.isVeg !== undefined
        ? item.isVeg
          ? 'Veg item.'
          : 'Non-veg item.'
        : 'Item type varies.';

    return `${item.name} by ${item.brand ?? 'our trusted brand'} in ${
      item.subCategory ?? 'General'
    } category. ${eta} ${vegText}`;
  };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.gradientLeft,
          { backgroundColor: primary, opacity: 0.22 },
        ]}
      />
      <View
        style={[
          styles.gradientRight,
          { backgroundColor: accentSecondary, opacity: 0.18 },
        ]}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isDetailMode ? styles.detailContent : styles.browseContent,
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        bounces>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
            }
            style={styles.backBtn}
            activeOpacity={0.9}>
            <Icon name="chevron-left" size={20} color={primary} />
          </TouchableOpacity>

          <View style={styles.topBarText}>
            <Text style={[styles.title, { color: primary }]}>
              {isHomeKitchen ? 'Home & Kitchen' : 'FMCG'}
            </Text>
            <Text style={[styles.subtitle, { color: primaryText }]}>
              {isDetailMode
                ? 'Product details'
                : subCategoryFilter
                  ? `Category: ${subCategoryFilter}`
                  : brandFilter
                    ? `Brand: ${brandFilter}`
                    : 'Browse products curated for you'}
            </Text>
          </View>
        </View>

        {!isDetailMode ? (
          <>
            <View
              style={[
                styles.searchWrap,
                { borderColor: primaryBorder, backgroundColor: 'rgba(255,255,255,0.65)' },
              ]}>
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
                      showUiAlert('Voice Search', VOICE_NOT_AVAILABLE_MESSAGE, 'error');
                      return;
                    }

                    if (Platform.OS === 'android') {
                      const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                      );
                      if (
                        granted !== PermissionsAndroid.RESULTS.GRANTED
                      ) {
                        showUiAlert(
                          'Microphone permission',
                          'Please allow microphone access to use voice search.',
                          'error',
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
                    showUiAlert(
                      'Voice Search',
                      err?.message ?? 'Could not start voice search',
                      'error',
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
          </>
        ) : null}

        {isDetailMode ? (
          showDetailSpinner ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.detailLoadingText, { color: primaryText }]}>
                Loading product…
              </Text>
            </View>
          ) : showDetailError ? (
            <View style={styles.detailErrorBox}>
              <Icon name="alert-circle-outline" size={40} color="#DC2626" />
              <Text style={[styles.detailErrorTitle, { color: primaryText }]}>
                {"Couldn't load this product"}
              </Text>
              <Text style={styles.detailErrorSub}>
                Check your connection and try opening it again from the list.
              </Text>
            </View>
          ) : selectedProduct ? (
            <View style={styles.detailWrap}>
              <View
                style={[
                  styles.detailGalleryBleed,
                  { width: carouselWidth, marginHorizontal: -14 },
                ]}>
                {detailImages.length > 0 ? (
                  <FlatList
                    ref={galleryRef}
                    data={detailImages}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(uri, idx) => `${uri}-${idx}`}
                    onMomentumScrollEnd={onGalleryMomentumEnd}
                    getItemLayout={(_, index) => ({
                      length: carouselWidth,
                      offset: carouselWidth * index,
                      index,
                    })}
                    renderItem={({ item: uri }) => (
                      <Pressable
                        onPress={() => setZoomImageUri(uri)}
                        style={[styles.detailCarouselPage, { width: carouselWidth, height: carouselHeight }]}>
                        <Image
                          source={{ uri }}
                          style={styles.detailCarouselImage}
                          resizeMode="contain"
                        />
                      </Pressable>
                    )}
                  />
                ) : (
                  <View
                    style={[
                      styles.detailCarouselPlaceholder,
                      { width: carouselWidth, height: carouselHeight * 0.6 },
                    ]}>
                    <Icon name="image-off-outline" size={48} color="#94A3B8" />
                    <Text style={styles.detailCarouselPlaceholderText}>No image</Text>
                  </View>
                )}
                {detailPrice.disc > 0 ? (
                  <View style={[styles.detailDiscountPill, { backgroundColor: primary }]}>
                    <Text style={styles.detailDiscountPillText}>
                      {Math.round(detailPrice.disc)}% OFF
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.detailWishlistBtn,
                    {
                      backgroundColor: isWishlisted(selectedProduct.id)
                        ? '#EF4444'
                        : 'rgba(255,255,255,0.92)',
                    },
                  ]}
                  onPress={() => toggle(selectedProduct.id)}
                  activeOpacity={0.9}>
                  <Icon
                    name={isWishlisted(selectedProduct.id) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isWishlisted(selectedProduct.id) ? '#FFFFFF' : '#EF4444'}
                  />
                </TouchableOpacity>
                {detailImages.length > 1 ? (
                  <View style={styles.detailDotsRow}>
                    {detailImages.map((_, idx) => (
                      <View
                        key={`dot-${idx}`}
                        style={[
                          styles.detailDot,
                          idx === selectedDetailImageIndex && [
                            styles.detailDotActive,
                            { backgroundColor: primary },
                          ],
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {detailImages.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.detailThumbRow}>
                  {detailImages.map((img, idx) => (
                    <TouchableOpacity
                      key={`${img}-${idx}`}
                      style={[
                        styles.detailThumbWrap,
                        idx === selectedDetailImageIndex && styles.detailThumbWrapActive,
                        idx === selectedDetailImageIndex && { borderColor: primary },
                      ]}
                      onPress={() => {
                        setSelectedDetailImageIndex(idx);
                        requestAnimationFrame(() => {
                          try {
                            galleryRef.current?.scrollToIndex({
                              index: idx,
                              animated: true,
                            });
                          } catch {
                            galleryRef.current?.scrollToOffset({
                              offset: carouselWidth * idx,
                              animated: true,
                            });
                          }
                        });
                      }}
                      activeOpacity={0.9}>
                      <Image source={{ uri: img }} style={styles.detailThumbImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.detailInfoSection}>
                <View style={styles.detailHero}>
                  <Text style={styles.detailBreadcrumb} numberOfLines={2}>
                    {(selectedProduct.categoryLabel || selectedProduct.subCategory || 'Shop').trim()}
                    {' · '}
                    {(selectedProduct.brand ?? 'Brand').trim()}
                  </Text>
                  <Text style={[styles.detailName, { color: primaryText }]}>
                    {selectedProduct.name}
                  </Text>
                  {selectedProduct.slug ? (
                    <Text style={styles.detailSkuMuted} numberOfLines={1}>
                      SKU · {selectedProduct.slug}
                    </Text>
                  ) : null}

                  <View style={styles.detailPriceRow}>
                    <View style={styles.detailPriceLeft}>
                      <Text style={[styles.detailSellPrice, { color: primaryText }]}>
                        Rs {formatRs(detailPrice.sell)}
                      </Text>
                      {detailPrice.disc > 0 ? (
                        <Text style={[styles.detailDiscTag, { color: primary }]}>
                          {Math.round(detailPrice.disc)}% off
                        </Text>
                      ) : null}
                    </View>
                    {(detailPrice.mrp > detailPrice.sell || detailPrice.savings > 0) && (
                      <View style={styles.detailPriceRight}>
                        {detailPrice.mrp > detailPrice.sell ? (
                          <Text style={styles.detailMrpLine}>
                            MRP Rs {formatRs(detailPrice.mrp)}
                          </Text>
                        ) : null}
                        {detailPrice.savings > 0 ? (
                          <Text style={[styles.detailSaveInline, { color: primary }]}>
                            You save Rs {formatRs(detailPrice.savings)}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {stockHint ? (
                    <View style={styles.detailStockInline}>
                      <View
                        style={[
                          styles.detailStockDot,
                          stockHint.tone === 'bad' && styles.detailStockDotBad,
                          stockHint.tone === 'warn' && styles.detailStockDotWarn,
                          stockHint.tone !== 'bad' &&
                            stockHint.tone !== 'warn' &&
                            styles.detailStockDotOk,
                        ]}
                      />
                      <Text
                        style={[
                          styles.detailStockInlineText,
                          stockHint.tone === 'bad' && styles.detailStockInlineTextBad,
                          stockHint.tone === 'warn' && styles.detailStockInlineTextWarn,
                          stockHint.tone !== 'bad' &&
                            stockHint.tone !== 'warn' &&
                            styles.detailStockInlineTextOk,
                        ]}>
                        {stockHint.text}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.detailMetaList}>
                    {(
                      [
                        {
                          key: 'rating',
                          icon: 'star-outline',
                          text: (() => {
                            const rc = selectedProduct.reviewCount;
                            const r = selectedProduct.rating;
                            if (rc != null && rc > 0 && r != null) {
                              return `${Number(r).toFixed(1)} · ${rc} reviews`;
                            }
                            if (r != null) {
                              return `${Number(r).toFixed(1)} rating`;
                            }
                            return 'New on Dely';
                          })(),
                        },
                        ...(selectedProduct.etaMinutes !== undefined
                          ? [
                              {
                                key: 'eta',
                                icon: 'truck-delivery-outline',
                                text: `Delivery in about ${selectedProduct.etaMinutes} min`,
                              },
                            ]
                          : []),
                        ...(selectedProduct.isVeg !== undefined
                          ? [
                              {
                                key: 'veg',
                                icon: selectedProduct.isVeg
                                  ? 'leaf'
                                  : 'food-drumstick-outline',
                                text: selectedProduct.isVeg
                                  ? 'Vegetarian'
                                  : 'Non-vegetarian',
                              },
                            ]
                          : []),
                        ...(selectedProduct.companyName
                          ? [
                              {
                                key: 'seller',
                                icon: 'storefront-outline',
                                text: `Sold by ${selectedProduct.companyName}`,
                              },
                            ]
                          : []),
                      ] as {
                        key: string;
                        icon: string;
                        text: string;
                      }[]
                    ).map((row, index, arr) => (
                      <View
                        key={row.key}
                        style={[
                          styles.detailMetaRow,
                          index < arr.length - 1 && styles.detailMetaRowDivider,
                        ]}>
                        <Icon name={row.icon} size={18} color="#64748B" />
                        <Text style={[styles.detailMetaRowText, { color: primaryText }]}>
                          {row.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.detailSectionRule} />

                <View style={styles.detailBodyStack}>
                  {(selectedProduct.priceOptions?.length ?? 0) > 1 ? (
                    <View style={styles.detailSubsection}>
                      <Text style={[styles.detailSectionHeading, { color: primaryText }]}>
                        Pack size
                      </Text>
                      <Text style={styles.detailSectionSub}>Choose one — price updates above</Text>
                      <View style={styles.detailTierRow}>
                        {selectedProduct.priceOptions!.map(opt => {
                          const selected = opt.key === detailTierKey;
                          return (
                            <TouchableOpacity
                              key={opt.key}
                              style={[
                                styles.detailTierChip,
                                {
                                  borderColor: selected ? primary : '#CBD5E1',
                                  backgroundColor: selected ? `${primary}14` : 'transparent',
                                },
                              ]}
                              onPress={() => setDetailTierKey(opt.key)}
                              activeOpacity={0.9}>
                              <Text
                                style={[
                                  styles.detailTierChipLabel,
                                  { color: selected ? primary : '#64748B' },
                                ]}>
                                {opt.label}
                              </Text>
                              <Text style={[styles.detailTierChipPrice, { color: primaryText }]}>
                                Rs {formatRs(opt.sellingPrice)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {selectedPackagingDetail ? (
                    <Text style={[styles.detailPackaging, { color: primary }]}>
                      {selectedPackagingDetail}
                    </Text>
                  ) : null}

                  <View style={styles.detailSubsection}>
                    <Text style={[styles.detailSectionHeading, { color: primaryText }]}>
                      About this item
                    </Text>
                    <Text style={styles.description}>
                      {selectedProduct.description?.trim()
                        ? selectedProduct.description.trim()
                        : productDescription(selectedProduct)}
                    </Text>
                  </View>

                  {specEntries.length > 0 ? (
                    <View style={styles.detailSubsection}>
                      <Text style={[styles.detailSectionHeading, { color: primaryText }]}>
                        Specifications
                      </Text>
                      <View style={styles.specTable}>
                        {specEntries.map(([key, val]) => (
                          <View key={key} style={styles.specRow}>
                            <Text style={styles.specKey}>{humanizeSpecKey(key)}</Text>
                            <Text style={styles.specVal}>{formatSpecValue(val)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.qtyBlock,
                      !canPurchase && styles.qtyBlockDisabled,
                    ]}>
                    <View style={styles.qtyBlockHeader}>
                      <View style={styles.qtyBlockTitles}>
                        <Text style={[styles.qtyTitle, { color: primaryText }]}>
                          {quantityStepperTitle(selectedProduct.unit)}
                        </Text>
                        <Text style={styles.detailMinOrderText}>
                          Min. order {selectedProduct.minOrderQuantity ?? 1}{' '}
                          {orderQuantityPlural(selectedProduct.unit)}
                        </Text>
                      </View>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          disabled={!canPurchase}
                          onPress={() => setSelectedSets(prev => Math.max(1, prev - 1))}
                          activeOpacity={0.9}>
                          <Icon name="minus" size={18} color={primaryText} />
                        </TouchableOpacity>
                        <Text style={[styles.qtyValue, { color: primaryText }]}>{selectedSets}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          disabled={!canPurchase}
                          onPress={() =>
                            setSelectedSets(prev => Math.min(MAX_SETS_PER_ADD, prev + 1))
                          }
                          activeOpacity={0.9}>
                          <Icon name="plus" size={18} color={primaryText} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.maxInfo, { color: primary }]}>
                      Up to {MAX_SETS_PER_ADD} {orderQuantityPlural(selectedProduct.unit)} per add.
                    </Text>
                  </View>

                  <View style={styles.assuranceRow}>
                    <Icon name="shield-check-outline" size={17} color={primary} />
                    <Text style={styles.assuranceText}>
                      Genuine products · Quality checked · Easy returns if something goes wrong
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: primaryText }]}>
                {subCategoryFilter
                  ? subCategoryFilter
                  : brandFilter
                    ? brandFilter
                    : isHomeKitchen
                      ? 'Kitchen & Home Picks'
                      : 'FMCG Bestsellers'}
              </Text>
            </View>

            {products.map(item => (
              <View key={item.id} style={styles.browseCardWrap}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() =>
                    navigation.navigate('ProductOverview', {
                      division,
                      productId: item.id,
                      subCategory: subCategoryFilter,
                      brand: brandFilter,
                      categoryFilter,
                    })
                  }>
                  <ProductDetailCard
                    item={item}
                    onAdd={(p, tier) => add(p, 1, tier)}
                    onToggleWishlist={toggle}
                    isWishlisted={isWishlisted(item.id)}
                    accentColor={primary}
                    textColor={primaryText}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {selectedProduct && isDetailMode ? (
        <View
          style={[styles.detailFooterBar, !canPurchase && styles.detailFooterDisabled]}>
          <TouchableOpacity
            style={[
              styles.detailAddBtn,
              { borderColor: primary },
              !canPurchase && styles.detailFooterBtnDisabled,
            ]}
            disabled={!canPurchase}
            onPress={() => addSelectedProductToCart(selectedProduct)}
            activeOpacity={0.9}>
            <Icon name="cart-plus" size={17} color={canPurchase ? primary : '#94A3B8'} />
            <Text
              style={[
                styles.detailAddText,
                { color: canPurchase ? primary : '#94A3B8' },
              ]}>
              Add to Cart
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.buyNowBtn,
              { backgroundColor: canPurchase ? primary : '#CBD5E1' },
            ]}
            disabled={!canPurchase}
            onPress={() => buyNow(selectedProduct)}
            activeOpacity={0.9}>
            <Icon name="flash" size={17} color="#FFFFFF" />
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={Boolean(zoomImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomImageUri(null)}>
          {zoomImageUri ? (
            <Image
              source={{ uri: zoomImageUri }}
              style={styles.zoomImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.zoomHint}>
            <Text style={styles.zoomHintText}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>

      {uiAlert.visible ? (
        <View
          style={[
            styles.uiAlert,
            uiAlert.type === 'success'
              ? styles.uiAlertSuccess
              : uiAlert.type === 'error'
                ? styles.uiAlertError
                : styles.uiAlertInfo,
          ]}>
          <Icon
            name={
              uiAlert.type === 'success'
                ? 'check-circle-outline'
                : uiAlert.type === 'error'
                  ? 'alert-circle-outline'
                  : 'information-outline'
            }
            size={18}
            color="#FFFFFF"
          />
          <View style={styles.uiAlertTextWrap}>
            <Text style={styles.uiAlertTitle}>{uiAlert.title}</Text>
            <Text style={styles.uiAlertMessage}>{uiAlert.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
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
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 14, flexGrow: 1 },
  browseContent: { paddingBottom: 34 },
  detailContent: { paddingBottom: 120 },
  topBar: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  topBarText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 2, fontWeight: '600' },
  searchWrap: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  search: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  micBtn: { paddingLeft: 8, paddingVertical: 8 },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  itemSeparator: { height: 10 },
  browseCardWrap: { marginBottom: 10 },
  detailLoading: {
    marginTop: 40,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLoadingText: { marginTop: 12, fontWeight: '700', fontSize: 14 },
  detailErrorBox: {
    marginTop: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  detailErrorTitle: { marginTop: 12, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  detailErrorSub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  detailWrap: {
    marginTop: 4,
  },
  detailGalleryBleed: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  detailCarouselPage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  detailCarouselImage: {
    width: '100%',
    height: '100%',
  },
  detailCarouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  detailCarouselPlaceholderText: {
    marginTop: 8,
    fontWeight: '700',
    color: '#64748B',
    fontSize: 13,
  },
  detailDiscountPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailDiscountPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  detailWishlistBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.12)',
  },
  detailDotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  detailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  detailDotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  detailThumbRow: {
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  detailThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  detailThumbWrapActive: {
    borderWidth: 2,
  },
  detailThumbImage: {
    width: '100%',
    height: '100%',
  },
  detailInfoSection: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  detailHero: {
    paddingBottom: 0,
  },
  detailBreadcrumb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  detailSkuMuted: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  detailSectionRule: {
    height: 8,
    backgroundColor: '#F1F5F9',
    marginTop: 20,
    marginHorizontal: -14,
    marginBottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  detailBodyStack: {
    marginTop: 20,
    gap: 28,
  },
  detailSubsection: {
    gap: 8,
  },
  detailSectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailSectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: -4,
    marginBottom: 4,
  },
  detailMeta: {
    marginTop: 4,
    color: '#64748B',
    fontWeight: '700',
  },
  specTable: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  specKey: {
    width: '36%',
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    paddingRight: 10,
  },
  specVal: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    lineHeight: 20,
  },
  detailPriceRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  detailPriceLeft: {
    flexShrink: 0,
  },
  detailPriceRight: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
    paddingTop: 4,
  },
  detailDiscTag: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  detailStockInline: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailStockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailStockDotOk: {
    backgroundColor: '#22C55E',
  },
  detailStockDotWarn: {
    backgroundColor: '#EAB308',
  },
  detailStockDotBad: {
    backgroundColor: '#EF4444',
  },
  detailStockInlineText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailStockInlineTextOk: {
    color: '#166534',
  },
  detailStockInlineTextWarn: {
    color: '#A16207',
  },
  detailStockInlineTextBad: {
    color: '#B91C1C',
  },
  detailMetaList: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  detailMetaRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  detailMetaRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  description: {
    marginTop: 2,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  detailPackaging: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: '#334155',
  },
  detailSellPrice: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailMrpLine: {
    textAlign: 'right',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontSize: 13,
    fontWeight: '500',
  },
  detailSaveInline: {
    marginTop: 4,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
  qtyBlock: {
    paddingTop: 0,
  },
  qtyBlockDisabled: {
    opacity: 0.55,
  },
  qtyBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 12,
  },
  qtyBlockTitles: {
    flex: 1,
    minWidth: 0,
  },
  qtyTitle: { fontWeight: '800', fontSize: 15 },
  detailMinOrderText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  qtyValue: { minWidth: 40, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  maxInfo: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  assuranceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  assuranceText: {
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
  detailFooterBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  detailFooterDisabled: {
    opacity: 0.95,
  },
  detailFooterBtnDisabled: {
    backgroundColor: '#F1F5F9',
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '82%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  uiAlert: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  uiAlertSuccess: { backgroundColor: '#16A34A' },
  uiAlertError: { backgroundColor: '#DC2626' },
  uiAlertInfo: { backgroundColor: '#2563EB' },
  uiAlertTextWrap: { marginLeft: 8, flex: 1 },
  uiAlertTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  uiAlertMessage: { color: '#FFFFFF', fontWeight: '600', marginTop: 1, fontSize: 12 },
  detailAddBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  detailAddText: { marginLeft: 6, fontWeight: '900' },
  buyNowBtn: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buyNowText: { color: '#FFFFFF', marginLeft: 6, fontWeight: '900' },
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  browseCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  browseThumbWrap: {
    width: 104,
    height: 104,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  browseThumbImage: {
    width: '100%',
    height: '100%',
  },
  browseDiscountBadge: {
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  browseMain: {
    flex: 1,
    minWidth: 0,
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 0,
  },
  wishlistBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMeta: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  browseProductName: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  metaMuted: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tagRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },
  tierChipRowBrowse: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierChipBrowse: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: '28%',
    flexGrow: 1,
    maxWidth: '48%',
  },
  tierChipTextBrowse: {
    fontSize: 10,
    fontWeight: '800',
  },
  tierChipPriceBrowse: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
  },
  detailTierRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailTierChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '47%',
    minWidth: 140,
  },
  detailTierChipLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailTierChipPrice: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },
  browsePriceActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceMeta: { flex: 1, minWidth: 0 },
  browseSellPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  strikePrice: {
    marginTop: 4,
    color: '#64748B',
    textDecorationLine: 'line-through',
    fontSize: 13,
    fontWeight: '700',
  },
  discountText: {
    marginTop: 4,
    fontWeight: '800',
    fontSize: 12,
  },
  packagingShort: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  addBtnCompact: {
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addBtnCompactText: {
    color: '#FFFFFF',
    fontWeight: '900',
    marginLeft: 5,
    fontSize: 13,
  },
});

export default ProductOverviewScreen;

