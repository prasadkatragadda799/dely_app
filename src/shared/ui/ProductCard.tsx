import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PriceOptionKey, Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import {
  packagingShortLine,
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
  onAdd: (product: Product, tier: PriceOptionKey) => void;
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
  const { items, decrement } = useCart();
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
    const lines = items.filter(i => i.product.id === product.id);
    const exact = lines.find(i => i.priceOptionKey === tierKey);
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
  const discountPct = activeOpt?.discount ?? product.discountPercent;
  const multiTier = (opts?.length ?? 0) > 1;
  /** After the first line exists, chips switch which tier the stepper edits. */
  const showTierChips = multiTier && totalQtyAllTiers > 0;
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const originalPrice = Math.round(
    (displayPrice / Math.max(1 - discountPct / 100, 0.01)) * 100,
  ) / 100;
  const packHint = packagingShortLine(product);

  return (
    <Wrapper
      // When pressing the product card, open Product Overview.
      onPress={onCardPress ? () => onCardPress(product) : undefined}
      activeOpacity={0.95}
      style={[styles.card, { borderColor: borderTint }]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={styles.image} />
        {discountPct > 0 ? (
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
      <View style={styles.metaRow}>
        {product.isVeg !== undefined ? (
          <View style={styles.metaPill}>
            <Icon
              name={product.isVeg ? 'leaf' : 'food-drumstick-outline'}
              size={11}
              color={accentColor}
            />
            <Text style={[styles.metaPillText, { color: accentColor }]}>
              {product.isVeg ? 'Veg' : 'Non-veg'}
            </Text>
          </View>
        ) : null}
        {product.etaMinutes !== undefined ? (
          <View style={styles.metaPill}>
            <Icon name="clock-outline" size={11} color={accentColor} />
            <Text style={[styles.metaPillText, { color: accentColor }]}>
              {product.etaMinutes} min
            </Text>
          </View>
        ) : null}
      </View>
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
      {packHint ? (
        <View style={styles.packHintPill}>
          <Text style={styles.packHintPillText} numberOfLines={2}>
            {packHint}
          </Text>
        </View>
      ) : null}
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
        {rawLineQty <= 0 ? (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: accentColor }]}
            onPress={e => {
              e.stopPropagation?.();
              if (multiTier && totalQtyAllTiers === 0) {
                setTierModalVisible(true);
              } else {
                onAdd(product, tierKey);
              }
            }}
            activeOpacity={0.92}>
            <Icon name="cart-plus" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
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
                onPress={e => {
                  e.stopPropagation?.();
                  if (cartLineForCard) {
                    decrement(product.id, cartLineForCard.priceOptionKey);
                  }
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}>
                <Icon name="minus" size={16} color={accentColor} />
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
                      cartLineForCard.quantity,
                      cartLineForCard.priceOptionKey,
                    )
                  : ''}
              </Text>
            </View>
            <View style={styles.stepSideCol}>
              <TouchableOpacity
                style={styles.stepSideHit}
                onPress={e => {
                  e.stopPropagation?.();
                  onAdd(
                    product,
                    cartLineForCard?.priceOptionKey ?? tierKey,
                  );
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}>
                <Text style={[styles.stepPlusGlyph, { color: accentColor }]}>+</Text>
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
          setTierKey(tier);
          onAdd(product, tier);
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    marginTop: 10,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.15,
    textTransform: 'uppercase',
  },
  name: {
    marginTop: 4,
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
  priceBlock: {
    marginTop: 8,
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
    marginTop: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 96,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.2,
  },
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
