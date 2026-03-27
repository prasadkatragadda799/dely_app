import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../../../hooks/redux';

const OrderSuccessScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';

  const orderId = route.params?.orderId ?? 'N/A';
  const amount = route.params?.amount ?? 0;
  const provider = route.params?.provider ?? 'Online';

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: primary }]}>
        <Icon name="check-bold" size={40} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { color: primaryText }]}>Order Successful</Text>
      <Text style={styles.subtitle}>Your order has been placed and is being prepared.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Order ID</Text>
          <Text style={styles.value}>{orderId}</Text>
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
        style={[styles.button, { backgroundColor: primary }]}
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#64748B', fontWeight: '700' },
  value: { color: '#0F172A', fontWeight: '900', flex: 1, textAlign: 'right', marginLeft: 8 },
  button: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});

export default OrderSuccessScreen;
