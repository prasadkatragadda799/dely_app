import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOrders } from '../../../hooks/useOrders';

const HistoryScreen = () => {
  const { history } = useOrders();
  const deliveredCount = history.filter(item => item.status === 'delivered').length;
  const cancelledCount = history.filter(item => item.status === 'cancelled').length;
  const earnings = history
    .filter(item => item.status === 'delivered')
    .reduce((acc, item) => acc + item.amount, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery History</Text>
      <Text style={styles.subtitle}>Recent trips and payout insight</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{deliveredCount}</Text>
          <Text style={styles.summaryLabel}>Delivered</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{cancelledCount}</Text>
          <Text style={styles.summaryLabel}>Cancelled</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>Rs {earnings}</Text>
          <Text style={styles.summaryLabel}>Earnings</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={history.length === 0 ? styles.emptyWrap : styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.order}>Order {item.id}</Text>
              <View
                style={[
                  styles.statusPill,
                  item.status === 'delivered' ? styles.deliveredPill : styles.cancelledPill,
                ]}>
                <Icon
                  name={item.status === 'delivered' ? 'check-circle-outline' : 'close-circle-outline'}
                  size={13}
                  color={item.status === 'delivered' ? '#166534' : '#991B1B'}
                />
                <Text
                  style={[
                    styles.statusText,
                    item.status === 'delivered' ? styles.deliveredText : styles.cancelledText,
                  ]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>{item.customerName}</Text>
            <Text style={styles.meta}>{item.address}</Text>
            <Text style={styles.amount}>Rs {item.amount}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Icon name="history" size={24} color="#16A34A" />
            <Text style={styles.emptyTitle}>No past deliveries yet</Text>
            <Text style={styles.meta}>Completed orders will appear here</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#14532D' },
  subtitle: { color: '#15803D', marginTop: 3, fontWeight: '600' },
  summaryRow: { marginTop: 12, marginBottom: 12, flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F8FFF9',
  },
  summaryValue: { color: '#14532D', fontWeight: '900', fontSize: 16 },
  summaryLabel: { color: '#15803D', fontWeight: '700', marginTop: 2, fontSize: 11 },
  listContent: { paddingBottom: 16 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  row: {
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  order: { color: '#111827', fontWeight: '800' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deliveredPill: { backgroundColor: '#DCFCE7' },
  cancelledPill: { backgroundColor: '#FEE2E2' },
  statusText: { fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
  deliveredText: { color: '#166534' },
  cancelledText: { color: '#991B1B' },
  meta: { color: '#4B5563', marginTop: 5 },
  amount: { marginTop: 6, color: '#14532D', fontWeight: '900' },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 26,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { color: '#14532D', fontWeight: '900', marginTop: 8, fontSize: 16 },
});

export default HistoryScreen;
