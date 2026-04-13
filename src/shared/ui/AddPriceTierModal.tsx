import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PriceOptionKey, Product } from '../../types';
import { formatRs } from '../../utils/formatMoney';

type Props = {
  visible: boolean;
  onClose: () => void;
  product: Product;
  accentColor: string;
  title?: string;
  subtitle?: string;
  onSelectTier: (tier: PriceOptionKey) => void;
};

const AddPriceTierModal = ({
  visible,
  onClose,
  product,
  accentColor,
  title = 'Add as pieces or set?',
  subtitle = 'Pick how you want this item priced in your cart.',
  onSelectTier,
}: Props) => {
  const opts = product.priceOptions ?? [];
  if (opts.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.optionList}>
            {opts.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionBtn, { borderColor: `${accentColor}55` }]}
                onPress={() => {
                  onSelectTier(opt.key);
                  onClose();
                }}
                activeOpacity={0.92}>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionLabel, { color: accentColor }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.optionHint}>
                    {opt.key === 'set'
                      ? 'Sold as one set'
                      : opt.key === 'unit'
                        ? 'Per piece / unit'
                        : 'Clearance lot'}
                  </Text>
                </View>
                <Text style={styles.optionPrice}>Rs {formatRs(opt.sellingPrice)}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  optionList: {
    marginTop: 18,
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

export default AddPriceTierModal;
