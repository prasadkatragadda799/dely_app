import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppSelector } from '../../../hooks/redux';
import {
  useCancelOrderApiMutation,
  useGetOrderInvoiceQuery,
  useGetOrdersQuery,
} from '../../../services/api/mobileApi';

type UiOrder = {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  itemsSummary: string;
  createdAt?: string;
  address: string;
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .trim()
    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());

const normalizeStatus = (status: unknown) => {
  const raw = (status ?? 'pending').toString().toLowerCase().trim();
  if (raw === 'canceled') return 'cancelled';
  return raw;
};

const statusColor = (status: string) => {
  if (['delivered', 'completed'].includes(status)) return '#16A34A';
  if (['cancelled', 'failed'].includes(status)) return '#DC2626';
  if (['out_for_delivery', 'shipped', 'in_transit'].includes(status)) return '#2563EB';
  return '#D97706';
};

const statusStep = (status: string) => {
  if (['pending'].includes(status)) return 1;
  if (['confirmed', 'processing'].includes(status)) return 2;
  if (['shipped', 'out_for_delivery', 'in_transit'].includes(status)) return 3;
  if (['delivered', 'completed'].includes(status)) return 4;
  return 0;
};

const canCustomerCancel = (status: string) =>
  ['pending', 'confirmed', 'processing'].includes(status);

const buildItemsSummary = (items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) return 'Items not available';
  const list = items.slice(0, 2).map((it: any) => {
    const name = it?.productName ?? it?.product_name ?? it?.name ?? 'Item';
    const qty = it?.quantity;
    return qty !== undefined ? `${name} x ${qty}` : name;
  });
  const remaining = items.length - list.length;
  return remaining > 0 ? `${list.join(', ')} +${remaining} more` : list.join(', ');
};

const buildItemsSummaryFromCount = (itemsCount: unknown) => {
  const count = Number(itemsCount ?? 0);
  if (!Number.isFinite(count)) return 'Items details pending';
  if (count <= 0) return 'Items details pending';
  return count === 1 ? '1 item' : `${count} items`;
};

const deriveAddress = (deliveryAddress: unknown): string => {
  if (!deliveryAddress) return '';
  if (typeof deliveryAddress === 'string') return deliveryAddress;
  const d = deliveryAddress as Record<string, unknown>;
  const line1 =
    (d.address_line1 as string | undefined) ??
    (d.addressLine1 as string | undefined) ??
    (d.address as string | undefined) ??
    '';
  const city = d.city as string | undefined;
  const state = d.state as string | undefined;
  const pincode = (d.pincode as string | undefined) ?? (d.pin_code as string | undefined);
  return [line1, [city, state, pincode].filter(Boolean).join(', ')].filter(Boolean).join(', ');
};

const formatDate = (iso?: string) => {
  if (!iso) return 'Date not available';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return date.toLocaleString();
};

