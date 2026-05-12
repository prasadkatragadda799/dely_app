import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOrders } from '../../../hooks/useOrders';
import { useGetDeliveryDashboardSummaryQuery } from '../../../services/api/mobileApi';
import { Order } from '../../../types';

const DARK_GREEN = '#14532D';
const GREEN = '#16A34A';
const WHITE = '#FFFFFF';

const formatCurrency = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const HistoryScreen = () => {
  const { history, isLoading } = useOrders();
  const { data: dashboardRes } = useGetDeliveryDashboardSummaryQuery();
  const dashboard = dashboardRes?.data;

  const delivered = history.filter(o => o.status === 'delivered');
  const cancelled = history.filter(o => o.status === 'cancelled');
  const totalEarnings = delivered.reduce((sum, o) => sum + o.amount, 0);

  const renderItem = ({ item }: { item: Order }) => {
    const isDelivered = item.status === 'delivered';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.orderId}>
              #{item.id.slice(-8).toUpperCase()}
            </Text>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              isDelivered ? styles.statusPillDelivered : styles.statusPillCancelled,
            ]}>
            <Icon
              name={isDelivered ? 'check-circle-outline' : 'close-circle-outline'}
              size={12}
              color={isDelivered ? '#166534' : '#991B1B'}
            />
            <Text
              style={[
                styles.statusText,
                isDelivered ? styles.statusTextDelivered : styles.statusTextCancelled,
              ]}>
              {isDelivered ? 'Delivered' : 'Cancelled'}
            </Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <Icon name="account-outline" size={14} color="#6B7280" />
          <Text style={styles.customerName}>{item.customerName}</Text>
        </View>
        <View style={styles.addressRow}>
          <Icon name="map-marker-outline" size={14} color="#6B7280" />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>

        {isDelivered && (
          <View style={styles.earningRow}>
            <Icon name="currency-inr" size={14} color={GREEN} />
            <Text style={styles.earningText}>{formatCurrency(item.amount)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Your past deliveries</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Icon name="currency-inr" size={20} color={GREEN} />
          <Text style={styles.summaryValue}>{formatCurrency(totalEarnings)}</Text>
          <Text style={styles.summaryLabel}>Total Earned</Text>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="truck-check-outline" size={20} color={GREEN} />
          <Text style={styles.summaryValue}>{delivered.length}</Text>
          <Text style={styles.summaryLabel}>Delivered</Text>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="truck-remove-outline" size={20} color="#EF4444" />
          <Text style={[styles.summaryValue, cancelled.length > 0 && styles.summaryValueRed]}>
            {cancelled.length}
          </Text>
          <Text style={styles.summaryLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Today's earnings from dashboard */}
      {!!dashboard && (
        <View style={styles.todayBanner}>
          <Icon name="calendar-today" size={16} color={GREEN} />
          <Text style={styles.todayText}>
            Today: {formatCurrency(dashboard.todayEarnings ?? 0)} · {dashboard.completedTodayCount ?? 0} deliveries
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : (
      <FlatList
        data={history}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          history.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Icon name="history" size={40} color="#BBF7D0" />
            <Text style={styles.emptyTitle}>No deliveries yet</Text>
            <Text style={styles.emptyMeta}>Completed orders will appear here</Text>
          </View>
        }
      />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '900', color: DARK_GREEN },
  subtitle: { color: '#15803D', fontWeight: '600', fontSize: 13, marginTop: 2 },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryValue: { fontWeight: '900', fontSize: 16, color: DARK_GREEN },
  summaryValueRed: { color: '#DC2626' },
  summaryLabel: { color: '#6B7280', fontWeight: '600', fontSize: 10, textAlign: 'center' },

  // Today banner
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  todayText: { color: DARK_GREEN, fontWeight: '700', fontSize: 13 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },

  // Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: { gap: 2 },
  orderId: { fontWeight: '800', fontSize: 14, color: '#111827' },
  dateText: { color: '#9CA3AF', fontSize: 11, fontWeight: '500' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillDelivered: { backgroundColor: '#DCFCE7' },
  statusPillCancelled: { backgroundColor: '#FEE2E2' },
  statusText: { fontWeight: '800', fontSize: 11 },
  statusTextDelivered: { color: '#166534' },
  statusTextCancelled: { color: '#991B1B' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { color: '#374151', fontWeight: '600', fontSize: 13 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { flex: 1, color: '#6B7280', fontSize: 12 },
  earningRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  earningText: { color: GREEN, fontWeight: '900', fontSize: 14 },

  // Empty
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  emptyTitle: { fontWeight: '900', fontSize: 18, color: DARK_GREEN, marginTop: 6 },
  emptyMeta: { color: '#6B7280', fontSize: 13 },
});

export default HistoryScreen;
