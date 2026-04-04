import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { packagingShortLine } from '../../utils/productPackaging';
import { useWishlist } from '../../hooks/useWishlist';

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
  onAdd: (product: Product) => void;
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

  const Wrapper = onCardPress ? TouchableOpacity : View;
  const qty = items
    .filter(i => i.product.id === product.id)
    .reduce((sum, i) => sum + i.quantity, 0);
  const opts = product.priceOptions;
  let displayPrice = product.price;
  let discountPct = product.discountPercent;
  if (opts && opts.length > 1) {
    const cheapest = opts.reduce((a, b) =>
      a.sellingPrice <= b.sellingPrice ? a : b,
    );
    displayPrice = cheapest.sellingPrice;
    discountPct = cheapest.discount ?? product.discountPercent;
  }
  const originalPrice = Math.round(
    displayPrice / Math.max(1 - discountPct / 100, 0.01),
  );
  const packHint = packagingShortLine(product);

  return (
    <Wrapper
      // When pressing the product card, open Product Overview.
      onPress={onCardPress ? () => onCardPress(product) : undefined}
      activeOpacity={0.95}
      style={[styles.card, { borderColor: borderTint }]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={styles.image} />
        <View style={[styles.discountPill, { backgroundColor: accentColor }]}>
          <Text style={styles.discountPillText}>{Math.round(discountPct)}% OFF</Text>
        </View>
      </View>
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
          color="#FFFFFF"
        />
      </TouchableOpacity>
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
        <Text style={styles.price}>Rs {displayPrice}</Text>
        <Text style={styles.mrp}>Rs {originalPrice}</Text>
      </View>
      {packHint ? (
        <Text style={[styles.packHint, { color: accentColor }]} numberOfLines={2}>
          {packHint}
        </Text>
      ) : null}
      {qty <= 0 ? (
        <TouchableOpacity
          style={[styles.stepPlus, { backgroundColor: accentColor }]}
          onPress={e => {
            e.stopPropagation?.();
            onAdd(product);
          }}>
          <Icon name="cart-plus" size={14} color="#FFFFFF" />
          <Text style={styles.stepPlusText}>Add</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[
              styles.stepBtn,
              { borderColor: accentColor, backgroundColor: '#FFFFFF' },
            ]}
            onPress={e => {
              e.stopPropagation?.();
              decrement(product.id);
            }}
            activeOpacity={0.9}>
            <Text style={[styles.stepBtnText, { color: accentColor }]}>-</Text>
          </TouchableOpacity>
          <Text style={[styles.stepQty, { color: accentColor }]}>{qty}</Text>
          <TouchableOpacity
            style={[
              styles.stepBtn,
              { borderColor: accentColor, backgroundColor: '#FFFFFF' },
            ]}
            onPress={e => {
              e.stopPropagation?.();
              onAdd(product);
            }}
            activeOpacity={0.9}>
            <Text style={[styles.stepBtnText, { color: accentColor }]}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 102,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  discountPill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  discountPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  favoriteIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  favoriteIconActive: {
    backgroundColor: '#1D4ED8',
  },
  brand: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  name: {
    marginTop: 3,
    color: '#0F172A',
    fontSize: 12,
    minHeight: 32,
    fontWeight: '800',
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
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontWeight: '900',
    color: '#0F172A',
    fontSize: 15,
  },
  mrp: {
    color: '#94A3B8',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  packHint: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
  },
  stepper: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stepPlus: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepPlusText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, marginLeft: 4 },
  stepBtn: {
    width: 30,
    height: 28,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontWeight: '900', fontSize: 16 },
  stepQty: {
    width: 26,
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 13,
    marginHorizontal: 6,
  },
});

export default ProductCard;