const OrdersScreen = () => {
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [invoiceOrderId, setInvoiceOrderId] = React.useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = React.useState<string | null>(null);

  const { data, isFetching, isLoading, refetch } = useGetOrdersQuery();
  const [cancelOrder] = useCancelOrderApiMutation();
  const {
    data: invoiceRes,
    isFetching: isInvoiceLoading,
  } = useGetOrderInvoiceQuery(
    { orderId: invoiceOrderId ?? '' },
    { skip: !invoiceOrderId },
  );

  const orders = useMemo<UiOrder[]>(() => {
    const payload = data?.data as any;
    const rawOrders = (
      Array.isArray(payload)
        ? payload
        : payload?.items ?? payload?.orders ?? payload?.data ?? []
    ) as any[];

    return rawOrders.map(o => ({
      id: (o?.id ?? o?._id ?? '').toString(),
      orderNumber: (o?.order_number ?? o?.orderNumber ?? '').toString() || undefined,
      status: normalizeStatus(o?.status),
      totalAmount: Number(o?.totalAmount ?? o?.total_amount ?? o?.total ?? o?.amount ?? 0),
      itemsSummary:
        Array.isArray(o?.items) && o.items.length > 0
          ? buildItemsSummary(o.items)
          : buildItemsSummaryFromCount(o?.items_count ?? o?.itemsCount),
      createdAt: o?.createdAt ?? o?.created_at ?? o?.createdAtUtc,
      address:
        deriveAddress(
          o?.deliveryAddress ??
            o?.delivery_address ??
            o?.address ??
            o?.shipping_address ??
            o?.delivery_location,
        ) ||
        (o?.delivery_address_text as string | undefined) ||
        (o?.deliveryAddressText as string | undefined) ||
        'Address will be available after order confirmation',
    }));
  }, [data]);
  const invoice = (invoiceRes?.data ?? null) as any;
  const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : [];
  const invoiceTaxDetails = Array.isArray(invoice?.tax_details) ? invoice.tax_details : [];
  const formatMoney = (value: unknown) => `Rs ${Number(value ?? 0).toFixed(2)}`;
  const invoiceDate = invoice?.invoice_date
    ? formatDate(invoice.invoice_date)
    : 'Date not available';

  const confirmCancelOrder = (order: UiOrder) => {
    Alert.alert(
      'Cancel order?',
      `Cancel order #${(order.orderNumber ?? order.id).slice(-12)}? This cannot be undone.`,
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            setCancellingOrderId(order.id);
            try {
              await cancelOrder({ orderId: order.id }).unwrap();
              Alert.alert('Order cancelled', 'Your order has been cancelled.');
            } catch (err: unknown) {
              const msg =
                typeof err === 'object' &&
                err !== null &&
                'data' in err &&
                typeof (err as { data?: { message?: string } }).data?.message === 'string'
                  ? (err as { data: { message: string } }).data.message
                  : 'Could not cancel this order. It may already be on the way.';
              Alert.alert('Unable to cancel', msg);
            } finally {
              setCancellingOrderId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: tabBarHeight + insets.bottom + 26 },
        ]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>Track your order progress in real time</Text>
        </View>

        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={styles.loaderText}>Loading your orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="package-variant-closed" size={36} color="#64748B" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>Place an order to start tracking delivery updates.</Text>
          </View>
        ) : (
          orders.map(order => {
            const step = statusStep(order.status);
            const color = statusColor(order.status);
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.orderId}>
                    Order #{(order.orderNumber ?? order.id).slice(-12)}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}66` }]}>
                    <Text style={[styles.statusPillText, { color }]}>{toTitleCase(order.status)}</Text>
                  </View>
                </View>

                <Text style={styles.orderMeta}>{order.itemsSummary}</Text>
                <Text style={styles.orderMeta}>Delivery: {order.address}</Text>
                <Text style={styles.orderMeta}>Placed: {formatDate(order.createdAt)}</Text>

                <View style={styles.rowBetween}>
                  <Text style={styles.amount}>Rs {order.totalAmount}</Text>
                  <View style={styles.actionRow}>
                    {canCustomerCancel(order.status) ? (
                      <TouchableOpacity
                        style={[
                          styles.cancelOrderBtn,
                          cancellingOrderId === order.id && styles.cancelOrderBtnDisabled,
                        ]}
                        onPress={() => confirmCancelOrder(order)}
                        disabled={cancellingOrderId === order.id}
                        activeOpacity={0.9}>
                        {cancellingOrderId === order.id ? (
                          <ActivityIndicator size="small" color="#B91C1C" />
                        ) : (
                          <>
                            <Icon name="close-circle-outline" size={14} color="#B91C1C" />
                            <Text style={styles.cancelOrderBtnText}>Cancel order</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                    {['delivered', 'completed'].includes(order.status) ? (
                      <TouchableOpacity
                        style={[styles.invoiceBtn, { borderColor: `${primary}66` }]}
                        onPress={() => setInvoiceOrderId(order.id)}
                        activeOpacity={0.9}>
                        <Icon name="file-document-outline" size={14} color={primary} />
                        <Text style={[styles.invoiceBtnText, { color: primary }]}>View invoice</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {order.status === 'cancelled' ? (
                  <Text style={styles.cancelledBanner}>This order was cancelled.</Text>
                ) : (
                  <View style={styles.trackWrap}>
                    {['Placed', 'Confirmed', 'Out for delivery', 'Delivered'].map((label, index) => {
                      const current = index + 1;
                      const done = step >= current;
                      const dotColor = done ? primary : '#CBD5E1';
                      return (
                        <View key={label} style={styles.trackStep}>
                          <View style={[styles.trackDot, { backgroundColor: dotColor }]} />
                          {current < 4 ? (
                            <View style={[styles.trackLine, { backgroundColor: step > current ? primary : '#E2E8F0' }]} />
                          ) : null}
                          <Text style={[styles.trackLabel, done && { color: '#0F172A', fontWeight: '800' }]}>
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!invoiceOrderId}
        animationType="slide"
        transparent
        onRequestClose={() => setInvoiceOrderId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invoice</Text>
              <TouchableOpacity onPress={() => setInvoiceOrderId(null)} activeOpacity={0.9}>
                <Icon name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            {isInvoiceLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={styles.loaderText}>Loading invoice...</Text>
              </View>
            ) : !invoice ? (
              <View style={styles.loaderWrap}>
                <Text style={styles.loaderText}>Invoice unavailable.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.invoiceTopRow}>
                  <Image source={require('../../../assets/dely-logo.png')} style={styles.logoBadgeImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceHeading}>Bill of Supply</Text>
                    <Text style={styles.invoiceMeta}>Order No: {invoice?.order_number ?? '-'}</Text>
                    <Text style={styles.invoiceMeta}>Invoice No: {invoice?.invoice_number ?? '-'}</Text>
                    <Text style={styles.invoiceMeta}>Invoice Date: {invoiceDate}</Text>
                    <Text style={styles.invoiceMeta}>Supply Type: {invoice?.supply_type ?? '-'}</Text>
                    <Text style={styles.invoiceMeta}>Place of Supply: {invoice?.place_of_supply ?? '-'}</Text>
                  </View>
                </View>

                <View style={styles.invoiceBox}>
                  <Text style={styles.invoiceSectionTitle}>Bill From</Text>
                  <Text style={styles.invoiceLine}>{invoice?.seller?.company_name ?? invoice?.seller?.name ?? '-'}</Text>
                  <Text style={styles.invoiceLine}>
                    {[invoice?.seller?.address_line1, invoice?.seller?.address_line2].filter(Boolean).join(', ')}
                  </Text>
                  <Text style={styles.invoiceLine}>
                    {[invoice?.seller?.city, invoice?.seller?.state, invoice?.seller?.pincode].filter(Boolean).join(', ')}
                  </Text>
                  <Text style={styles.invoiceLine}>GSTIN: {invoice?.seller?.gstin ?? '-'}</Text>
                  <Text style={styles.invoiceLine}>FSSAI: {invoice?.seller?.fssai ?? '-'}</Text>
                </View>

                <View style={styles.invoiceBox}>
                  <Text style={styles.invoiceSectionTitle}>Bill To</Text>
                  <Text style={styles.invoiceLine}>{invoice?.buyer?.name ?? '-'}</Text>
                  <Text style={styles.invoiceLine}>
                    {[invoice?.buyer?.address_line1, invoice?.buyer?.address_line2].filter(Boolean).join(', ')}
                  </Text>
                  <Text style={styles.invoiceLine}>
                    {[invoice?.buyer?.city, invoice?.buyer?.state, invoice?.buyer?.pincode].filter(Boolean).join(', ')}
                  </Text>
                  <Text style={styles.invoiceLine}>Phone: {invoice?.buyer?.phone ?? '-'}</Text>
                </View>

                <View style={styles.invoiceTable}>
                  <View style={styles.invoiceTableHead}>
                    <Text style={[styles.th, { flex: 1.6 }]}>Description</Text>
                    <Text style={[styles.th, { flex: 0.8, textAlign: 'right' }]}>Rate</Text>
                    <Text style={[styles.th, { flex: 0.45, textAlign: 'right' }]}>Qty</Text>
                    <Text style={[styles.th, { flex: 0.85, textAlign: 'right' }]}>Taxable</Text>
                    <Text style={[styles.th, { flex: 0.9, textAlign: 'right' }]}>Total</Text>
                  </View>
                  {invoiceItems.map((it: any) => (
                    <View key={it?.id ?? `${it?.product?.name}-${it?.quantity}`} style={styles.invoiceTableRow}>
                      <Text style={[styles.td, { flex: 1.6 }]}>
                        {it?.product?.name ?? 'Product'}
                        {'\n'}
                        HSN: {it?.product?.hsn ?? '-'}
                      </Text>
                      <Text style={[styles.td, { flex: 0.8, textAlign: 'right' }]}>{formatMoney(it?.rate)}</Text>
                      <Text style={[styles.td, { flex: 0.45, textAlign: 'right' }]}>{Number(it?.quantity ?? 0)}</Text>
                      <Text style={[styles.td, { flex: 0.85, textAlign: 'right' }]}>{formatMoney(it?.taxable_amount)}</Text>
                      <Text style={[styles.td, { flex: 0.9, textAlign: 'right' }]}>{formatMoney(it?.total_amount)}</Text>
                    </View>
                  ))}
                </View>

                {!!invoiceTaxDetails.length && (
                  <View style={styles.invoiceBox}>
                    <Text style={styles.invoiceSectionTitle}>Tax Details</Text>
                    {invoiceTaxDetails.map((tax: any, idx: number) => (
                      <Text key={`${tax?.tax_type}-${idx}`} style={styles.invoiceLine}>
                        {tax?.tax_type} @ {tax?.rate}%: {formatMoney(tax?.tax_amount)}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.totalWrap}>
                  <Text style={styles.totalLine}>Subtotal: {formatMoney(invoice?.subtotal)}</Text>
                  <Text style={styles.totalLine}>Total Tax: {formatMoney(invoice?.total_tax)}</Text>
                  <Text style={styles.totalLine}>Delivery: {formatMoney(invoice?.delivery_charge)}</Text>
                  <Text style={styles.totalGrand}>Grand Total: {formatMoney(invoice?.grand_total ?? invoice?.total)}</Text>
                </View>

                <View style={styles.orderedThrough}>
                  <Image source={require('../../../assets/dely-logo.png')} style={styles.orderedLogoImage} />
                  <Text style={styles.orderedThroughSub}>Ordered Through</Text>
                  <Text style={styles.orderedThroughBrand}>Delycart</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingHorizontal: 14 },
  header: { marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 4, color: '#475569', fontWeight: '600' },
  loaderWrap: { marginTop: 50, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, color: '#475569', fontWeight: '700' },
  emptyCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptySub: { marginTop: 6, color: '#64748B', textAlign: 'center', fontWeight: '700' },
  orderCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { color: '#0F172A', fontWeight: '900' },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  orderMeta: { marginTop: 6, color: '#475569', fontWeight: '600' },
  amount: { marginTop: 10, color: '#0F172A', fontSize: 16, fontWeight: '900' },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    maxWidth: '68%',
  },
  cancelOrderBtn: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  cancelOrderBtnDisabled: { opacity: 0.7 },
  cancelOrderBtnText: { fontWeight: '800', fontSize: 12, marginLeft: 5, color: '#B91C1C' },
  cancelledBanner: {
    marginTop: 12,
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 13,
  },
  invoiceBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceBtnText: { fontWeight: '800', fontSize: 12, marginLeft: 5 },
  trackWrap: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  trackStep: { flex: 1, alignItems: 'center' },
  trackDot: { width: 12, height: 12, borderRadius: 6 },
  trackLine: {
    position: 'absolute',
    top: 5,
    left: '50%',
    width: '100%',
    height: 2,
  },
  trackLabel: { marginTop: 7, color: '#64748B', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  invoiceTopRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  logoBadgeImage: { width: 42, height: 42, borderRadius: 8, resizeMode: 'contain' },
  invoiceHeading: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  invoiceMeta: { color: '#334155', fontSize: 12, marginTop: 2, fontWeight: '600' },
  invoiceBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  invoiceSectionTitle: { fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  invoiceLine: { color: '#334155', fontWeight: '600', fontSize: 12, marginTop: 1 },
  invoiceTable: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, overflow: 'hidden' },
  invoiceTableHead: { flexDirection: 'row', backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 6 },
  th: { color: '#0F172A', fontWeight: '800', fontSize: 11 },
  invoiceTableRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  td: { color: '#0F172A', fontSize: 11, fontWeight: '600' },
  totalWrap: { marginTop: 10, alignItems: 'flex-end' },
  totalLine: { color: '#334155', fontWeight: '700', marginTop: 3 },
  totalGrand: { color: '#0F172A', fontWeight: '900', marginTop: 6, fontSize: 16 },
  orderedThrough: { marginTop: 14, alignItems: 'center', paddingBottom: 10 },
  orderedLogoImage: { width: 44, height: 44, borderRadius: 8, resizeMode: 'contain' },
  orderedThroughSub: { marginTop: 4, fontSize: 11, color: '#475569', fontWeight: '700' },
  orderedThroughBrand: { color: '#DC2626', fontWeight: '900', fontSize: 15 },
});

export default OrdersScreen;
