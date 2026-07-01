import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useGetProductQuery,
  useGetProductsQuery,
} from '../../products/api/productsApi';
import {
  useCheckServiceLocationQuery,
  useGetDeliveryLocationsQuery,
} from '../../../services/api/mobileApi';
import { composeVariantPackagingFromApi } from '../../products/api/schemas';
import { useCart } from '../../../hooks/useCart';
import { useAppDispatch } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
} from '../../../utils/voice';
import { PriceOptionKey, Product, ProductVariant } from '../../../types';
import {
  defaultPriceTier,
  selectedPriceOption,
  uiTierForQuantityCopy,
} from '../../../utils/productPricing';
import {
  cartLineQuantityCaption,
  displayTierAndQtyForLine,
  packagingDetailLine,
  packagingShortLine,
} from '../../../utils/productPackaging';
import { formatRs } from '../../../utils/formatMoney';
import { useWishlist } from '../../../hooks/useWishlist';
import AddPriceTierModal from '../../../shared/ui/AddPriceTierModal';
import ProductCard from '../../../shared/ui/ProductCard';
import AppImage from '../../../shared/ui/AppImage';

type DivisionKey = 'fmcg' | 'homeKitchen';

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

/** Short label for a variant card (e.g. "2 x 300 ml", "Set: 6×100g · 500ml"). */
const variantCardLabel = (v: ProductVariant): string => {
  const composed = composeVariantPackagingFromApi(v as any);
  if (composed && composed.trim()) return composed.trim();
  if (v.weight && v.weight.trim()) return v.weight.trim();
  if (v.packagingLabel && v.packagingLabel.trim()) return v.packagingLabel.trim();
  return 'Option';
};

/**
 * Per-unit price line for a variant (e.g. "₹0.7/ml") by parsing a quantity + unit
 * out of the variant's weight/label. Multipliers like "2 x 300 ml" → 600 ml.
 * Returns null when no quantity can be parsed.
 */
