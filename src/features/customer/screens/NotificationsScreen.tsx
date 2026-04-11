import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../hooks/redux';
import {
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useReadAllNotificationsMutation,
  useReadNotificationMutation,
} from '../../../services/api/mobileApi';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
};

function iconForType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('order')) return 'package-variant';
  if (t.includes('promo') || t.includes('offer')) return 'tag-outline';
  if (t.includes('payment')) return 'credit-card-outline';
  if (t.includes('delivery')) return 'truck-outline';
  return 'bell-outline';
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function normalizeList(envelope: unknown): {
  items: NotificationRow[];
  unreadCount: number;
} {
  const root = envelope as { data?: unknown } | undefined;
  const payload = root?.data as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== 'object') {
    return { items: [], unreadCount: 0 };
  }
  const raw = payload.notifications;
  const list = Array.isArray(raw) ? raw : [];
  const unreadCount =
    typeof payload.unreadCount === 'number' ? payload.unreadCount : 0;
  const items: NotificationRow[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? '').trim();
    if (!id) continue;
    items.push({
      id,
      type: String(r.type ?? 'general'),
      title: String(r.title ?? 'Notification').trim() || 'Notification',
      message: String(r.message ?? '').trim(),
      read: Boolean(r.read ?? r.is_read),
      createdAt:
        typeof r.created_at === 'string'
          ? r.created_at
          : typeof r.createdAt === 'string'
            ? r.createdAt
            : null,
    });
  }
  return { items, unreadCount };
}

const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const { alert: appAlert, confirm } = useAppAlert();
  const homeDivision = useAppSelector(s => s.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primarySoft = isHomeKitchen
    ? 'rgba(22,163,74,0.12)'
    : 'rgba(29,78,216,0.12)';
  const primaryBorder = isHomeKitchen
    ? 'rgba(22,163,74,0.25)'
    : 'rgba(29,78,216,0.25)';
  const primaryText = isHomeKitchen ? '#14532D' : '#0B3B8F';

  const { data, isLoading, isFetching, refetch, error } =
    useGetNotificationsQuery();
  const [readOne] = useReadNotificationMutation();
  const [readAll, { isLoading: markingAll }] = useReadAllNotificationsMutation();
  const [removeOne] = useDeleteNotificationMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { items, unreadCount } = useMemo(
    () => normalizeList(data as unknown),
    [data],
  );

  const onMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) {
      await appAlert({
        title: 'All caught up',
        message: 'There are no unread notifications.',
      });
      return;
    }
    try {
      await readAll().unwrap();
    } catch {
      await appAlert({
        title: 'Something went wrong',
        message: 'Could not mark notifications as read. Try again.',
      });
    }
  }, [unreadCount, readAll, appAlert]);

  const onPressRow = useCallback(
    async (n: NotificationRow) => {
      if (!n.read) {
        try {
          await readOne({ notificationId: n.id }).unwrap();
        } catch {
          // Still show content if mark-read fails
        }
      }
    },
    [readOne],
  );

  const onDelete = useCallback(
    async (n: NotificationRow) => {
      const ok = await confirm({
        title: 'Remove notification?',
        message: 'This will remove this alert from your list.',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        destructive: true,
      });
      if (!ok) return;
      setDeletingId(n.id);
      try {
        await removeOne({ notificationId: n.id }).unwrap();
      } catch {
        await appAlert({
          title: 'Could not remove',
          message: 'Please try again in a moment.',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, removeOne, appAlert],
  );

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home');

  const listEmpty =
    !isLoading && items.length === 0 ? (
      <View style={styles.emptyWrap}>
        <Icon name="bell-off-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySub}>
          Order updates, offers, and account alerts will show up here.
        </Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.headerBtn, { borderColor: primaryBorder }]}
          activeOpacity={0.9}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-left" size={22} color={primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.headerTitle, { color: primaryText }]}>
            Notifications
          </Text>
          {unreadCount > 0 ? (
            <Text style={[styles.headerBadge, { color: primary }]}>
              {unreadCount} unread
            </Text>
          ) : (
            <Text style={styles.headerSub}>You're all caught up</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => void onMarkAllRead()}
          disabled={markingAll || unreadCount === 0}
          style={[
            styles.markAllBtn,
            { borderColor: primaryBorder },
            (markingAll || unreadCount === 0) && styles.markAllBtnDisabled,
          ]}
          activeOpacity={0.88}>
          {markingAll ? (
            <ActivityIndicator size="small" color={primary} />
          ) : (
            <Text style={[styles.markAllText, { color: primary }]}>
              Mark all read
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>
            Could not load notifications. Pull to retry.
          </Text>
        </View>
      ) : null}

      {isLoading && !data ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={
            items.length === 0 ? styles.listContentEmpty : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={primary}
            />
          }
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => {
            const iconName = iconForType(item.type);
            const busy = deletingId === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    borderColor: item.read ? '#E2E8F0' : primaryBorder,
                    backgroundColor: item.read ? '#FFFFFF' : primarySoft,
                  },
                ]}
                onPress={() => void onPressRow(item)}
                activeOpacity={0.92}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: item.read ? '#F1F5F9' : '#FFFFFF' },
                  ]}>
                  <Icon name={iconName} size={22} color={primary} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text
                      style={[styles.cardTitle, { color: primaryText }]}
                      numberOfLines={2}>
                      {item.title}
                    </Text>
                    {!item.read ? (
                      <View style={[styles.unreadDot, { backgroundColor: primary }]} />
                    ) : null}
                  </View>
                  {item.message ? (
                    <Text style={styles.cardMessage} numberOfLines={4}>
                      {item.message}
                    </Text>
                  ) : null}
                  <Text style={styles.cardMeta}>
                    {formatRelativeTime(item.createdAt)}
                    {item.type ? ` · ${item.type}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => void onDelete(item)}
                  style={styles.trashBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={busy}>
                  {busy ? (
                    <ActivityIndicator size="small" color="#94A3B8" />
                  ) : (
                    <Icon name="trash-can-outline" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  headerTitleBlock: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#64748B' },
  headerBadge: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  markAllBtn: {
    maxWidth: 108,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllBtnDisabled: { opacity: 0.45 },
  markAllText: { fontSize: 11, fontWeight: '800' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
  },
  errorText: { flex: 1, color: '#991B1B', fontWeight: '600', fontSize: 13 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1, padding: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, paddingLeft: 10 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  cardMessage: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 18,
  },
  cardMeta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  trashBtn: { padding: 4, marginLeft: 4 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '900',
    color: '#334155',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
