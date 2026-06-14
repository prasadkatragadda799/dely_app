import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOrders } from '../../../hooks/useOrders';
import { DeliveryTabParamList } from '../../../navigation/types';
import {
  useGetDeliveryMeQuery,
  useGetDeliveryReturnPickupsQuery,
  useUpdateDeliveryMeMutation,
  useToggleDeliveryAvailabilityMutation,
  useUpdateDeliveryReturnStatusMutation,
} from '../../../services/api/mobileApi';
import { Order } from '../../../types';

const GREEN = '#16A34A';
const DARK_GREEN = '#14532D';
const WHITE = '#FFFFFF';

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

const isUrgent = (iso: string): boolean => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins >= 5;
};

type ReturnPickup = {
  returnId: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  reason: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: Record<string, unknown>;
  orderTotal: number;
  paymentMethod?: string;
  createdAt: string;
};

const PURPLE = '#7C3AED';

const AssignedOrdersScreen = () => {
  const { assigned, ongoing, history, setStatus, isLoading } = useOrders();
  const navigation = useNavigation<BottomTabNavigationProp<DeliveryTabParamList>>();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [updatingReturnId, setUpdatingReturnId] = useState<string | null>(null);

  const { data: returnPickupsRes, refetch: refetchReturns } = useGetDeliveryReturnPickupsQuery();
  const [updateReturnStatus] = useUpdateDeliveryReturnStatusMutation();
  const returnPickups: ReturnPickup[] = ((returnPickupsRes?.data as any)?.returns ?? []) as ReturnPickup[];

  const handleReturnPickup = async (returnId: string, nextStatus: 'picked_up' | 'received_at_hub') => {
    setUpdatingReturnId(returnId);
    try {
      await updateReturnStatus({ returnId, status: nextStatus }).unwrap();
      await refetchReturns();
    } finally {
      setUpdatingReturnId(null);
    }
  };

  const { data: meRes } = useGetDeliveryMeQuery();
  // Kept import for other future uses; availability uses its own mutation.
  void useUpdateDeliveryMeMutation;
  const [toggleAvailabilityApi, { isLoading: isTogglingOnline }] =
    useToggleDeliveryAvailabilityMutation();
  const deliveryMe = meRes?.data;
  const isAvailable =
    (deliveryMe as any)?.isAvailable ??
    (deliveryMe as any)?.is_available ??
    false;

  const handleToggleOnline = async () => {
    try {
      await toggleAvailabilityApi({ available: !isAvailable }).unwrap();
    } catch {
      // silently handle
    }
  };

  const handleAccept = useCallback(
    async (orderId: string) => {
      setAcceptingId(orderId);
      try {
        await setStatus(orderId, 'picked');
        navigation.navigate('Ongoing');
      } finally {
        setAcceptingId(null);
      }
    },
    [setStatus, navigation],
  );

  const renderOrder = ({ item }: { item: Order }) => {
    const urgent = isUrgent(item.createdAt);
    const isAccepting = acceptingId === item.id;

    return (
      <View style={[styles.card, urgent && styles.cardUrgent]}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.orderId}>
              #{item.id.slice(-8).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <View style={[styles.timePill, urgent && styles.timePillUrgent]}>
              <Icon
                name="clock-outline"
                size={11}
                color={urgent ? '#92400E' : '#166534'}
              />
              <Text style={[styles.timeText, urgent && styles.timeTextUrgent]}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.infoRow}>
          <Icon name="map-marker-outline" size={15} color="#15803D" />
          <Text style={styles.infoText} numberOfLines={2}>{item.address}</Text>
        </View>

        {/* Items */}
        <View style={styles.infoRow}>
          <Icon name="basket-outline" size={15} color="#15803D" />
          <Text style={styles.infoText} numberOfLines={1}>{item.itemsSummary}</Text>
        </View>

        {/* Amount */}
        <View style={styles.infoRow}>
          <Icon name="currency-inr" size={15} color="#15803D" />
          <Text style={styles.amountText}>₹{item.amount.toLocaleString('en-IN')}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.ghostButton}
            activeOpacity={0.85}
            onPress={() => {
              const addr = encodeURIComponent(item.address || '');
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${addr}`);
            }}
            disabled={!!acceptingId}>
            <Icon name="map-outline" size={14} color="#166534" />
            <Text style={styles.ghostButtonText}>View Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, !!acceptingId && styles.acceptButtonDisabled]}
            activeOpacity={0.85}
            onPress={() => handleAccept(item.id)}
            disabled={!!acceptingId}>
            {isAccepting ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <>
                <Icon name="truck-fast-outline" size={14} color={WHITE} />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>
            {assigned.length > 0
              ? `${assigned.length} order${assigned.length > 1 ? 's' : ''} waiting`
              : 'No new orders'}
          </Text>
        </View>

        {/* Online / Offline toggle */}
        <TouchableOpacity
          style={[styles.onlinePill, isAvailable ? styles.onlinePillActive : styles.onlinePillInactive]}
          onPress={handleToggleOnline}
          activeOpacity={0.85}
          disabled={isTogglingOnline}>
          {isTogglingOnline ? (
            <ActivityIndicator size="small" color={isAvailable ? WHITE : '#374151'} />
          ) : (
            <View style={[styles.onlineDot, isAvailable ? styles.onlineDotActive : styles.onlineDotInactive]} />
          )}
          <Text style={[styles.onlineText, isAvailable ? styles.onlineTextActive : styles.onlineTextInactive]}>
            {isAvailable ? 'Online' : 'Offline'}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
            thumbColor={isAvailable ? GREEN : '#9CA3AF'}
            ios_backgroundColor="#D1D5DB"
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            disabled={isTogglingOnline}
          />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{assigned.length}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, ongoing.length > 0 && styles.statValueActive]}>
            {ongoing.length}
          </Text>
          <Text style={styles.statLabel}>Ongoing</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{history.filter(o => o.status === 'delivered').length}</Text>
          <Text style={styles.statLabel}>Done Today</Text>
        </View>
      </View>

      {/* Return pickup cards */}
      {returnPickups.length > 0 && (
        <View style={styles.listContent}>
          {returnPickups.map(ret => {
            const isUpdating = updatingReturnId === ret.returnId;
            const nextStatus = ret.status === 'pickup_assigned' ? 'picked_up' : 'received_at_hub';
            const actionLabel = ret.status === 'pickup_assigned' ? 'Picked Up' : 'Received at Hub';
            const addr = ret.deliveryAddress;
            const addressStr = typeof addr === 'object' && addr
              ? [(addr as any).address_line1, (addr as any).city, (addr as any).pincode].filter(Boolean).join(', ')
              : 'Address not available';
            return (
              <View key={ret.returnId} style={styles.returnCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.returnCustomerName}>{ret.customerName}</Text>
                    <Text style={styles.returnOrderId}>#{(ret.orderNumber ?? ret.orderId).slice(-8).toUpperCase()}</Text>
                  </View>
                  <View style={styles.returnBadge}>
                    <Icon name="package-variant-remove" size={11} color={PURPLE} />
                    <Text style={styles.returnBadgeText}>Return</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="map-marker-outline" size={15} color={PURPLE} />
                  <Text style={styles.infoText} numberOfLines={2}>{addressStr}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="text-box-outline" size={15} color={PURPLE} />
                  <Text style={styles.infoText} numberOfLines={2}>{ret.reason}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="currency-inr" size={15} color={PURPLE} />
                  <Text style={[styles.amountText, { color: PURPLE }]}>₹{ret.orderTotal.toLocaleString('en-IN')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.returnActionBtn, isUpdating && styles.acceptButtonDisabled]}
                  onPress={() => handleReturnPickup(ret.returnId, nextStatus as 'picked_up' | 'received_at_hub')}
                  disabled={isUpdating}
                  activeOpacity={0.85}>
                  {isUpdating
                    ? <ActivityIndicator size="small" color={WHITE} />
                    : <><Icon name="check-circle-outline" size={14} color={WHITE} /><Text style={styles.returnActionBtnText}>{actionLabel}</Text></>
                  }
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <FlatList
        data={assigned}
        keyExtractor={item => item.id}
        renderItem={renderOrder}
        contentContainerStyle={
          assigned.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {}}
            tintColor={GREEN}
            colors={[GREEN]}
          />
        }
        ListEmptyComponent={
          returnPickups.length > 0 ? null : (
            <View style={styles.emptyCard}>
              <Icon name="clipboard-check-outline" size={40} color="#BBF7D0" />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyMeta}>
                {isAvailable
                  ? 'No new orders assigned yet. Pull down to refresh.'
                  : 'You are offline. Go online to receive orders.'}
              </Text>
              {!isAvailable && (
                <TouchableOpacity
                  style={styles.goOnlineButton}
                  onPress={handleToggleOnline}
                  activeOpacity={0.85}>
                  <Icon name="wifi" size={16} color={WHITE} />
                  <Text style={styles.goOnlineText}>Go Online</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '900', color: DARK_GREEN },
  subtitle: { marginTop: 2, color: '#15803D', fontWeight: '600', fontSize: 13 },

  // Online pill
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  onlinePillActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  onlinePillInactive: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineDotActive: { backgroundColor: GREEN },
  onlineDotInactive: { backgroundColor: '#9CA3AF' },
  onlineText: { fontWeight: '800', fontSize: 13 },
  onlineTextActive: { color: DARK_GREEN },
  onlineTextInactive: { color: '#4B5563' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statValue: { color: DARK_GREEN, fontWeight: '900', fontSize: 20 },
  statValueActive: { color: '#1D4ED8' },
  statLabel: { color: '#15803D', fontWeight: '700', fontSize: 11, marginTop: 1 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },

  // Order card
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardUrgent: { borderColor: '#FCD34D', borderWidth: 1.5 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardHeaderLeft: { flex: 1 },
  cardHeaderRight: {},
  customerName: { fontWeight: '900', fontSize: 16, color: DARK_GREEN },
  orderId: { color: '#166534', marginTop: 2, fontWeight: '600', fontSize: 12 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timePillUrgent: { backgroundColor: '#FEF3C7' },
  timeText: { color: '#166534', fontSize: 11, fontWeight: '700' },
  timeTextUrgent: { color: '#92400E' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 6 },
  infoText: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  amountText: { color: DARK_GREEN, fontWeight: '900', fontSize: 14 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ghostButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingVertical: 11,
    backgroundColor: '#F0FDF4',
  },
  ghostButtonText: { color: '#166534', fontWeight: '800', fontSize: 13 },
  acceptButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GREEN,
    paddingVertical: 11,
    borderRadius: 10,
  },
  acceptButtonDisabled: { opacity: 0.65 },
  acceptButtonText: { color: WHITE, fontWeight: '900', fontSize: 13 },

  // Empty state
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 8,
  },
  emptyTitle: { marginTop: 4, color: DARK_GREEN, fontSize: 18, fontWeight: '900' },
  emptyMeta: {
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    fontSize: 13,
  },
  goOnlineButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  goOnlineText: { color: WHITE, fontWeight: '900', fontSize: 14 },

  // Return pickup card
  returnCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  returnCustomerName: { fontWeight: '900', fontSize: 16, color: '#4C1D95' },
  returnOrderId: { color: '#7C3AED', marginTop: 2, fontWeight: '600', fontSize: 12 },
  returnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  returnBadgeText: { color: '#7C3AED', fontSize: 11, fontWeight: '800' },
  returnActionBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 11,
    borderRadius: 10,
  },
  returnActionBtnText: { color: WHITE, fontWeight: '900', fontSize: 13 },
});

export default AssignedOrdersScreen;
