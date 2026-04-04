import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGetOffersQuery, useGetProductsQuery } from '../../products/api/productsApi';
import { useCart } from '../../../hooks/useCart';
import DealCard from '../../../shared/ui/DealCard';
import { useAppDispatch } from '../../../hooks/redux';
import { setHomeDivision } from '../homeDivisionSlice';
import Voice, {
  isVoiceSearchAvailable,
  VOICE_NOT_AVAILABLE_MESSAGE,
} from '../../../utils/voice';
import { Product } from '../../../types';
import { useWishlist } from '../../../hooks/useWishlist';
import {
  orderQuantityPlural,
  packagingDetailLine,
  packagingShortLine,
  quantityStepperTitle,
} from '../../../utils/productPackaging';

type DivisionKey = 'fmcg' | 'homeKitchen';
const MAX_SETS_PER_ADD = 5;

const ProductDetailCard = ({
  item,
  onAdd,
  onToggleWishlist,
  isWishlisted,
  accentColor,
  textColor,
}: {
  item: Product;
  onAdd: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  isWishlisted: boolean;
  accentColor: string;
  textColor: string;
}) => {
  const originalPrice = Math.round(
    item.price / Math.max(1 - item.discountPercent / 100, 0.01),
  );
  const packLine = packagingShortLine(item);

  return (
    <View style={styles.productCard}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={styles.productImage} />
        <View style={[styles.discountBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.discountBadgeText}>{item.discountPercent}% OFF</Text>
        </View>
      </View>

      <View style={styles.productTopRow}>
        <View style={styles.productMeta}>
          <Text style={[styles.productName, { color: textColor }]}>{item.name}</Text>
          <Text style={styles.metaMuted}>
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
          <Icon name="shape-outline" size={13} color={accentColor} />
          <Text style={[styles.tagText, { color: accentColor }]}>
            {item.category.toUpperCase()}
          </Text>
        </View>
        {item.etaMinutes !== undefined ? (
          <View style={[styles.tagPill, { borderColor: `${accentColor}66` }]}>
            <Icon name="clock-outline" size={13} color={accentColor} />
            <Text style={[styles.tagText, { color: accentColor }]}>
              {item.etaMinutes} min
            </Text>
          </View>
        ) : null}
        {item.isVeg !== undefined ? (
          <View style={[styles.tagPill, { borderColor: `${accentColor}66` }]}>
            <Icon
              name={item.isVeg ? 'leaf' : 'food-drumstick-outline'}
              size={13}
              color={accentColor}
            />
            <Text style={[styles.tagText, { color: accentColor }]}>
              {item.isVeg ? 'Veg' : 'Non-veg'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceMeta}>
          <View style={styles.priceLine}>
            <Text style={[styles.currentPrice, { color: textColor }]}>Rs {item.price}</Text>
            <Text style={styles.strikePrice}>MRP Rs {originalPrice}</Text>
          </View>
          <Text style={[styles.discountText, { color: accentColor }]}>
            You save Rs {Math.max(originalPrice - item.price, 0)}
          </Text>
          {packLine ? <Text style={styles.packagingShort}>{packLine}</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: accentColor }]}
          onPress={() => onAdd(item)}
          activeOpacity={0.9}>
          <Icon name="cart-plus" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add to cart</Text>
        </TouchableOpacity>
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

  const { data: allProducts = [] } = useGetProductsQuery();
  const { data: offers = [] } = useGetOffersQuery();
  const { add } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const dispatch = useAppDispatch();

  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedSets, setSelectedSets] = useState(1);
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
    if (subCategoryFilter) {
      list = list.filter(p => p.subCategory === subCategoryFilter);
    }
    if (brandFilter) {
      list = list.filter(p => p.brand === brandFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p => p.name.toLowerCase().includes(q));
  }, [divisionProducts, subCategoryFilter, brandFilter, query]);

  const selectedProduct = useMemo(
    () =>
      selectedProductId
        ? divisionProducts.find(p => p.id === selectedProductId)
        : undefined,
    [divisionProducts, selectedProductId],
  );
  const selectedPackagingDetail = useMemo(
    () => (selectedProduct ? packagingDetailLine(selectedProduct) : null),
    [selectedProduct],
  );
  const isDetailMode = Boolean(selectedProduct);
  const productsToShow = selectedProduct ? [selectedProduct] : products;

  React.useEffect(() => {
    setSelectedSets(1);
  }, [selectedProductId]);

  const dealsForDivision = useMemo(() => {
    const color = isHomeKitchen ? '#16A34A' : '#1D4ED8';
    return offers.map(d => ({
      ...d,
      color,
      image: d.imageHomeKitchen ?? d.imageFmcg ?? d.image,
    }));
  }, [isHomeKitchen, offers]);

  const addSelectedProductToCart = (item: Product) => {
    add(item, selectedSets);
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
              {selectedProduct
                ? 'Product details'
                : subCategoryFilter
                  ? `Category: ${subCategoryFilter}`
                  : brandFilter
                    ? `Brand: ${brandFilter}`
                    : 'Browse products curated for you'}
            </Text>
          </View>
        </View>

        {!selectedProduct ? (
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

            <View style={styles.dealsWrap}>
              <FlatList
                data={dealsForDivision}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <DealCard deal={item} />}
              />
            </View>
          </>
        ) : null}

        {selectedProduct ? (
          <View style={styles.detailWrap}>
            <View style={styles.detailImageWrap}>
              <Image source={{ uri: selectedProduct.image }} style={styles.detailImage} />
              <View style={[styles.discountBadge, { backgroundColor: primary }]}>
                <Text style={styles.discountBadgeText}>{selectedProduct.discountPercent}% OFF</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.detailWishlistBtn,
                  {
                    backgroundColor: isWishlisted(selectedProduct.id)
                      ? '#EF4444'
                      : 'rgba(255,255,255,0.75)',
                  },
                ]}
                onPress={() => toggle(selectedProduct.id)}
                activeOpacity={0.9}>
                <Icon
                  name={isWishlisted(selectedProduct.id) ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isWishlisted(selectedProduct.id) ? '#FFFFFF' : '#EF4444'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.detailInfoCard}>
              <Text style={[styles.detailName, { color: primaryText }]}>{selectedProduct.name}</Text>
              <Text style={styles.detailMeta}>
                {selectedProduct.brand ?? 'No brand'} • {selectedProduct.subCategory ?? 'General'}
              </Text>
              <View style={styles.quickInfoRow}>
                <View style={styles.quickInfoPill}>
                  <Icon name="star" size={13} color="#F59E0B" />
                  <Text style={styles.quickInfoText}>
                    {selectedProduct.rating !== undefined
                      ? `${selectedProduct.rating.toFixed?.(1) ?? selectedProduct.rating} rating`
                      : 'Rating unavailable'}
                  </Text>
                </View>
                {selectedProduct.etaMinutes !== undefined ? (
                  <View style={styles.quickInfoPill}>
                    <Icon name="truck-fast-outline" size={13} color="#0284C7" />
                    <Text style={styles.quickInfoText}>
                      {selectedProduct.etaMinutes} min delivery
                    </Text>
                  </View>
                ) : null}
                {selectedProduct.isVeg !== undefined ? (
                  <View style={styles.quickInfoPill}>
                    <Icon
                      name={
                        selectedProduct.isVeg ? 'leaf' : 'food-drumstick-outline'
                      }
                      size={13}
                      color="#16A34A"
                    />
                    <Text style={styles.quickInfoText}>
                      {selectedProduct.isVeg ? 'Veg' : 'Non-veg'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.description}>{productDescription(selectedProduct)}</Text>

              <View style={styles.priceLine}>
                <Text style={[styles.currentPrice, { color: primaryText }]}>Rs {selectedProduct.price}</Text>
                <Text style={styles.strikePrice}>
                  MRP Rs{' '}
                  {Math.round(
                    selectedProduct.price /
                      Math.max(1 - selectedProduct.discountPercent / 100, 0.01),
                  )}
                </Text>
              </View>
              {selectedPackagingDetail ? (
                <Text style={[styles.detailPackaging, { color: primary }]}>
                  {selectedPackagingDetail}
                </Text>
              ) : null}

              <View style={styles.qtyBlock}>
                <Text style={styles.qtyTitle}>{quantityStepperTitle(selectedProduct.unit)}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setSelectedSets(prev => Math.max(1, prev - 1))}
                    activeOpacity={0.9}>
                    <Icon name="minus" size={18} color={primaryText} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, { color: primaryText }]}>{selectedSets}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setSelectedSets(prev => Math.min(MAX_SETS_PER_ADD, prev + 1))}
                    activeOpacity={0.9}>
                    <Icon name="plus" size={18} color={primaryText} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.maxInfo, { color: primary }]}>
                  Up to {MAX_SETS_PER_ADD} {orderQuantityPlural(selectedProduct.unit)} per add.
                </Text>
              </View>
              <View style={styles.assuranceCard}>
                <Icon name="shield-check-outline" size={17} color={primary} />
                <Text style={[styles.assuranceText, { color: primaryText }]}>
                  100% quality checked • Easy replacement if issue found
                </Text>
              </View>

            </View>
          </View>
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

            {productsToShow.map(item => (
              <View key={item.id} style={styles.browseCardWrap}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() =>
                    navigation.navigate('ProductOverview', {
                      division,
                      productId: item.id,
                      subCategory: subCategoryFilter,
                      brand: brandFilter,
                    })
                  }>
                  <ProductDetailCard
                    item={item}
                    onAdd={add}
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

      {selectedProduct ? (
        <View style={styles.detailFooter}>
          <TouchableOpacity
            style={[styles.detailAddBtn, { borderColor: primary }]}
            onPress={() => addSelectedProductToCart(selectedProduct)}
            activeOpacity={0.9}>
            <Icon name="cart-plus" size={17} color={primary} />
            <Text style={[styles.detailAddText, { color: primary }]}>Add to Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyNowBtn, { backgroundColor: primary }]}
            onPress={() => buyNow(selectedProduct)}
            activeOpacity={0.9}>
            <Icon name="flash" size={17} color="#FFFFFF" />
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
  detailContent: { paddingBottom: 104 },
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
  dealsWrap: { marginTop: 12 },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  itemSeparator: { height: 10 },
  browseCardWrap: { marginBottom: 10 },
  detailWrap: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#FFFFFF',
  },
  detailImageWrap: {
    height: 290,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailWishlistBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInfoCard: {
    padding: 14,
  },
  detailName: {
    fontSize: 23,
    fontWeight: '900',
  },
  detailMeta: {
    marginTop: 4,
    color: '#64748B',
    fontWeight: '700',
  },
  quickInfoRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickInfoPill: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickInfoText: {
    marginLeft: 4,
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  description: {
    marginTop: 10,
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  detailPackaging: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
  },
  qtyBlock: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  qtyTitle: { color: '#334155', fontWeight: '800', fontSize: 13 },
  qtyRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  qtyValue: { minWidth: 40, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  maxInfo: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  assuranceCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    padding: 10,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  assuranceText: {
    marginLeft: 8,
    flex: 1,
    fontWeight: '700',
    fontSize: 12,
  },
  detailFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 8,
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
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  detailAddText: { marginLeft: 6, fontWeight: '900' },
  buyNowBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buyNowText: { color: '#FFFFFF', marginLeft: 6, fontWeight: '900' },
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  imageWrap: {
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
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
    alignItems: 'center',
    marginTop: 12,
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
  },
  productName: {
    fontSize: 18,
    fontWeight: '900',
  },
  metaMuted: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tagRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
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
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },
  priceRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceMeta: { flex: 1, marginRight: 8 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currentPrice: {
    fontSize: 22,
    fontWeight: '900',
  },
  strikePrice: {
    color: '#64748B',
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
  discountText: {
    marginTop: 3,
    fontWeight: '700',
    fontSize: 12,
  },
  packagingShort: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  addBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    marginLeft: 6,
  },
});

export default ProductOverviewScreen;

