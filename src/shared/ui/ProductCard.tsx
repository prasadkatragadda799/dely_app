import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PriceOptionKey, Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import {
  stepperQuantityCaptionForCartLine,
} from '../../utils/productPackaging';
import {
  defaultPriceTier,
  productImpliesSetPurchase,
  selectedPriceOption,
} from '../../utils/productPricing';
import { formatRs } from '../../utils/formatMoney';
import { useWishlist } from '../../hooks/useWishlist';
import AddPriceTierModal from './AddPriceTierModal';
import SelectVariantModal from './SelectVariantModal';
import { sizedImageUrl } from './AppImage';

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    // Fallback to blue-ish transparent if someone passes non-hex.
    return `rgba(29,78,216,${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

type Props = {
  product: Product;
  onAdd: (product: Product, tier: PriceOptionKey, variantId?: string) => Promise<void> | void;
  accentColor?: string;
  onCardPress?: (product: Product) => void;
  onNamePress?: (product: Product) => void;
};

const ProductCard = ({
  product,
  onAdd,
  accentColor = '#1D4ED8',
  onCardPress,
  onNamePress,
}: Props) => {
  const { items, increment, decrement } = useCart();
  const [mutating, setMutating] = useState(false);
  const addMutatingRef = useRef(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);
  // Optimistic local quantity: updated immediately on tap, reset when server responds.
  const [localQty, setLocalQty] = useState<number | null>(null);
  const { isWishlisted, toggle } = useWishlist();
  const isFavorite = isWishlisted(product.id);
  const favBg = useMemo(() => hexToRgba(accentColor, 0.35), [accentColor]);
  const borderTint = useMemo(() => hexToRgba(accentColor, 0.45), [accentColor]);

  const [tierKey, setTierKey] = useState<PriceOptionKey>(() =>
    defaultPriceTier(product),
  );
  const priceOptsSig = useMemo(
    () => (product.priceOptions ?? []).map(o => o.key).join(','),
    [product.priceOptions],
  );
  useEffect(() => {
    setTierKey(defaultPriceTier(product));
  }, [product.id, priceOptsSig]);

  const Wrapper = onCardPress ? TouchableOpacity : View;

  const cartLineForCard = useMemo(() => {
    const defaultVariantId = product.variants?.[0]?.id;
    const lines = items.filter(i => i.product.id === product.id);
    // For variant products, match the default variant line first.
    const variantLine = defaultVariantId
      ? lines.find(i => i.variantId === defaultVariantId)
      : undefined;
    if (variantLine) return variantLine;
    const exact = lines.find(i => i.priceOptionKey === tierKey && !i.variantId);
    if (exact) {
      return exact;
    }
    if (productImpliesSetPurchase(product) && tierKey === 'unit') {
      return lines.find(i => i.priceOptionKey === 'unit');
    }
    if (tierKey === 'set') {
      const u = lines.find(i => i.priceOptionKey === 'unit');
      const pcs = Math.max(1, product.piecesPerSet ?? 1);
      if (
        u &&
        u.quantity >= pcs &&
        u.quantity % pcs === 0 &&
        (product.priceOptions?.some(o => o.key === 'set') ||
          productImpliesSetPurchase(product))
      ) {
        return u;
      }
      return lines.find(i => i.priceOptionKey === 'set');
    }
    return undefined;
  }, [items, product, tierKey]);

  const rawLineQty = cartLineForCard?.quantity ?? 0;

  // When the server cart updates, clear local optimistic override.
  useEffect(() => {
    setLocalQty(null);
    setMutating(false);
  }, [rawLineQty]);

  // Optimistic display quantity: local override while API is in flight.
  const displayQty = localQty !== null ? localQty : rawLineQty;

  const totalQtyAllTiers = useMemo(
    () =>
      items
        .filter(i => i.product.id === product.id)
        .reduce((sum, i) => sum + i.quantity, 0),
    [items, product.id],
  );
  const opts = product.priceOptions;
  const activeOpt = selectedPriceOption(product, tierKey);
  const displayPrice = activeOpt?.sellingPrice ?? product.price;
  const discountPct = Number(activeOpt?.discount ?? product.discountPercent ?? 0);
  const multiTier = (opts?.length ?? 0) > 1;
  /** After the first line exists, chips switch which tier the stepper edits. */
  const showTierChips = multiTier && totalQtyAllTiers > 0;
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const originalPrice = Math.round(
    (displayPrice / Math.max(1 - discountPct / 100, 0.01)) * 100,
  ) / 100;
  // Zone serviceability: backend flags products the seller's zone can't reach.
  const notDeliverable = product.deliverable === false;

  return (
    <Wrapper
      // When pressing the product card, open Product Overview.
      onPress={onCardPress ? () => onCardPress(product) : undefined}
      activeOpacity={0.95}
      style={[styles.card, { borderColor: borderTint }]}>
      <View style={styles.imageWrap}>
        {imageError || !product.image ? (
          <View style={[styles.image, styles.imageFallback]}>
            <Icon name="image-outline" size={26} color="#CBD5E1" />
          </View>
        ) : (
          <>
            {imageLoading && (
              <Animated.View
                style={[
                  styles.image,
                  styles.skeleton,
                  { opacity: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }) },
                ]}
              />
            )}
            <Image
              source={{ uri: sizedImageUrl(product.image, 200) }}
              style={[styles.image, imageLoading && styles.imageHidden]}
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
              onError={() => { setImageError(true); setImageLoading(false); }}
              fadeDuration={150}
            />
          </>
        )}
        {discountPct > 0 && !hasVariants ? (
          <View style={[styles.discountPill, { backgroundColor: accentColor }]}>
            <Text style={styles.discountPillText}>{Math.round(discountPct)}% off</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[
            styles.favoriteIcon,
            { backgroundColor: favBg },
            isFavorite && { backgroundColor: accentColor },
          ]}
          onPress={e => {
            e.stopPropagation?.();
            toggle(product.id);
          }}
          activeOpacity={0.9}>
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? '#FFFFFF' : accentColor}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.brand} numberOfLines={1}>
        {product.brand ?? 'Trusted brand'}
      </Text>
      {onNamePress ? (
        <TouchableOpacity
          onPress={e => {
            e.stopPropagation?.();
            onNamePress(product);
          }}
          activeOpacity={0.85}>
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
      )}
      {hasVariants ? (
        <View style={styles.priceBlock}>
          <Text style={styles.variantHint}>Multiple variants</Text>
        </View>
      ) : (
        <View style={styles.priceBlock}>
          {opts && opts.length > 1 ? (
            <Text style={styles.fromHint}>From</Text>
          ) : null}
          <View style={styles.priceLine}>
            <Text style={styles.price}>Rs {formatRs(displayPrice)}</Text>
            {originalPrice > displayPrice + 0.001 ? (
              <Text style={styles.mrp}>Rs {formatRs(originalPrice)}</Text>
            ) : null}
          </View>
        </View>
      )}
      {showTierChips ? (
        <View style={styles.tierRow}>
          {opts!.map(opt => {
            const selected = opt.key === tierKey;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.tierChip,
                  {
                    borderColor: selected ? accentColor : '#E2E8F0',
                    backgroundColor: selected ? `${accentColor}18` : '#F8FAFC',
                  },
                ]}
                onPress={e => {
                  e.stopPropagation?.();
                  setTierKey(opt.key);
                }}
                activeOpacity={0.9}>
                <Text
                  style={[
                    styles.tierChipText,
                    { color: selected ? accentColor : '#64748B' },
                  ]}
                  numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <View style={styles.actionRow}>
        {notDeliverable ? (
          <View style={styles.notDeliverable}>
            <Icon name="map-marker-off-outline" size={14} color="#94A3B8" />
            <Text style={styles.notDeliverableText}>Not in your area</Text>
          </View>
        ) : displayQty <= 0 ? (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: mutating ? hexToRgba(accentColor, 0.6) : accentColor }]}
            disabled={mutating}
            onPress={e => {
              e.stopPropagation?.();
              if (addMutatingRef.current || mutating) return;
              if (hasVariants) {
                setVariantModalVisible(true);
              } else if (multiTier && totalQtyAllTiers === 0) {
                setTierModalVisible(true);
              } else {
                addMutatingRef.current = true;
                // Optimistic: compute the same safeQuantity logic as useCart.add
                const minOrder = Math.max(1, Math.trunc(Number(product.minOrderQuantity) || 1));
                const pcs = Math.max(1, product.piecesPerSet ?? 1);
                const isNaturalSet =
                  pcs > 1 && (product.unit || 'piece').toLowerCase() !== 'piece';
                const minLineQty =
                  tierKey === 'set' || tierKey === 'remaining' || isNaturalSet
                    ? 1
                    : minOrder;
                setLocalQty(minLineQty);
                setMutating(true);
                Promise.resolve(onAdd(product, tierKey))
                  .catch(() => {
                    setLocalQty(null);
                    setMutating(false);
                  })
                  .finally(() => {
                    addMutatingRef.current = false;
                  });
              }
            }}
            activeOpacity={0.92}>
            {mutating ? (
              <Icon name="loading" size={16} color="#FFFFFF" />
            ) : (
              <Icon name="cart-plus" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.addButtonText}>{mutating ? '...' : 'Add'}</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.stepperShell,
              {
                borderColor: hexToRgba(accentColor, 0.35),
                backgroundColor: hexToRgba(accentColor, 0.06),
              },
            ]}>
            <View style={styles.stepSideCol}>
              <TouchableOpacity
                style={styles.stepSideHit}
                disabled={mutating || !cartLineForCard}
                onPress={e => {
                  e.stopPropagation?.();
                  if (mutating || !cartLineForCard) return;
                  const dPcs = Math.max(1, product.piecesPerSet ?? 1);
                  const dMinO = Math.max(1, Math.trunc(Number(product.minOrderQuantity) || 1));
                  const dIsNaturalSet =
                    dPcs > 1 && (product.unit || 'piece').toLowerCase() !== 'piece';
                  const tier = cartLineForCard.priceOptionKey;
                  const dStep =
                    cartLineForCard.variantId || tier === 'set' || tier === 'remaining' || dIsNaturalSet
                      ? 1
                      : dPcs > 1 ? dPcs
                        : dMinO > 1 && productImpliesSetPurchase(product) ? dMinO : 1;
                  const nextQty = Math.max(0, displayQty - dStep);
                  setLocalQty(nextQty);
                  setMutating(true);
                  decrement(product.id, cartLineForCard.priceOptionKey, cartLineForCard.variantId)
                    .catch(() => {
                      setLocalQty(rawLineQty);
                      setMutating(false);
                    })
                    .finally(() => {
                      // For deletes (nextQty === 0), keep the Add button disabled until
                      // the cart cache refreshes — the rawLineQty useEffect clears
                      // mutating once RTK refetches, preventing a POST with qty<minOrder
                      // on a stale cache hit.
                      if (nextQty > 0) setMutating(false);
                    });
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}>
                <Icon name="minus" size={16} color={(mutating || !cartLineForCard) ? '#CBD5E1' : accentColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.stepQtySlot}>
              <Text
                style={[styles.stepQty, { color: '#0F172A' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}>
                {cartLineForCard
                  ? stepperQuantityCaptionForCartLine(
                      product,
                      displayQty,
                      cartLineForCard.priceOptionKey,
                    )
                  : stepperQuantityCaptionForCartLine(product, displayQty, tierKey)}
              </Text>
            </View>
            <View style={styles.stepSideCol}>
              <TouchableOpacity
                style={styles.stepSideHit}
                disabled={mutating || !cartLineForCard}
                onPress={e => {
                  e.stopPropagation?.();
                  if (mutating || !cartLineForCard) return;
                  const tPcs = Math.max(1, product.piecesPerSet ?? 1);
                  const tMinO = Math.max(1, Math.trunc(Number(product.minOrderQuantity) || 1));
                  const tIsNaturalSet =
                    tPcs > 1 && (product.unit || 'piece').toLowerCase() !== 'piece';
                  const tier = cartLineForCard.priceOptionKey;
                  const step =
                    cartLineForCard.variantId || tier === 'set' || tier === 'remaining' || tIsNaturalSet
                      ? 1
                      : tPcs > 1 ? tPcs
                        : tMinO > 1 && productImpliesSetPurchase(product) ? tMinO : 1;
                  const stock = product.stockQuantity;
                  const maxQty = stock !== undefined && stock > 0 ? stock : 99;
                  const nextQty = Math.min(displayQty + step, maxQty);
                  if (nextQty === displayQty) return;
                  setLocalQty(nextQty);
                  setMutating(true);
                  increment(product.id, tier, cartLineForCard.variantId)
                    .catch(() => setLocalQty(rawLineQty))
                    .finally(() => setMutating(false));
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}>
                <Text style={[styles.stepPlusGlyph, { color: (mutating || !cartLineForCard) ? '#CBD5E1' : accentColor }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      <AddPriceTierModal
        visible={tierModalVisible}
        onClose={() => setTierModalVisible(false)}
        product={product}
        accentColor={accentColor}
        onSelectTier={tier => {
          if (addMutatingRef.current || mutating) return;
          addMutatingRef.current = true;
          setTierKey(tier);
          setLocalQty(1);
          setMutating(true);
          Promise.resolve(onAdd(product, tier))
            .catch(() => { setLocalQty(null); setMutating(false); })
            .finally(() => { addMutatingRef.current = false; });
        }}
      />
      <SelectVariantModal
        visible={variantModalVisible}
        onClose={() => setVariantModalVisible(false)}
        product={product}
        accentColor={accentColor}
        onSelectVariant={variant => {
          if (addMutatingRef.current || mutating) return;
          addMutatingRef.current = true;
          setLocalQty(1);
          setMutating(true);
          Promise.resolve(onAdd(product, tierKey, variant.id))
            .catch(() => { setLocalQty(null); setMutating(false); })
            .finally(() => { addMutatingRef.current = false; });
        }}
      />
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    paddingBottom: 11,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 108,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#E2E8F0',
  },
  imageHidden: {
    opacity: 0,
  },
  discountPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '72%',
  },
  discountPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  favoriteIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  favoriteIconActive: {
    backgroundColor: '#1D4ED8',
  },
  brand: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.15,
    textTransform: 'uppercase',
  },
  name: {
    marginTop: 3,
    color: '#0F172A',
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 7,
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  metaPill: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaPillText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '800',
  },
  fromHint: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: -2,
  },
  variantHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    fontStyle: 'italic',
  },
  priceBlock: {
    marginTop: 6,
    gap: 2,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  price: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  mrp: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  packHintPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  packHintPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.15,
  },
  tierRow: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionRow: {
    marginTop: 9,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  notDeliverable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notDeliverableText: { color: '#94A3B8', fontWeight: '800', fontSize: 12 },
  /**
   * Full-width row; middle uses minWidth 0 so flex can shrink and the side
   * columns (fixed width) are never clipped by overflow:hidden.
   */
  stepperShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /** Narrow rails — more room for qty text (“1 set”) in 2-col grid. */
  stepSideCol: {
    width: 30,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepSideHit: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepPlusGlyph: {
    fontSize: 17,
    fontWeight: '400',
    marginTop: -1,
    lineHeight: 20,
  },
  stepQtySlot: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  stepQty: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0,
    maxWidth: '100%',
    includeFontPadding: false,
  },
});

export default ProductCard;
