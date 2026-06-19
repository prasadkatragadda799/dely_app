import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Product, ProductVariant } from '../../types';
import { formatRs } from '../../utils/formatMoney';
import { composeVariantPackagingFromApi } from '../../features/products/api/schemas';

type Props = {
  visible: boolean;
  onClose: () => void;
  product: Product;
  accentColor: string;
  onSelectVariant: (variant: ProductVariant) => void;
};

const variantLabel = (v: ProductVariant, idx: number): string => {
  const composed = composeVariantPackagingFromApi(v as any);
  if (composed && composed.trim()) return composed.trim();
  if (v.weight && v.weight.trim()) return v.weight.trim();
  if (v.packagingLabel && v.packagingLabel.trim()) return v.packagingLabel.trim();
  return `Option ${idx + 1}`;
};

const SelectVariantModal = ({
  visible,
  onClose,
  product,
  accentColor,
  onSelectVariant,
}: Props) => {
  const variants = (product.variants ?? []).filter(
    v => v.id && (v.specialPrice != null || v.mrp != null),
  );
  if (variants.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Choose a variant</Text>
          <Text style={styles.subtitle}>
            Select which option you'd like to add to your cart.
          </Text>
          <ScrollView
            style={styles.optionScroll}
            contentContainerStyle={styles.optionList}
            showsVerticalScrollIndicator={false}>
            {variants.map((v, idx) => {
              const sell = Number(v.specialPrice ?? v.mrp ?? 0);
              const mrp = Number(v.mrp ?? sell);
              const disc = Number(
                v.discountPercentage ?? (mrp > sell ? ((mrp - sell) / mrp) * 100 : 0),
              );
              const label = variantLabel(v, idx);
              return (
                <TouchableOpacity
                  key={v.id ?? `v-${idx}`}
                  style={[styles.optionBtn, { borderColor: `${accentColor}55` }]}
                  onPress={() => {
                    onSelectVariant(v);
                    onClose();
                  }}
                  activeOpacity={0.92}>
                  <View style={styles.optionTextCol}>
                    <Text style={[styles.optionLabel, { color: accentColor }]}>
                      {label}
                    </Text>
                    {mrp > sell ? (
                      <Text style={styles.optionHint}>
                        MRP Rs {formatRs(mrp)}
                        {disc > 0 ? `  ·  ${Math.round(disc)}% off` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionPrice}>Rs {formatRs(sell)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={styles.cancelBtn}
            hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 20,
  },
  optionScroll: {
    marginTop: 18,
    flexGrow: 0,
  },
  optionList: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionHint: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  optionPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});

export default SelectVariantModal;