const variantPerUnitText = (v: ProductVariant, price: number): string | null => {
  if (!price || price <= 0) return null;
  const raw = `${v.weight ?? ''} ${v.setPieces ?? ''} ${v.packagingLabel ?? ''}`
    .toLowerCase()
    .replace(/×/g, 'x');
  // Capture an optional multiplier and a quantity+unit, e.g. "2 x 300 ml" or "1kg".
  const m = raw.match(/(?:(\d+(?:\.\d+)?)\s*x\s*)?(\d+(?:\.\d+)?)\s*(ml|l|kg|g|gm|gram|grams|litre|liter|pc|pcs|piece|pieces)/);
  if (!m) return null;
  const mult = m[1] ? parseFloat(m[1]) : 1;
  let qty = parseFloat(m[2]) * mult;
  let unit = m[3];
  // Normalize to a base unit so "1 kg" reads as ₹/g-scale sensibly.
  if (unit === 'l' || unit === 'litre' || unit === 'liter') {
    qty *= 1000;
    unit = 'ml';
  } else if (unit === 'kg') {
    qty *= 1000;
    unit = 'g';
  } else if (unit === 'gm' || unit === 'gram' || unit === 'grams') {
    unit = 'g';
  } else if (unit === 'pcs' || unit === 'piece' || unit === 'pieces') {
    unit = 'pc';
  }
  if (!qty || qty <= 0) return null;
  const per = price / qty;
  const rounded = per >= 1 ? per.toFixed(1) : per.toFixed(2);
  return `₹${rounded}/${unit}`;
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
  onAdd: (product: Product, tier: PriceOptionKey, variantId?: string) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
  accentColor: string;
  textColor: string;
}) => {
  const { items } = useCart();
  const [tierKey, setTierKey] = React.useState<PriceOptionKey>(() =>
    defaultPriceTier(item),
  );
  const [tierModalVisible, setTierModalVisible] = React.useState(false);
  React.useEffect(() => {
    setTierKey(defaultPriceTier(item));
  }, [item.id]);

  const totalQtyAllTiers = React.useMemo(
    () =>
      items
        .filter(i => i.product.id === item.id)
        .reduce((sum, i) => sum + i.quantity, 0),
    [items, item.id],
  );
  const multiTier = (item.priceOptions?.length ?? 0) > 1;
  const showTierChips = multiTier && totalQtyAllTiers > 0;

  const active = selectedPriceOption(item, tierKey);
  const sellRaw = active?.sellingPrice ?? item.price;
  const discPct = active?.discount ?? item.discountPercent;
  const strikeMrpRaw =
    active?.mrp ?? Math.round(sellRaw / Math.max(1 - discPct / 100, 0.01));
  const sell = Math.round(sellRaw * 100) / 100;
  const strikeMrp = Math.round(strikeMrpRaw * 100) / 100;
  const savings = Math.max(0, Math.round((strikeMrp - sell) * 100) / 100);
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

          {showTierChips ? (
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
            {item.deliverable === false ? (
              <View style={styles.notDeliverableCompact}>
                <Icon name="map-marker-off-outline" size={14} color="#94A3B8" />
                <Text style={styles.notDeliverableCompactText}>Not in your area</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtnCompact, { backgroundColor: accentColor }]}
                onPress={() => {
                  if (multiTier && totalQtyAllTiers === 0) {
                    setTierModalVisible(true);
                  } else {
                    onAdd(item, tierKey, item.variants?.[0]?.id);
                  }
                }}
                activeOpacity={0.9}>
                <Icon name="cart-plus" size={15} color="#FFFFFF" />
                <Text style={styles.addBtnCompactText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <AddPriceTierModal
        visible={tierModalVisible}
        onClose={() => setTierModalVisible(false)}
        product={item}
        accentColor={accentColor}
        onSelectTier={tier => {
          setTierKey(tier);
          onAdd(item, tier, item.variants?.[0]?.id);
        }}
      />
    </View>
  );
};

const ProductOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const division: DivisionKey = route.params?.division ?? 'fmcg';
  const selectedProductId: string | undefined = route.params?.productId;
  const initialProductFromParams: Product | undefined = route.params?.initialProduct;
  const subCategoryFilter: string | undefined = route.params?.subCategory;
  const brandFilter: string | undefined = route.params?.brand;
  const companyFilter: string | undefined = route.params?.company;
  const searchParam: string | undefined = route.params?.search;
  const categoryFilter:
    | { ids?: string[]; names?: string[]; slugs?: string[] }
    | undefined = route.params?.categoryFilter;
  const categoryFilterKey = categoryFilter
    ? `${(categoryFilter.ids ?? []).join(',')}|${(categoryFilter.names ?? []).join(',')}|${(categoryFilter.slugs ?? []).join(',')}`
    : '';

  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Customer's default delivery pincode — drives zone serviceability (show-all, mark-unavailable).
  const { data: deliveryLocationsEnvelope } = useGetDeliveryLocationsQuery();
  const deliveryLocations = (deliveryLocationsEnvelope?.data as any[]) ?? [];
  const defaultDeliveryLocation =
    deliveryLocations.find((l: any) => l.is_default) ?? deliveryLocations[0];
  const defaultPincode: string = defaultDeliveryLocation?.pincode ?? '';
  const { data: allProducts = [] } = useGetProductsQuery(
    defaultPincode ? { pincode: defaultPincode } : undefined,
  );
  const { add, decrement, items: cartItems } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const dispatch = useAppDispatch();

  const [query, setQuery] = useState(searchParam ?? '');
  const [isListening, setIsListening] = useState(false);
  const selectedSets = 1;
  const [detailTierKey, setDetailTierKey] = useState<PriceOptionKey>('unit');
  // Selected purchasable variant SKU (Swiggy-style cards). Null when the product
  // has no variants (falls back to the unit/set/remaining tier flow).
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addTierModalVisible, setAddTierModalVisible] = useState(false);
  const [productDetailsExpanded, setProductDetailsExpanded] = useState(false);
  const buyNowAfterAddRef = useRef(false);
  const [selectedDetailImageIndex, setSelectedDetailImageIndex] = useState(0);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const galleryRef = useRef<FlatList<string>>(null);

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
    if (searchParam) setQuery(searchParam);
  }, [searchParam]);

  React.useEffect(() => {
    Voice.onSpeechResults = e => {
      const value = e.value?.[0] ?? '';
      setQuery(value);
      setIsListening(false);
    };

    Voice.onSpeechError = () => {
      setIsListening(false);
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
    const cfSlugs = categoryFilter?.slugs?.filter(Boolean) ?? [];
    if (cfIds.length > 0 || cfNames.length > 0 || cfSlugs.length > 0) {
      const idSet = new Set(cfIds.map(s => String(s).trim().toLowerCase()));
      list = list.filter(p => {
        const pid = p.shopCategoryId ? String(p.shopCategoryId).trim().toLowerCase() : '';
        if (pid && idSet.has(pid)) {
          return true;
        }
        const pslug = p.shopCategorySlug?.trim().toLowerCase();
        if (pslug) {
          for (const s of cfSlugs) {
            if (String(s).trim().toLowerCase() === pslug) {
              return true;
            }
          }
        }
        const sub = p.subCategory?.trim();
        if (sub) {
          for (const n of cfNames) {
            if (n.trim() === sub) {
              return true;
            }
          }
        }
        return false;
      });
    } else if (subCategoryFilter) {
      list = list.filter(p => p.subCategory === subCategoryFilter);
    }
    if (brandFilter) {
      list = list.filter(p => p.brand === brandFilter);
    }
    if (companyFilter) {
      list = list.filter(p => p.companyName === companyFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p => p.name.toLowerCase().includes(q));
  }, [
    divisionProducts,
    subCategoryFilter,
    brandFilter,
    companyFilter,
    query,
    categoryFilterKey,
  ]);

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
    refetch: refetchProduct,
  } = useGetProductQuery(selectedProductId ?? '', {
    skip: !selectedProductId,
    refetchOnMountOrArgChange: true,
  });

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return undefined;
    if (fetchedProduct) {
      return mergeProductFromApi(listProduct ?? initialProductFromParams, fetchedProduct) ?? fetchedProduct;
    }
    return listProduct ?? initialProductFromParams;
  }, [selectedProductId, listProduct, fetchedProduct, initialProductFromParams]);

  // RTK Query can return a stale cached error (isFetching=false, isError=true) for
  // several renders before the new fetch actually starts. A single-render ref guard
  // is not enough — any intervening re-render (cart update, list loading, etc.) flips
  // productIdJustChanged to false and flashes the error UI.
  // Fix: also track whether isFetching=true has been observed for the current ID.
  // Until it has, treat the state as "loading" regardless of the cached error flag.
  const lastSeenProductIdRef = useRef<string | undefined>(undefined);
  const productFetchInFlightRef = useRef(false);

  if (lastSeenProductIdRef.current !== selectedProductId) {
    lastSeenProductIdRef.current = selectedProductId;
    productFetchInFlightRef.current = false;
  }
  if (isProductFetching) {
    productFetchInFlightRef.current = true;
  }

  const showDetailSpinner = Boolean(
    selectedProductId && !selectedProduct && (isProductFetching || !productFetchInFlightRef.current),
  );

  // Only surface the error after a 2-second grace period — parsing latency can
  // cause a transient error state even when the product is about to load successfully.
  const [errorGracePassed, setErrorGracePassed] = useState(false);
  const rawDetailError = Boolean(
    selectedProductId &&
      !selectedProduct &&
      productFetchInFlightRef.current &&
      !isProductFetching &&
      isProductError,
  );
  useEffect(() => {
    if (!rawDetailError) {
      setErrorGracePassed(false);
      return;
    }
    const t = setTimeout(() => setErrorGracePassed(true), 2000);
    return () => clearTimeout(t);
  }, [rawDetailError]);
  const showDetailError = rawDetailError && errorGracePassed;

  const isDetailMode = Boolean(selectedProductId);

  const priceOptionsKeySig = useMemo(
    () =>
      (selectedProduct?.priceOptions ?? [])
        .map(o => o.key)
        .join(','),
    [selectedProduct?.priceOptions],
  );

  React.useEffect(() => {
    setSelectedDetailImageIndex(0);
  }, [selectedProductId]);

  // Purchasable variants (each a SKU with its own price + image gallery).
  const purchasableVariants = useMemo(
    () =>
      (selectedProduct?.variants ?? []).filter(
        v => v.id && (v.specialPrice != null || v.mrp != null),
      ),
    [selectedProduct],
  );
  const hasVariants = purchasableVariants.length > 0;
  const selectedVariant = useMemo(
    () => purchasableVariants.find(v => v.id === selectedVariantId) ?? null,
    [purchasableVariants, selectedVariantId],
  );

  const selectedPackagingDetail = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedVariant) {
      const label = composeVariantPackagingFromApi(selectedVariant as any);
      return label ? `Packaging: ${label}` : null;
    }
    return packagingDetailLine(selectedProduct);
  }, [selectedProduct, selectedVariant]);

  React.useEffect(() => {
    if (!selectedProduct) return;
    setDetailTierKey(defaultPriceTier(selectedProduct));
    const firstVariant = (selectedProduct.variants ?? []).find(
      v => v.id && (v.specialPrice != null || v.mrp != null),
    );
    setSelectedVariantId(firstVariant?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-default when id or tier list changes, not when other merged fields refresh (would reset pack-size choice).
  }, [selectedProduct?.id, priceOptionsKeySig]);

  const detailPrice = useMemo(() => {
    if (!selectedProduct) {
      return { sell: 0, disc: 0, mrp: 0, savings: 0 };
    }
    // A selected variant is its own SKU → price comes from the variant.
    if (selectedVariant) {
      const sellRaw = selectedVariant.specialPrice ?? selectedVariant.mrp ?? 0;
      const mrpRaw = selectedVariant.mrp ?? sellRaw;
      const sell = Math.round(sellRaw * 100) / 100;
      const mrp = Math.round(mrpRaw * 100) / 100;
      const disc =
        selectedVariant.discountPercentage ??
        (mrp > sell ? ((mrp - sell) / mrp) * 100 : 0);
      const savings = Math.max(0, Math.round((mrp - sell) * 100) / 100);
      return { sell, disc, mrp, savings };
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
  }, [selectedProduct, detailTierKey, selectedVariant]);
  const detailImages = useMemo(() => {
    const productImages = selectedProduct ? getProductImages(selectedProduct) : [];
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      // Main product image(s) always first; append variant-specific images after,
      // deduped so the same URL doesn't appear twice.
      const productImageSet = new Set(productImages);
      const variantOnly = selectedVariant.images
        .map((u: string) => String(u || '').trim())
        .filter((u: string) => u && !productImageSet.has(u));
      return [...productImages, ...variantOnly];
    }
    return productImages;
  }, [selectedProduct, selectedVariant]);

  // Reset gallery to the first image whenever the selected variant changes.
  React.useEffect(() => {
    setSelectedDetailImageIndex(0);
    try {
      galleryRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      // ignore — list may not be mounted yet
    }
  }, [selectedVariantId]);

  const selectedVariantCartQty = useMemo(() => {
    if (!selectedProduct || !selectedVariantId) return 0;
    return cartItems
      .filter(
        i => i.product.id === selectedProduct.id && i.variantId === selectedVariantId,
      )
      .reduce((s, i) => s + i.quantity, 0);
  }, [cartItems, selectedProduct?.id, selectedVariantId]);
  const specEntries = useMemo(
    () =>
      selectedProduct?.specifications
        ? Object.entries(selectedProduct.specifications)
        : [],
    [selectedProduct],
  );

  // Whole-pincode serviceability banner (separate from per-product zone gating above).
  const { data: locationCheckEnvelope } = useCheckServiceLocationQuery(
    defaultPincode,
    { skip: !defaultPincode },
  );
  const locationCheck = locationCheckEnvelope?.data;
  const isLocationUnavailable =
    !!locationCheck && locationCheck.restricted && !locationCheck.available;

  const canPurchase = selectedProduct
    ? isProductPurchasable(selectedProduct) &&
      !isLocationUnavailable &&
      selectedProduct.deliverable !== false
    : false;

  const detailProductCartTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return cartItems
      .filter(i => i.product.id === selectedProduct.id)
      .reduce((s, i) => s + i.quantity, 0);
  }, [cartItems, selectedProduct?.id]);

  const detailMultiTier = (selectedProduct?.priceOptions?.length ?? 0) > 1;
  const detailShowPackChips =
    Boolean(selectedProduct) && detailMultiTier && detailProductCartTotal > 0 && !hasVariants;

  /**
   * Cart line for the selected pack tier. When the API stored a set as `unit` with qty = n×pcs,
   * still treat it as sets in the footer for minus / "Add more".
   */
  const detailTierCartBinding = useMemo(() => {
    if (!selectedProduct) {
      return { displayQty: 0, decrementTier: null as PriceOptionKey | null };
    }
    const ui = uiTierForQuantityCopy(selectedProduct, detailTierKey);
    const exact = cartItems.find(
      i =>
        i.product.id === selectedProduct.id &&
        i.priceOptionKey === detailTierKey,
    );
    if (exact) {
      if (ui === 'set') {
        const { qty } = displayTierAndQtyForLine(
          selectedProduct,
          exact.quantity,
          exact.priceOptionKey,
        );
        return { displayQty: qty, decrementTier: exact.priceOptionKey };
      }
      return {
        displayQty: exact.quantity,
        decrementTier: exact.priceOptionKey,
      };
    }
    if (ui === 'set') {
      const unitLine = cartItems.find(
        i =>
          i.product.id === selectedProduct.id &&
          i.priceOptionKey === 'unit',
      );
      const pcs = Math.max(1, selectedProduct.piecesPerSet ?? 1);
      if (
        unitLine &&
        unitLine.quantity >= pcs &&
        unitLine.quantity % pcs === 0
      ) {
        return {
          displayQty: unitLine.quantity / pcs,
          decrementTier: 'unit' as const,
        };
      }
    }
    return { displayQty: 0, decrementTier: null };
  }, [cartItems, selectedProduct, detailTierKey]);

  const detailCartSummaryText = useMemo(() => {
    if (!selectedProduct || detailProductCartTotal === 0) return '';
    const lines = cartItems.filter(i => i.product.id === selectedProduct.id);
    if (lines.length === 0) return '';
    if (lines.length === 1) {
      const L = lines[0];
      return cartLineQuantityCaption(
        selectedProduct,
        L.quantity,
        L.priceOptionKey,
      );
    }
    return lines
      .map(L =>
        cartLineQuantityCaption(
          selectedProduct,
          L.quantity,
          L.priceOptionKey,
        ),
      )
      .join(' · ');
  }, [cartItems, selectedProduct, detailProductCartTotal]);

  const similarProducts = useMemo(() => {
    if (!selectedProduct) return [];
    const id = selectedProduct.id;
    const shopId = selectedProduct.shopCategoryId?.trim();
    const shopSlug = selectedProduct.shopCategorySlug?.trim().toLowerCase();
    const sub = selectedProduct.subCategory?.trim();
    const cat = selectedProduct.category;

    let pool = divisionProducts.filter(p => p.id !== id);
    if (shopId) {
      const narrowed = pool.filter(
        p => p.shopCategoryId && String(p.shopCategoryId).trim() === shopId,
      );
      if (narrowed.length > 0) pool = narrowed;
    } else if (shopSlug) {
      const narrowed = pool.filter(
        p => (p.shopCategorySlug || '').trim().toLowerCase() === shopSlug,
      );
      if (narrowed.length > 0) pool = narrowed;
    } else if (sub) {
      const narrowed = pool.filter(p => p.subCategory?.trim() === sub);
      if (narrowed.length > 0) pool = narrowed;
    } else {
      pool = pool.filter(p => p.category === cat);
    }

    return pool.slice(0, 14);
  }, [selectedProduct, divisionProducts]);

  const stockHint = useMemo(() => {
    if (!selectedProduct) return null;
    if (isLocationUnavailable) {
      return { text: 'Not available in your location', tone: 'bad' as const };
    }
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
  }, [selectedProduct, isLocationUnavailable]);

  const carouselWidth = windowWidth;
  const carouselHeight = Math.min(Math.round(windowWidth * 0.90), 360);

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

  /**
   * Convert the UI set-count to the raw quantity the API/cart expects.
   * When a product is stored as 'unit' pieces but the stepper shows "sets",
   * the user's set count must be multiplied by piecesPerSet (or minOrderQuantity
   * when piecesPerSet is 1) before sending to the cart.
   */
  const toRawQty = (item: Product, sets: number, tier: PriceOptionKey): number => {
    const uiTier = uiTierForQuantityCopy(item, tier);
    if (tier !== 'unit' || uiTier !== 'set') return sets;
    const pcs = Math.max(1, item.piecesPerSet ?? 1);
    const minO = Math.max(1, Math.trunc(Number(item.minOrderQuantity) || 1));
    const effectivePcs = pcs > 1 ? pcs : minO > 1 ? minO : 1;
    return sets * effectivePcs;
  };

  const addSelectedProductToCartWithTier = (item: Product, tier: PriceOptionKey) => {
    add(item, toRawQty(item, selectedSets, tier), tier);
  };

  const addSelectedProductToCart = (item: Product) => {
    addSelectedProductToCartWithTier(item, detailTierKey);
  };

  const buyNow = (item: Product) => {
    addSelectedProductToCart(item);
    navigation.navigate('Cart');
  };

  const addSelectedVariantToCart = (item: Product, variant: ProductVariant) => {
    if (!variant.id) return;
    add(item, selectedSets, 'unit', variant.id);
  };

  const onPressDetailAddToCart = () => {
    if (!selectedProduct || !canPurchase) return;
    // Variant products: add the selected SKU directly (its own price/images).
    if (hasVariants) {
      if (selectedVariant) {
        addSelectedVariantToCart(selectedProduct, selectedVariant);
      }
      return;
    }
    if (detailMultiTier && detailProductCartTotal === 0) {
      buyNowAfterAddRef.current = false;
      setAddTierModalVisible(true);
      return;
    }
    addSelectedProductToCart(selectedProduct);
  };

  const onPressDetailBuyNow = () => {
    if (!selectedProduct || !canPurchase) return;
    if (hasVariants) {
      if (selectedVariant) {
        addSelectedVariantToCart(selectedProduct, selectedVariant);
        navigation.navigate('Cart');
      }
      return;
    }
    if (detailMultiTier && detailProductCartTotal === 0) {
      buyNowAfterAddRef.current = true;
      setAddTierModalVisible(true);
      return;
    }
    buyNow(selectedProduct);
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
      {/* Persistent top bar for detail mode — floats over image and content */}
      {isDetailMode && (
        <View
          style={[styles.detailStickyHeader, { paddingTop: insets.top + 6 }]}
          pointerEvents="box-none">
          <TouchableOpacity
            style={styles.detailOverlayCircleBtn}
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
            }
            activeOpacity={0.9}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="chevron-down" size={22} color="#0F172A" />
          </TouchableOpacity>
          {selectedProduct ? (
            <TouchableOpacity
              style={styles.detailOverlayCircleBtn}
              onPress={() => toggle(selectedProduct.id)}
              activeOpacity={0.9}>
              <Icon
                name={isWishlisted(selectedProduct.id) ? 'heart' : 'heart-outline'}
                size={20}
                color={isWishlisted(selectedProduct.id) ? '#EF4444' : '#0F172A'}
              />
            </TouchableOpacity>
          ) : <View />}
        </View>
      )}

      {!isDetailMode && (
        <>
          <View style={[styles.browseHeaderBar, { paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
              }
              style={[styles.browseHeaderIconBtn, { borderColor: primaryBorder }]}
              activeOpacity={0.9}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="chevron-left" size={22} color={primary} />
            </TouchableOpacity>
            <View style={styles.browseHeaderTitleSlot} pointerEvents="none">
              <Text style={[styles.browseHeaderTitle, { color: primary }]} numberOfLines={1}>
                {companyFilter || brandFilter || subCategoryFilter || (isHomeKitchen ? 'Home & Kitchen' : 'FMCG')}
              </Text>
              <Text style={styles.browseHeaderCaption} numberOfLines={1}>
                {isHomeKitchen ? 'Home & Kitchen' : 'FMCG'} · {products.length} items
              </Text>
            </View>
          </View>

          <View style={[styles.browseSearchToolbar, { borderColor: primaryBorder }]}>
            <Icon name="magnify" size={20} color={primary} />
            <TextInput
              style={[styles.search, { color: primaryText }]}
              placeholder={
                isHomeKitchen
                  ? 'Search kitchen & home essentials...'
                  : 'Search FMCG essentials...'
              }
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity
              onPress={async () => {
                try {
                  if (!isVoiceSearchAvailable) {
                    return;
                  }
                  if (Platform.OS === 'android') {
                    const granted = await PermissionsAndroid.request(
                      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    );
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
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
                } catch {
                  setIsListening(false);
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
      )}

      <ScrollView
        style={[styles.container, !isDetailMode && styles.browseContainer]}
        contentContainerStyle={
          isDetailMode
            ? { flexGrow: 1, paddingBottom: insets.bottom + 32 }
            : [styles.content, styles.browseContent]
        }
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        bounces>
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
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { borderColor: primary }]}
                onPress={refetchProduct}
                activeOpacity={0.85}>
                <Icon name="refresh" size={15} color={primary} />
                <Text style={[styles.retryButtonText, { color: primary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : selectedProduct ? (
            <View style={styles.detailWrap}>
              {/* Hero image — full bleed, goes under status bar */}
              <View style={[styles.detailGalleryBleed, { width: carouselWidth, height: carouselHeight }]}>
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
                        style={{ width: carouselWidth, height: carouselHeight }}>
                        <AppImage
                          uri={uri}
                          width={carouselWidth}
                          style={styles.detailCarouselImage}
                          resizeMode="contain"
                          backgroundColor="#F5F7FA"
                        />
                      </Pressable>
                    )}
                  />
                ) : (
                  <View style={[styles.detailCarouselPlaceholder, { width: carouselWidth, height: carouselHeight }]}>
                    <Icon name="image-off-outline" size={48} color="#94A3B8" />
                    <Text style={styles.detailCarouselPlaceholderText}>No image</Text>
                  </View>
                )}

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

              {/* ETA + Rating strip */}
              {(selectedProduct.etaMinutes !== undefined ||
                (selectedProduct.rating != null && selectedProduct.rating > 0)) ? (
                <View style={styles.etaRatingStrip}>
                  {selectedProduct.etaMinutes !== undefined ? (
                    <Text style={styles.etaText}>{selectedProduct.etaMinutes} MINS</Text>
                  ) : null}
                  {selectedProduct.etaMinutes !== undefined &&
                  selectedProduct.rating != null &&
                  selectedProduct.rating > 0 ? (
                    <View style={styles.etaRatingDivider} />
                  ) : null}
                  {selectedProduct.rating != null && selectedProduct.rating > 0 ? (
                    <View style={styles.ratingRow}>
                      <Icon name="star" size={13} color="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {Number(selectedProduct.rating).toFixed(1)}
                        {selectedProduct.reviewCount && selectedProduct.reviewCount > 0
                          ? ` (${
                              selectedProduct.reviewCount >= 1000
                                ? `${(selectedProduct.reviewCount / 1000).toFixed(1)}k`
                                : selectedProduct.reviewCount
                            })`
                          : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Main white content card */}
              <View style={styles.detailContentCard}>

                {/* Explore brand link */}
                {selectedProduct.brand ? (
                  <TouchableOpacity
                    style={styles.brandExploreRow}
                    onPress={() =>
                      navigation.push('ProductOverview', {
                        division,
                        brand: selectedProduct.brand,
                      })
                    }
                    activeOpacity={0.8}>
                    <Text style={[styles.brandExploreText, { color: primary }]}>
                      Explore all {selectedProduct.brand} items
                    </Text>
                    <Icon name="chevron-right" size={16} color={primary} />
                  </TouchableOpacity>
                ) : null}

                {/* Product name + short description */}
                <Text style={[styles.detailNameNew, { color: primaryText }]}>
                  {selectedProduct.name}
                </Text>
                <Text style={styles.detailDescNew} numberOfLines={2}>
                  {selectedProduct.description?.trim()
                    ? selectedProduct.description.trim()
                    : `${selectedProduct.subCategory ?? selectedProduct.category} product`}
                </Text>

                {/* Quantity label */}
                {selectedPackagingDetail ? (
                  <Text style={styles.detailQtyLabel}>
                    Quantity: {selectedPackagingDetail.replace('Packaging: ', '')}
                  </Text>
                ) : null}

                {/* Location banners */}
                {isLocationUnavailable ? (
                  <View style={styles.detailLocationBanner}>
                    <Icon name="map-marker-off" size={18} color="#92400E" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailLocationBannerTitle}>
                        Not available in your location
                      </Text>
                      <Text style={styles.detailLocationBannerBody}>
                        {defaultPincode
                          ? `We don't deliver to pincode ${defaultPincode} yet.`
                          : "We don't deliver here yet."}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {selectedProduct.deliverable === false && !isLocationUnavailable ? (
                  <View style={styles.detailLocationBanner}>
                    <Icon name="map-marker-off" size={18} color="#92400E" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailLocationBannerTitle}>
                        Not deliverable to your area
                      </Text>
                      <Text style={styles.detailLocationBannerBody}>
                        {defaultPincode
                          ? `This seller doesn't deliver to pincode ${defaultPincode}.`
                          : "This seller doesn't deliver to your address."}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Variant / pack-size chips (Swiggy-style compact cards) */}
                {hasVariants ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.variantChipsScrollContent}
                    style={styles.variantChipsScroll}>
                    {purchasableVariants.map((v, idx) => {
                      const sel = v.id === selectedVariantId;
                      const vSell = Number(v.specialPrice ?? v.mrp ?? 0);
                      const vMrp = Number(v.mrp ?? vSell);
                      const vDisc = Number(
                        v.discountPercentage ??
                          (vMrp > vSell ? ((vMrp - vSell) / vMrp) * 100 : 0),
                      );
                      const vPerUnit = variantPerUnitText(v, vSell);
                      return (
                        <TouchableOpacity
                          key={v.id ?? `v-${idx}`}
                          style={[
                            styles.variantChipCard,
                            sel
                              ? { borderColor: primary, borderWidth: 2 }
                              : { borderColor: '#CBD5E1', borderWidth: 1 },
                          ]}
                          onPress={() => setSelectedVariantId(v.id ?? null)}
                          activeOpacity={0.85}>
                          <Text style={[styles.variantChipCardLabel, { color: primaryText }]}>
                            {variantCardLabel(v)}
                          </Text>
                          {vDisc > 0 ? (
                            <Text style={[styles.variantChipCardDisc, { color: primary }]}>
                              {Math.round(vDisc)}% OFF
                            </Text>
                          ) : null}
                          <View style={styles.variantChipCardPriceRow}>
                            <Text style={[styles.variantChipCardPrice, { color: primaryText }]}>
                              ₹{formatRs(vSell)}
                            </Text>
                            {vMrp > vSell ? (
                              <Text style={styles.variantChipCardMrp}>₹{formatRs(vMrp)}</Text>
                            ) : null}
                          </View>
                          {vPerUnit ? (
                            <Text style={styles.variantChipCardPerUnit}>{vPerUnit}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : detailMultiTier ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.variantChipsScrollContent}
                    style={styles.variantChipsScroll}>
                    {selectedProduct.priceOptions!.map(opt => {
                      const sel = opt.key === detailTierKey;
                      const optDisc =
                        opt.discount ??
                        (opt.mrp > opt.sellingPrice
                          ? ((opt.mrp - opt.sellingPrice) / opt.mrp) * 100
                          : 0);
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.variantChipCard,
                            sel
                              ? { borderColor: primary, borderWidth: 2 }
                              : { borderColor: '#CBD5E1', borderWidth: 1 },
                          ]}
                          onPress={() => setDetailTierKey(opt.key)}
                          activeOpacity={0.85}>
                          <Text style={[styles.variantChipCardLabel, { color: primaryText }]}>
                            {opt.label}
                          </Text>
                          {optDisc > 0 ? (
                            <Text style={[styles.variantChipCardDisc, { color: primary }]}>
                              {Math.round(optDisc)}% OFF
                            </Text>
                          ) : null}
                          <View style={styles.variantChipCardPriceRow}>
                            <Text style={[styles.variantChipCardPrice, { color: primaryText }]}>
                              ₹{formatRs(opt.sellingPrice)}
                            </Text>
                            <Text style={styles.variantChipCardMrp}>₹{formatRs(opt.mrp)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {/* Divider */}
                <View style={styles.inlineDivider} />

                {/* Price + ADD row */}
                <View style={styles.priceAddRow}>
                  <View style={styles.priceAddLeft}>
                    {detailPrice.disc > 0 ? (
                      <Text style={[styles.priceAddDiscLabel, { color: primary }]}>
                        {Math.round(detailPrice.disc)}% OFF
                      </Text>
                    ) : null}
                    <View style={styles.priceAddPriceLine}>
                      <Text style={[styles.priceAddMain, { color: primaryText }]}>
                        ₹{formatRs(detailPrice.sell)}
                      </Text>
                      {detailPrice.mrp > detailPrice.sell ? (
                        <Text style={styles.priceAddMrpStrike}>
                          ₹{formatRs(detailPrice.mrp)}
                        </Text>
                      ) : null}
                    </View>
                    {selectedVariant
                      ? (() => {
                          const pu = variantPerUnitText(selectedVariant, detailPrice.sell);
                          return pu ? (
                            <Text style={styles.priceAddPerUnit}>{pu}</Text>
                          ) : null;
                        })()
                      : null}
                  </View>

                  {canPurchase
                    ? (() => {
                        const inlineQty = hasVariants
                          ? selectedVariantCartQty
                          : detailTierCartBinding.displayQty;
                        const onInlineAdd = () => {
                          if (hasVariants) {
                            if (selectedVariant)
                              addSelectedVariantToCart(selectedProduct, selectedVariant);
                          } else if (detailMultiTier && detailProductCartTotal === 0) {
                            buyNowAfterAddRef.current = false;
                            setAddTierModalVisible(true);
                          } else {
                            addSelectedProductToCart(selectedProduct);
                          }
                        };
                        const onInlineMinus = () => {
                          if (hasVariants && selectedVariantId) {
                            decrement(selectedProduct.id, undefined, selectedVariantId);
                          } else if (detailTierCartBinding.decrementTier) {
                            decrement(
                              selectedProduct.id,
                              detailTierCartBinding.decrementTier,
                            );
                          }
                        };
                        if (inlineQty === 0) {
                          return (
                            <TouchableOpacity
                              key="add-btn"
                              style={[styles.addBtnLarge, { backgroundColor: primary }]}
                              onPress={onInlineAdd}
                              activeOpacity={0.9}>
                              <Text style={styles.addBtnLargeText}>ADD</Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <View
                            key="stepper"
                            style={[styles.stepperLarge, { borderColor: primary }]}>
                            <TouchableOpacity
                              onPress={onInlineMinus}
                              style={styles.stepperBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={[styles.stepperBtnText, { color: primary }]}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.stepperCount, { color: primaryText }]}>
                              {inlineQty}
                            </Text>
                            <TouchableOpacity
                              onPress={onInlineAdd}
                              style={styles.stepperBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={[styles.stepperBtnText, { color: primary }]}>+</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()
                    : (
                      <View style={styles.notDeliverableCompact}>
                        <Icon name="map-marker-off-outline" size={14} color="#94A3B8" />
                        <Text style={styles.notDeliverableCompactText}>Unavailable</Text>
                      </View>
                    )}
                </View>

                {/* Stock hint */}
                {stockHint ? (
                  <View
                    style={[
                      styles.stockBadge,
                      stockHint.tone === 'ok' && styles.stockBadgeOk,
                      stockHint.tone === 'warn' && styles.stockBadgeWarn,
                      stockHint.tone === 'bad' && styles.stockBadgeBad,
                    ]}>
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
                        styles.stockBadgeText,
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

                {/* View product details collapsible */}
                <TouchableOpacity
                  style={styles.viewDetailsToggle}
                  onPress={() => setProductDetailsExpanded(e => !e)}
                  activeOpacity={0.8}>
                  <Text style={[styles.viewDetailsToggleText, { color: primary }]}>
                    View product details
                  </Text>
                  <Icon
                    name={productDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={primary}
                  />
                </TouchableOpacity>

                {productDetailsExpanded ? (
                  <View style={styles.productDetailsSection}>
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

                    {(
                      [
                        {
                          key: 'rating',
                          icon: 'star-outline',
                          text: (() => {
                            const rc = selectedProduct.reviewCount;
                            const r = selectedProduct.rating;
                            if (rc != null && rc > 0 && r != null && r > 0) {
                              return `${Number(r).toFixed(1)} · ${rc} reviews`;
                            }
                            if (r != null && r > 0) {
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
                                icon: selectedProduct.isVeg ? 'leaf' : 'food-drumstick-outline',
                                text: selectedProduct.isVeg ? 'Vegetarian' : 'Non-vegetarian',
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
                      ] as { key: string; icon: string; text: string }[]
                    ).map((row, index, arr) => (
                      <View
                        key={row.key}
                        style={[
                          styles.detailMetaRow,
                          index === 0 && styles.detailMetaList,
                          index < arr.length - 1 && styles.detailMetaRowDivider,
                        ]}>
                        <Icon name={row.icon} size={18} color="#64748B" />
                        <Text style={[styles.detailMetaRowText, { color: primaryText }]}>
                          {row.text}
                        </Text>
                      </View>
                    ))}

                    {selectedProduct.cancelPolicy ? (
                      <View style={styles.detailSubsection}>
                        <View style={styles.policyHeader}>
                          <Icon name="close-circle-outline" size={16} color={primary} />
                          <Text
                            style={[
                              styles.detailSectionHeading,
                              { color: primaryText, marginBottom: 0 },
                            ]}>
                            Cancellation Policy
                          </Text>
                        </View>
                        <Text style={styles.policyText}>{selectedProduct.cancelPolicy}</Text>
                      </View>
                    ) : null}

                    {selectedProduct.returnPolicy ? (
                      <View style={styles.detailSubsection}>
                        <View style={styles.policyHeader}>
                          <Icon name="arrow-u-left-top" size={16} color={primary} />
                          <Text
                            style={[
                              styles.detailSectionHeading,
                              { color: primaryText, marginBottom: 0 },
                            ]}>
                            Return Policy
                          </Text>
                        </View>
                        <Text style={styles.policyText}>{selectedProduct.returnPolicy}</Text>
                      </View>
                    ) : null}

                    <View style={styles.assuranceRow}>
                      <Icon name="shield-check-outline" size={17} color={primary} />
                      <Text style={styles.assuranceText}>
                        Genuine products · Quality checked · Easy returns if something goes wrong
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Similar Products */}
              {similarProducts.length > 0 ? (
                <View style={styles.similarSection}>
                  <Text style={[styles.similarTitle, { color: primaryText }]}>
                    Similar Products
                  </Text>
                  <Text style={styles.similarSubtitle}>More picks like this one</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.similarListContent}
                    nestedScrollEnabled>
                    {similarProducts.map(sp => (
                      <View key={sp.id} style={styles.similarCardWrap}>
                        <ProductCard
                          product={sp}
                          accentColor={primary}
                          onAdd={(p, tier, vid) => add(p, 1, tier, vid)}
                          onCardPress={p =>
                            navigation.push('ProductOverview', {
                              division,
                              productId: p.id,
                              subCategory: subCategoryFilter,
                              brand: brandFilter,
                              company: companyFilter,
                              categoryFilter,
                              initialProduct: p,
                            })
                          }
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
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
                    : companyFilter
                      ? companyFilter
                      : isHomeKitchen
                        ? 'Kitchen & Home Picks'
                        : 'FMCG Bestsellers'}
              </Text>
            </View>

            <View style={styles.productGrid}>
              {products.map(item => (
                <View key={item.id} style={styles.productGridCell}>
                  <ProductCard
                    product={item}
                    accentColor={primary}
                    onAdd={(p, tier, vid) => add(p, 1, tier, vid)}
                    onCardPress={() =>
                      navigation.navigate('ProductOverview', {
                        division,
                        productId: item.id,
                        subCategory: subCategoryFilter,
                        brand: brandFilter,
                        company: companyFilter,
                        categoryFilter,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>


      {selectedProduct ? (
        <AddPriceTierModal
          visible={addTierModalVisible}
          onClose={() => {
            setAddTierModalVisible(false);
            buyNowAfterAddRef.current = false;
          }}
          product={selectedProduct}
          accentColor={primary}
          onSelectTier={tier => {
            const goCart = buyNowAfterAddRef.current;
            buyNowAfterAddRef.current = false;
            setDetailTierKey(tier);
            add(selectedProduct, toRawQty(selectedProduct, selectedSets, tier), tier);
            setAddTierModalVisible(false);
            if (goCart) {
              navigation.navigate('Cart');
            }
          }}
        />
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
  detailTopTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  backBtnDetail: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
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
  retryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  detailWrap: {
    marginTop: 4,
  },
  detailGalleryBleed: {
    backgroundColor: '#F5F7FA',
    position: 'relative',
    overflow: 'hidden',
  },
  detailCarouselPage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    backgroundColor: '#F5F7FA',
  },
  detailThumbWrapActive: {
    borderWidth: 2,
  },
  detailThumbImage: {
    width: '100%',
    height: '100%',
  },
  detailInfoSection: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  detailHero: {
    paddingBottom: 0,
  },
  detailLocationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  detailLocationBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  detailLocationBannerBody: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  detailBreadcrumb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
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
    height: 6,
    backgroundColor: '#F1F5F9',
    marginTop: 14,
    marginHorizontal: -14,
    marginBottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  detailBodyStack: {
    marginTop: 16,
    gap: 18,
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
  variantList: {
    marginTop: 4,
    gap: 8,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  variantBullet: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 1,
  },
  variantLine: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
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
    marginTop: 12,
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
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
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
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  policyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    fontWeight: '500',
  },
  detailFooterBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  detailFooterAddCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  detailFooterMinus: {
    width: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  detailFooterMinusText: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
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
  detailAddBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  detailAddTextCol: {
    marginLeft: 6,
    flex: 1,
    minWidth: 0,
  },
  detailAddText: { fontWeight: '900', fontSize: 14 },
  detailAddSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    opacity: 0.92,
  },
  similarSection: {
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 6,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
    paddingBottom: 8,
  },
  similarTitle: {
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 16,
    letterSpacing: -0.2,
  },
  similarSubtitle: {
    marginTop: 3,
    marginBottom: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  similarListContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 0,
  },
  similarCardWrap: {
    width: 168,
    marginHorizontal: 4,
  },
  inlineAddBtn: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  inlineAddText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  inlineStepBtn: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStepText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  inlineStepCount: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
  },
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
  variantSection: {
    marginTop: 18,
    marginBottom: 6,
  },
  variantSectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 8,
  },
  variantSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  variantSectionTitleSub: {
    flexShrink: 1,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  variantCardRowOuter: {
    marginTop: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    minHeight: 188,
  },
  variantCardRow: {
    paddingVertical: 4,
    paddingRight: 14,
    gap: 10,
    flexDirection: 'row',
  },
  variantCard: {
    width: 150,
    minHeight: 176,
    borderRadius: 16,
    padding: 10,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  variantCardSelected: {
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  variantCardBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  variantCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  variantCardBadgeSpacer: {
    height: 18,
    marginBottom: 6,
  },
  variantCardImageWrap: {
    width: '100%',
    height: 96,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantCardImage: {
    width: '100%',
    height: '100%',
  },
  variantCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    minHeight: 30,
    lineHeight: 15,
  },
  variantCardPriceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  variantCardPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  variantCardMrp: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  variantCardPerUnit: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  variantCardPerUnitSpacer: {
    height: 13,
    marginTop: 2,
  },
  variantCardSelectedTick: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  notDeliverableCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 0,
  },
  notDeliverableCompactText: { color: '#94A3B8', fontWeight: '800', fontSize: 12 },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 4,
  },
  productGridCell: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  browseContainer: {
    backgroundColor: '#F8FAFC',
  },
  browseHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  browseHeaderIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  browseHeaderTitleSlot: {
    flex: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  browseHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  browseHeaderCaption: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    width: '100%',
  },
  browseSearchToolbar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // --- Swiggy-style detail view ---
  detailOverlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  detailOverlayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailOverlayCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  etaRatingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  etaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
  },
  etaRatingDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailContentCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandExploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandExploreText: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 2,
  },
  detailNameNew: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  detailDescNew: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 6,
  },
  detailQtyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 14,
  },
  variantChipsScroll: {
    marginHorizontal: -16,
    marginBottom: 8,
  },
  variantChipsScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
    paddingTop: 2,
  },
  variantChipCard: {
    minWidth: 100,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  variantChipCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  variantChipCardDisc: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  variantChipCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  variantChipCardPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
  variantChipCardMrp: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  variantChipCardPerUnit: {
    marginTop: 2,
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
    marginHorizontal: -16,
  },
  priceAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  priceAddLeft: {
    flex: 1,
    minWidth: 0,
  },
  priceAddDiscLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  priceAddPriceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  priceAddMain: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  priceAddMrpStrike: {
    fontSize: 15,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  priceAddPerUnit: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  addBtnLarge: {
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addBtnLargeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  stepperLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 120,
  },
  stepperBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  stepperCount: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  paymentOffersCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  paymentOffersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentOffersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  viewDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    marginTop: 14,
  },
  viewDetailsToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  productDetailsSection: {
    gap: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  stockBadgeOk: { backgroundColor: '#DCFCE7' },
  stockBadgeWarn: { backgroundColor: '#FEF9C3' },
  stockBadgeBad: { backgroundColor: '#FEE2E2' },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailStickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
});

export default ProductOverviewScreen;

