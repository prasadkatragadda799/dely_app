import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOrders } from '../../../hooks/useOrders';
import { themes } from '../../../utils/theme';
import { DeliveryTabParamList } from '../../../navigation/types';

const AssignedOrdersScreen = () => {
  const { assigned, ongoing, history, setStatus } = useOrders();
  const navigation = useNavigation<BottomTabNavigationProp<DeliveryTabParamList>>();

  const openOrderRoute = async (orderId: string) => {
    // “Accept” => mark picked up in backend, which maps to `picked` in UI.
    await setStatus(orderId, 'picked');
    navigation.navigate('Ongoing');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assigned Orders</Text>
        <Text style={styles.subtitle}>Accept quickly to boost completion score</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{assigned.length}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ongoing.length}</Text>
          <Text style={styles.statLabel}>Ongoing</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{history.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <FlatList
        data={assigned}
        keyExtractor={item => item.id}
        contentContainerStyle={assigned.length === 0 ? styles.emptyWrap : styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.customer}>{item.customerName}</Text>
                <Text style={styles.orderId}>Order {item.id}</Text>
              </View>
              <View style={styles.statusPill}>
                <Icon name="clock-outline" size={13} color="#166534" />
                <Text style={styles.statusPillText}>Assigned</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Icon name="map-marker-outline" size={16} color="#15803D" />
              <Text style={styles.meta}>{item.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="basket-outline" size={16} color="#15803D" />
              <Text style={styles.meta}>{item.itemsSummary}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="currency-inr" size={16} color="#15803D" />
              <Text style={styles.amount}>Rs {item.amount}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.ghostButton}
                activeOpacity={0.9}
                onPress={() => openOrderRoute(item.id)}>
                <Text style={styles.ghostButtonText}>View route</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => openOrderRoute(item.id)}>
                <Text style={styles.buttonText}>Accept order</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Icon name="clipboard-check-outline" size={24} color="#16A34A" />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.empty}>No assigned orders right now</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 14, backgroundColor: themes.delivery.accent },
  header: { marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#14532D' },
  subtitle: { marginTop: 3, color: '#15803D', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { color: '#14532D', fontWeight: '900', fontSize: 18 },
  statLabel: { color: '#15803D', fontWeight: '700', fontSize: 11, marginTop: 1 },
  listContent: { paddingBottom: 16 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: { fontWeight: '900', fontSize: 16, color: '#14532D' },
  orderId: { color: '#166534', marginTop: 2, fontWeight: '600', fontSize: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  meta: { color: '#166534', marginLeft: 6, flex: 1 },
  amount: { color: '#14532D', marginLeft: 6, fontWeight: '900' },
  actionRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  ghostButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F0FDF4',
  },
  ghostButtonText: { color: '#166534', fontWeight: '800' },
  button: {
    flex: 1.3,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  emptyCard: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    paddingVertical: 26,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 8, color: '#14532D', fontSize: 16, fontWeight: '900' },
  empty: { color: '#166534', marginTop: 4 },
});

export default AssignedOrdersScreen;
