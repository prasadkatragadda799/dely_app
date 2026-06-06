import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../../../hooks/redux';
import { palette, radius, shadow, getDivision } from '../../../utils/theme';

const OrderSuccessScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const div = getDivision(homeDivision);
  const primary = div.primary;
  const primaryText = div.primaryDeep;

  const orderId = route.params?.orderId;
  const amount = route.params?.amount ?? 0;
  const provider = route.params?.provider ?? 'Online';

  useEffect(() => {
    if (!orderId) {
      navigation.replace('Orders');
    }
  }, [orderId, navigation]);

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: primary }, shadow.accent(primary)]}>
        <Icon name="check-bold" size={40} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { color: primaryText }]}>Order Successful</Text>
      <Text style={styles.subtitle}>Your order has been placed and is being prepared.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Order ID</Text>
          <Text style={styles.value}>{orderId ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Amount Paid</Text>
          <Text style={styles.value}>Rs {amount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Paid via</Text>
          <Text style={styles.value}>{provider}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primary }, shadow.accent(primary)]}
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'CartMain' }],
          })
        }
        activeOpacity={0.92}>
        <Text style={styles.buttonText}>Back to Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  circle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#64748B',
    fontWeight: '600',
    maxWidth: 280,
  },
  summaryCard: {
    marginTop: 22,
    width: '100%',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: palette.muted, fontWeight: '700' },
  value: { color: palette.ink, fontWeight: '900', flex: 1, textAlign: 'right', marginLeft: 8 },
  button: {
    marginTop: 20,
    borderRadius: radius.md,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});

export default OrderSuccessScreen;
