import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppSelector } from '../../../hooks/redux';
import {
  useCancelOrderApiMutation,
  useGetOrderInvoiceQuery,
  useGetOrdersQuery,
  useGetReturnStatusQuery,
  useInitiateReturnMutation,
} from '../../../services/api/mobileApi';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import { palette, radius, shadow, getDivision } from '../../../utils/theme';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

type UiOrder = {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  itemsSummary: string;
  createdAt?: string;
  address: string;
  /** Status of this order's return request, if one exists. */
  returnStatus?: string | null;
};

const RETURN_STEPS = ['Requested', 'Approved', 'Pickup', 'Picked up', 'At hub'];
const returnStepIndex = (status?: string | null): number => {
  switch (status) {
    case 'requested': return 0;
    case 'approved': return 1;
    case 'pickup_assigned': return 2;
    case 'picked_up': return 3;
    case 'received_at_hub': return 4;
    default: return -1;
  }
};
const returnStatusLabel = (status?: string | null): string => {
  switch (status) {
    case 'requested': return 'Requested';
    case 'approved': return 'Approved';
    case 'pickup_assigned': return 'Pickup scheduled';
    case 'picked_up': return 'Picked up';
    case 'received_at_hub': return 'Received at hub';
    case 'rejected': return 'Rejected';
    default: return '';
  }
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
  const navigation = useNavigation();
  const { alert: appAlert, confirm } = useAppAlert();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const primary = getDivision(homeDivision).primary;
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [invoiceOrderId, setInvoiceOrderId] = React.useState<string | null>(null);

  const shareInvoice = React.useCallback(async (inv: any) => {
    if (!inv) return;
    const fmtAmt = (n: number) =>
      Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lines = [
      `INVOICE — ${inv.invoice_number ?? ''}`,
      `Order No  : ${inv.order_number ?? ''}`,
      `Date      : ${inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : ''}`,
      ``,
      `BILL FROM : ${inv.seller?.company_name ?? inv.seller?.name ?? ''}`,
      inv.seller?.address_line1 ? `Add       : ${inv.seller.address_line1}` : null,
      inv.seller?.state ? `           ${inv.seller.state}` : null,
      inv.seller?.phone ? `Phone     : ${inv.seller.phone}` : null,
      inv.seller?.email ? `Email     : ${inv.seller.email}` : null,
      `GSTIN     : ${inv.seller?.gstin ?? ''}`,
      inv.seller?.fssai ? `FSSAI NO  : ${inv.seller.fssai}` : null,
      ``,
      `BILL TO   : ${inv.buyer?.name ?? ''}`,
      inv.buyer?.email ? `Email     : ${inv.buyer.email}` : null,
      `Mobile    : ${inv.buyer?.phone ?? ''}`,
      inv.buyer?.gstin ? `GSTIN     : ${inv.buyer.gstin}` : null,
      `State     : ${inv.buyer?.state_with_code ?? inv.buyer?.state ?? ''}`,
      ``,
      `Place of Supply : ${inv.place_of_supply ?? ''}`,
      ``,
      ...(Array.isArray(inv.items) ? inv.items.map((it: any) =>
        `• ${it?.product?.name ?? 'Product'} × ${it.quantity} — ₹${fmtAmt(it.total_amount ?? 0)}`
      ) : []),
      ``,
      `Subtotal  : ₹${fmtAmt(inv.subtotal ?? 0)}`,
      `Tax       : ₹${fmtAmt(inv.total_tax ?? 0)}`,
      inv.delivery_charge ? `Delivery  : ₹${fmtAmt(inv.delivery_charge)}` : null,
      `TOTAL     : ₹${fmtAmt(inv.grand_total ?? inv.total ?? 0)}`,
    ].filter(l => l !== null).join('\n');
    try {
      await Share.share({ message: lines, title: `Invoice ${inv.invoice_number ?? ''}` });
    } catch {
      // user cancelled share sheet
    }
  }, []);
  const [cancellingOrderId, setCancellingOrderId] = React.useState<string | null>(null);
  const confirmingRef = useRef<Set<string>>(new Set());

  // Return flow
  const [returnOrderId, setReturnOrderId] = React.useState<string | null>(null);
  const [returnOrderNumber, setReturnOrderNumber] = React.useState<string>('');
  const [returnOrderIsCod, setReturnOrderIsCod] = React.useState(false);
  const [returnReason, setReturnReason] = React.useState('');
  const [returnPhotos, setReturnPhotos] = React.useState<Asset[]>([]);
  const [returnVideo, setReturnVideo] = React.useState<Asset | null>(null);
  const [returnBankAccount, setReturnBankAccount] = React.useState('');
  const [returnBankIfsc, setReturnBankIfsc] = React.useState('');
  const [returnBankHolder, setReturnBankHolder] = React.useState('');
  const [returnBankName, setReturnBankName] = React.useState('');
  const [initiateReturn, { isLoading: isSubmittingReturn }] = useInitiateReturnMutation();

  const { data, isFetching, isLoading, refetch } = useGetOrdersQuery();
  const [cancelOrder] = useCancelOrderApiMutation();
  const {
    data: invoiceRes,
    isFetching: isInvoiceLoading,
  } = useGetOrderInvoiceQuery(
    { orderId: invoiceOrderId ?? '' },
    { skip: !invoiceOrderId },
  );

  // Return detail sheet — surfaces the reason, the admin's note (e.g. why a return
  // was rejected), and the refund expectation for a particular returned order.
  const [returnDetailOrderId, setReturnDetailOrderId] = React.useState<string | null>(null);
  const { data: returnDetailRes, isFetching: isReturnDetailLoading } = useGetReturnStatusQuery(
    { orderId: returnDetailOrderId ?? '' },
    { skip: !returnDetailOrderId },
  );
  const returnDetail = (returnDetailRes?.data ?? null) as any;

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
      returnStatus: (o?.returnStatus ?? o?.return_status ?? null) as string | null,
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

  const RETURN_WINDOW_DAYS = 7;

  const canRequestReturn = (order: UiOrder) => {
    if (!['delivered', 'completed'].includes(order.status)) return false;
    if (!order.createdAt) return true;
    const diff = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= RETURN_WINDOW_DAYS;
  };

  const openReturnModal = (order: UiOrder) => {
    setReturnOrderId(order.id);
    setReturnOrderNumber((order.orderNumber ?? order.id).slice(-12));
    setReturnOrderIsCod(true); // always show bank fields; backend knows payment method
    setReturnReason('');
    setReturnPhotos([]);
    setReturnVideo(null);
    setReturnBankAccount('');
    setReturnBankIfsc('');
    setReturnBankHolder('');
    setReturnBankName('');
  };

  const pickReturnPhotos = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 4 }, resp => {
      if (resp.assets?.length) {
        setReturnPhotos(prev => [...prev, ...resp.assets!].slice(0, 4));
      }
    });
  };

  const pickReturnVideo = () => {
    launchImageLibrary({ mediaType: 'video', selectionLimit: 1 }, resp => {
      if (resp.assets?.length) setReturnVideo(resp.assets[0]);
    });
  };

  const closeReturnModal = () => {
    setReturnOrderId(null);
  };

  const submitReturn = async () => {
    if (!returnOrderId) return;
    if (returnReason.trim().length < 5) {
      await appAlert({ title: 'Reason required', message: 'Please describe the return reason (min 5 chars).' });
      return;
    }
    if (returnPhotos.length === 0) {
      await appAlert({ title: 'Photo required', message: 'Please add at least one photo of the item being returned.' });
      return;
    }
    if (!returnVideo) {
      await appAlert({ title: 'Video required', message: 'Please add a short video of the item being returned.' });
      return;
    }
    const fd = new FormData();
    fd.append('reason', returnReason.trim());
    if (returnBankAccount.trim()) fd.append('bank_account_number', returnBankAccount.trim());
    if (returnBankIfsc.trim()) fd.append('bank_ifsc_code', returnBankIfsc.trim().toUpperCase());
    if (returnBankHolder.trim()) fd.append('bank_account_holder', returnBankHolder.trim());
    if (returnBankName.trim()) fd.append('bank_name', returnBankName.trim());
    // Mandatory evidence: photos + a video, uploaded under the `files` field.
    [...returnPhotos, returnVideo].forEach((asset, i) => {
      if (!asset?.uri) return;
      const isVideo = asset === returnVideo;
      fd.append('files', {
        uri: asset.uri,
        type: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || `return_${i}.${isVideo ? 'mp4' : 'jpg'}`,
      } as any);
    });
    try {
      await initiateReturn({ orderId: returnOrderId, formData: fd }).unwrap();
      closeReturnModal();
      await appAlert({
        title: 'Return request submitted',
        message: 'We will review your request and arrange a pickup. Refund for COD orders is credited within 10 working days.',
      });
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'data' in err &&
        typeof (err as { data?: { detail?: string } }).data?.detail === 'string'
          ? (err as { data: { detail: string } }).data.detail
          : 'Could not submit return request. Please try again.';
      await appAlert({ title: 'Error', message: msg });
    }
  };

  const confirmCancelOrder = async (order: UiOrder) => {
    if (confirmingRef.current.has(order.id)) return;
    confirmingRef.current.add(order.id);
    const ok = await confirm({
      title: 'Cancel order?',
      message: `Cancel order #${(order.orderNumber ?? order.id).slice(-12)}? This cannot be undone.`,
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      destructive: true,
    });
    confirmingRef.current.delete(order.id);
    if (!ok) return;

    setCancellingOrderId(order.id);
    try {
      await cancelOrder({ orderId: order.id }).unwrap();
      await appAlert({
        title: 'Order cancelled',
        message: 'Your order has been cancelled.',
      });
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'data' in err &&
        typeof (err as { data?: { message?: string } }).data?.message === 'string'
          ? (err as { data: { message: string } }).data.message
          : 'Could not cancel this order. It may already be on the way.';
      await appAlert({ title: 'Unable to cancel', message: msg });
    } finally {
      setCancellingOrderId(null);
    }
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
        {navigation.canGoBack() ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backLink}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.85}>
            <Icon name="chevron-left" size={26} color={primary} />
            <Text style={[styles.backLinkText, { color: primary }]}>Back</Text>
          </TouchableOpacity>
        ) : null}
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
                    {canRequestReturn(order) && !order.returnStatus ? (
                      <TouchableOpacity
                        style={styles.returnBtn}
                        onPress={() => openReturnModal(order)}
                        activeOpacity={0.9}>
                        <Icon name="arrow-u-left-top" size={14} color="#7C3AED" />
                        <Text style={styles.returnBtnText}>Return</Text>
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

                {order.returnStatus ? (
                  <TouchableOpacity
                    style={styles.returnJourney}
                    activeOpacity={0.85}
                    onPress={() => setReturnDetailOrderId(order.id)}>
                    <View style={styles.returnJourneyHead}>
                      <Icon name="keyboard-return" size={14} color="#7C3AED" />
                      <Text style={styles.returnJourneyTitle}>
                        Return · {returnStatusLabel(order.returnStatus)}
                      </Text>
                      <Text style={styles.returnJourneyDetailsHint}>Details ›</Text>
                    </View>
                    {order.returnStatus === 'rejected' ? (
                      <Text style={styles.returnRejectedText}>
                        Your return request was not approved.
                      </Text>
                    ) : (
                      <View style={styles.trackWrap}>
                        {RETURN_STEPS.map((label, index) => {
                          const rStep = returnStepIndex(order.returnStatus);
                          const done = rStep >= index;
                          const dotColor = done ? '#7C3AED' : '#CBD5E1';
                          return (
                            <View key={label} style={styles.trackStep}>
                              <View style={[styles.trackDot, { backgroundColor: dotColor }]} />
                              {index < RETURN_STEPS.length - 1 ? (
                                <View style={[styles.trackLine, { backgroundColor: rStep > index ? '#7C3AED' : '#E2E8F0' }]} />
                              ) : null}
                              <Text style={[styles.trackLabel, done && { color: '#0F172A', fontWeight: '800' }]}>
                                {label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {invoice ? (
                  <TouchableOpacity onPress={() => shareInvoice(invoice)} activeOpacity={0.85}>
                    <Icon name="download-outline" size={22} color="#1D4ED8" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setInvoiceOrderId(null)} activeOpacity={0.9}>
                  <Icon name="close" size={20} color="#334155" />
                </TouchableOpacity>
              </View>
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
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                {/* ── Header: logo+meta full-width, then Bill From | Bill To side by side ── */}
                {/* Row 1: logo + meta fields (full width) */}
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8 }}>
                  <Image source={require('../../../assets/dely-logo.png')} style={styles.logoBadgeImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invBillOfSupply}>BILL OF SUPPLY</Text>
                    <Text style={styles.invMeta}>Invoice No : {invoice?.invoice_number ?? '—'}</Text>
                    <Text style={styles.invMeta}>Order No : {invoice?.order_number ?? '—'}</Text>
                    <Text style={styles.invMeta}>Shipment No : {invoice?.shipment_number ?? invoice?.shipmentNumber ?? '—'}</Text>
                    <Text style={styles.invMeta}>Invoice Date : {invoiceDate}</Text>
                    <Text style={styles.invMeta}>Place of Supply : {invoice?.place_of_supply ?? '—'}</Text>
                    <Text style={styles.invMeta}>Supply Type : {invoice?.supply_type ?? '—'}</Text>
                    <Text style={styles.invMeta}>Page No : {invoice?.page_number ?? invoice?.pageNumber ?? '1/1'}</Text>
                  </View>
                </View>
                {/* Row 2: Bill From | Bill To side by side (each gets ~50% width) */}
                <View style={styles.invBillRow}>
                  <View style={styles.invBillCol}>
                    <Text style={styles.invBillLabel}>Bill From:</Text>
                    <Text style={styles.invBillText}>{invoice?.seller?.company_name ?? invoice?.seller?.name ?? '—'}</Text>
                    {invoice?.seller?.address_line1 ? <Text style={styles.invBillText}>{invoice.seller.address_line1}</Text> : null}
                    {invoice?.seller?.address_line2 ? <Text style={styles.invBillText}>{invoice.seller.address_line2}</Text> : null}
                    {[invoice?.seller?.city, invoice?.seller?.state, invoice?.seller?.pincode].filter(Boolean).length > 0
                      ? <Text style={styles.invBillText}>{[invoice?.seller?.city, invoice?.seller?.state, invoice?.seller?.pincode].filter(Boolean).join(', ')}</Text>
                      : null}
                    <Text style={styles.invBillText}>GSTIN: {invoice?.seller?.gstin ?? '—'}</Text>
                    {invoice?.seller?.fssai ? <Text style={styles.invBillText}>FSSAI: {invoice.seller.fssai}</Text> : null}
                    {invoice?.seller?.phone ? <Text style={styles.invBillText}>Phone: {invoice.seller.phone}</Text> : null}
                    {invoice?.seller?.email ? <Text style={styles.invBillText}>{invoice.seller.email}</Text> : null}
                  </View>
                  <View style={styles.invBillCol}>
                    <Text style={styles.invBillLabel}>Bill To:</Text>
                    <Text style={styles.invBillText}>{String(invoice?.buyer?.name ?? '—').toUpperCase()}</Text>
                    {invoice?.buyer?.address_line1 ? <Text style={styles.invBillText}>{invoice.buyer.address_line1}</Text> : null}
                    {invoice?.buyer?.address_line2 ? <Text style={styles.invBillText}>{invoice.buyer.address_line2}</Text> : null}
                    {[invoice?.buyer?.city, invoice?.buyer?.state].filter(Boolean).length > 0
                      ? <Text style={styles.invBillText}>
                          {[invoice?.buyer?.city, invoice?.buyer?.state].filter(Boolean).join(', ')}{invoice?.buyer?.pincode ? ` - ${invoice.buyer.pincode}` : ''}
                        </Text>
                      : null}
                    <Text style={styles.invBillText}>Mobile: {invoice?.buyer?.phone ?? '—'}</Text>
                    {invoice?.buyer?.email ? <Text style={styles.invBillText}>Email: {invoice.buyer.email}</Text> : null}
                    {invoice?.buyer?.gstin ? <Text style={styles.invBillText}>GSTIN: {invoice.buyer.gstin}</Text> : null}
                    <Text style={styles.invBillText}>
                      State Code: {invoice?.buyer?.state_with_code ?? invoice?.buyer?.state_code ?? '—'}
                    </Text>
                  </View>
                </View>

                {/* ── Items table (horizontally scrollable) ── */}
                <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 10 }}>
                  <View style={styles.invTable}>
                    {/* Header row */}
                    <View style={styles.invTableHeadRow}>
                      <Text style={[styles.invTh, { width: 140 }]}>Description</Text>
                      <Text style={[styles.invTh, { width: 72, textAlign: 'right' }]}>HSN Code</Text>
                      <Text style={[styles.invTh, { width: 78, textAlign: 'right' }]}>Original Rate</Text>
                      <Text style={[styles.invTh, { width: 78, textAlign: 'right' }]}>Unit Discount</Text>
                      <Text style={[styles.invTh, { width: 66, textAlign: 'right' }]}>Rate</Text>
                      <Text style={[styles.invTh, { width: 44, textAlign: 'right' }]}>Qty</Text>
                      <Text style={[styles.invTh, { width: 82, textAlign: 'right' }]}>Taxable Amt.</Text>
                      <Text style={[styles.invTh, { width: 56, textAlign: 'right' }]}>SGST</Text>
                      <Text style={[styles.invTh, { width: 56, textAlign: 'right' }]}>CGST</Text>
                      <Text style={[styles.invTh, { width: 72, textAlign: 'right' }]}>Total Amt.</Text>
                    </View>
                    {/* Item rows */}
                    {invoiceItems.map((it: any, idx: number) => {
                      const isCanonical =
                        it?.product && typeof it.product === 'object' &&
                        (it.taxable_amount !== undefined || it.taxableAmount !== undefined);
                      const productName = it?.product?.name ?? it?.productName ?? it?.product_name ?? 'Product';
                      const hsnCode = it?.product?.hsn ?? it?.product?.hsnCode ?? it?.hsnCode ?? it?.hsn_code ?? '—';
                      const supplyType = invoice?.supply_type ?? '';
                      const fmtN = (n: number) =>
                        n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                      let mrp: number, sellingPrice: number, discountDisplay: number, quantity: number,
                          taxableAmount: number, sgstAmount: number, cgstAmount: number, itemTotal: number, taxLabel: string;

                      if (isCanonical) {
                        mrp = Number(it.mrp ?? it.original_rate ?? it.originalPrice ?? 0);
                        sellingPrice = Number(it.rate ?? it.selling_price ?? it.price ?? 0);
                        const unitDiscount = Number(it.unit_discount ?? 0);
                        discountDisplay = Number(it.discount ?? unitDiscount * Number(it.quantity ?? 1));
                        quantity = Number(it.quantity ?? it.qty ?? 1);
                        taxableAmount = Number(it.taxable_amount ?? it.taxableAmount ?? sellingPrice * quantity);
                        sgstAmount = Number(it.sgst ?? it.tax_details?.sgst ?? 0);
                        cgstAmount = Number(it.cgst ?? it.tax_details?.cgst ?? 0);
                        const igstAmount = Number(it.tax_details?.igst ?? it.igst ?? 0);
                        const taxRate = Number(it.tax_details?.rate ?? 0);
                        const halfRate = taxRate > 0 ? taxRate / 2 : 0;
                        itemTotal = Number(it.total_amount ?? it.totalAmount ?? taxableAmount + sgstAmount + cgstAmount + igstAmount);
                        taxLabel = supplyType === 'INTERSTATE' && igstAmount > 0
                          ? `IGST@ ${taxRate.toFixed(1)}%`
                          : `CGST@ ${halfRate.toFixed(1)}%, SGST@ ${halfRate.toFixed(1)}%`;
                      } else {
                        mrp = Number(it.mrp ?? it.originalPrice ?? it.original_price ?? 0);
                        sellingPrice = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.rate ?? 0);
                        quantity = Number(it.quantity ?? it.qty ?? 1);
                        discountDisplay = Math.max(0, mrp - sellingPrice) * quantity;
                        taxableAmount = Number(it.taxableAmount ?? it.taxable_amount ?? sellingPrice * quantity);
                        const cgstRate = Number(it.cgstRate ?? it.cgst_rate ?? 0);
                        const sgstRate = Number(it.sgstRate ?? it.sgst_rate ?? 0);
                        cgstAmount = Number(it.cgstAmount ?? it.cgst_amount ?? (taxableAmount * cgstRate) / 100);
                        sgstAmount = Number(it.sgstAmount ?? it.sgst_amount ?? (taxableAmount * sgstRate) / 100);
                        itemTotal = Number(it.totalAmount ?? it.total_amount ?? taxableAmount + cgstAmount + sgstAmount);
                        const unit = it.unit ?? it.product?.unit ?? '';
                        taxLabel = unit
                          ? `${unit}, CGST@ ${cgstRate.toFixed(1)}%, SGST@ ${sgstRate.toFixed(1)}%`
                          : `CGST@ ${cgstRate.toFixed(1)}%, SGST@ ${sgstRate.toFixed(1)}%`;
                      }

                      return (
                        <View key={it?.id ?? idx} style={styles.invTableRow}>
                          <View style={{ width: 140, paddingRight: 4 }}>
                            <Text style={styles.invTd}>{productName}</Text>
                            {taxLabel ? <Text style={[styles.invTd, { color: '#64748B', marginTop: 1 }]}>{taxLabel}</Text> : null}
                          </View>
                          <Text style={[styles.invTd, { width: 72, textAlign: 'right' }]}>{hsnCode}</Text>
                          <Text style={[styles.invTd, { width: 78, textAlign: 'right' }]}>{fmtN(mrp)}</Text>
                          <Text style={[styles.invTd, { width: 78, textAlign: 'right' }]}>{fmtN(discountDisplay)}</Text>
                          <Text style={[styles.invTd, { width: 66, textAlign: 'right' }]}>{fmtN(sellingPrice)}</Text>
                          <Text style={[styles.invTd, { width: 44, textAlign: 'right' }]}>{quantity.toFixed(1)}</Text>
                          <Text style={[styles.invTd, { width: 82, textAlign: 'right' }]}>{fmtN(taxableAmount)}</Text>
                          <Text style={[styles.invTd, { width: 56, textAlign: 'right' }]}>{fmtN(sgstAmount)}</Text>
                          <Text style={[styles.invTd, { width: 56, textAlign: 'right' }]}>{fmtN(cgstAmount)}</Text>
                          <Text style={[styles.invTd, { width: 72, textAlign: 'right' }]}>{fmtN(itemTotal)}</Text>
                        </View>
                      );
                    })}
                    {/* Page Total row */}
                    <View style={styles.invPageTotalRow}>
                      <Text style={styles.invPageTotalText}>Page Total</Text>
                      <Text style={styles.invPageTotalText}>
                        Qty {invoiceItems.reduce((s: number, it: any) => s + Number(it.quantity ?? it.qty ?? 1), 0).toFixed(1)}
                      </Text>
                      <Text style={styles.invPageTotalText}>
                        {Number(invoice?.grand_total ?? invoice?.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* ── QR code (right-aligned, web style) ── */}
                {invoice?.upiQr?.qrImage ? (
                  <View style={styles.invQrRow}>
                    <View style={styles.invQrBlock}>
                      <Image source={{ uri: invoice.upiQr.qrImage }} style={styles.invQrImage} resizeMode="contain" />
                      <Text style={styles.invQrScanText}>
                        Scan to pay ₹{Number(invoice.upiQr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.invQrVpa}>{invoice.upiQr.vpa}</Text>
                      <Text style={styles.invQrRef}>Ref: {invoice.upiQr.invoiceNumber ?? invoice?.invoice_number ?? ''}</Text>
                    </View>
                  </View>
                ) : null}

                {/* ── Grand total section ── */}
                <View style={styles.invGrandTotalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invForSeller}>
                      FOR {String(invoice?.seller?.company_name ?? invoice?.seller?.name ?? '').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 16 }}>
                    <Text style={styles.invSubTotalLabel}>Sub Total Amount Pay:</Text>
                    <Text style={styles.invSubTotalAmt}>
                      ₹ {Number(invoice?.grand_total ?? invoice?.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invAmtPayLabel}>Amount Pay:</Text>
                    <Text style={styles.invAmtPay}>
                      ₹ {Number(invoice?.grand_total ?? invoice?.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                {/* UPI Pay button */}
                {invoice?.upiQr?.upiUri ? (
                  <TouchableOpacity
                    style={styles.invUpiBtn}
                    onPress={() => Linking.openURL(invoice.upiQr.upiUri).catch(() => {})}
                    activeOpacity={0.9}>
                    <Icon name="cellphone" size={15} color="#FFFFFF" />
                    <Text style={styles.invUpiBtnText}>Pay with UPI app</Text>
                  </TouchableOpacity>
                ) : null}

                {/* ── Footer ── */}
                {(() => {
                  const bank = invoice?.bankDetails || invoice?.bank_details;
                  const hasBankDetails = bank && (bank.bankName || bank.accountNumber);
                  return (
                    <View style={styles.invFooter}>
                      <View style={{ flex: 1 }}>
                        {hasBankDetails ? (
                          <>
                            <Text style={styles.invFooterLabel}>Bank Details</Text>
                            {bank.bankName ? <Text style={styles.invFooterText}>Bank Name: {bank.bankName}</Text> : null}
                            {bank.accountHolderName ? <Text style={styles.invFooterText}>Account Holder: {bank.accountHolderName}</Text> : null}
                            {bank.accountNumber ? <Text style={styles.invFooterText}>Account No: {bank.accountNumber}</Text> : null}
                            {bank.ifscCode ? <Text style={styles.invFooterText}>IFSC: {bank.ifscCode}</Text> : null}
                            {bank.branchName ? <Text style={styles.invFooterText}>Branch: {bank.branchName}</Text> : null}
                          </>
                        ) : null}
                        <Text style={[styles.invFooterText, { marginTop: hasBankDetails ? 8 : 0 }]}>
                          Is tax payable on reverse charge basis -{' '}
                          {invoice?.tax_payable_reverse_charge === true ? 'YES' : 'NO'}
                        </Text>
                        <Text style={[styles.invFooterText, { marginTop: 4 }]}>
                          DECLARATION: We declare that this document shows the actual price of the goods described and that the particulars are true and correct.
                        </Text>
                        <Text style={[styles.invFooterText, { marginTop: 4 }]}>
                          {invoice?.terms ?? 'This is a computer-generated Bill of Supply.'}
                        </Text>
                      </View>
                      <View style={styles.invFooterLogo}>
                        <Image source={require('../../../assets/dely-logo.png')} style={styles.orderedLogoImage} />
                        <Text style={styles.orderedThroughSub}>Ordered Through</Text>
                        <Text style={styles.orderedThroughBrand}>Delycart</Text>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      {/* Return Request Modal */}
      <Modal
        visible={!!returnOrderId}
        animationType="slide"
        transparent
        onRequestClose={closeReturnModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Return</Text>
              <TouchableOpacity onPress={closeReturnModal} activeOpacity={0.9}>
                <Icon name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12, marginBottom: 4 }}>
              Order #{returnOrderNumber} · Refund within 10 working days
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.returnModalLabel}>Reason for return *</Text>
              <TextInput
                style={[styles.returnModalInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Describe the issue (damaged, wrong item, etc.)"
                placeholderTextColor="#94A3B8"
                multiline
                value={returnReason}
                onChangeText={setReturnReason}
              />

              <Text style={styles.returnModalSection}>Photos & video *</Text>
              <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 8 }}>
                Add at least one photo and a short video of the item — required for every return.
              </Text>
              <View style={styles.mediaPickRow}>
                <TouchableOpacity style={styles.mediaPickBtn} onPress={pickReturnPhotos} activeOpacity={0.85}>
                  <Icon name="image-plus" size={16} color="#7C3AED" />
                  <Text style={styles.mediaPickBtnText}>
                    {returnPhotos.length ? `Photos (${returnPhotos.length})` : 'Add photos'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaPickBtn} onPress={pickReturnVideo} activeOpacity={0.85}>
                  <Icon name={returnVideo ? 'check-circle' : 'video-plus'} size={16} color="#7C3AED" />
                  <Text style={styles.mediaPickBtnText}>{returnVideo ? 'Video added' : 'Add video'}</Text>
                </TouchableOpacity>
              </View>
              {returnPhotos.length > 0 ? (
                <View style={styles.mediaThumbRow}>
                  {returnPhotos.map((a, i) => (
                    <View key={`${a.uri}-${i}`} style={styles.mediaThumbWrap}>
                      <Image source={{ uri: a.uri }} style={styles.mediaThumb} />
                      <TouchableOpacity
                        style={styles.mediaThumbRemove}
                        onPress={() => setReturnPhotos(prev => prev.filter((_, j) => j !== i))}>
                        <Icon name="close" size={11} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
              {returnVideo ? (
                <View style={styles.mediaVideoChip}>
                  <Icon name="video" size={14} color="#166534" />
                  <Text style={styles.mediaVideoChipText} numberOfLines={1}>
                    {returnVideo.fileName || 'Video attached'}
                  </Text>
                  <TouchableOpacity onPress={() => setReturnVideo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.returnModalSection}>Bank Details (for COD refund)</Text>
              <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>
                Required only if you paid cash on delivery
              </Text>

              <Text style={styles.returnModalLabel}>Account holder name</Text>
              <TextInput
                style={styles.returnModalInput}
                placeholder="Full name as on bank account"
                placeholderTextColor="#94A3B8"
                value={returnBankHolder}
                onChangeText={setReturnBankHolder}
              />

              <Text style={styles.returnModalLabel}>Account number</Text>
              <TextInput
                style={styles.returnModalInput}
                placeholder="e.g. 1234567890"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={returnBankAccount}
                onChangeText={setReturnBankAccount}
              />

              <Text style={styles.returnModalLabel}>IFSC code</Text>
              <TextInput
                style={styles.returnModalInput}
                placeholder="e.g. SBIN0001234"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={returnBankIfsc}
                onChangeText={setReturnBankIfsc}
              />

              <Text style={styles.returnModalLabel}>Bank name</Text>
              <TextInput
                style={styles.returnModalInput}
                placeholder="e.g. State Bank of India"
                placeholderTextColor="#94A3B8"
                value={returnBankName}
                onChangeText={setReturnBankName}
              />

              <TouchableOpacity
                style={[styles.returnSubmitBtn, isSubmittingReturn && styles.returnSubmitBtnDisabled]}
                onPress={submitReturn}
                disabled={isSubmittingReturn}
                activeOpacity={0.85}>
                {isSubmittingReturn
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.returnSubmitBtnText}>Submit Return Request</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Return detail sheet — reason, support's note, refund expectation, photos */}
      <Modal
        visible={!!returnDetailOrderId}
        animationType="slide"
        transparent
        onRequestClose={() => setReturnDetailOrderId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Return details</Text>
              <TouchableOpacity onPress={() => setReturnDetailOrderId(null)} activeOpacity={0.9}>
                <Icon name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            {isReturnDetailLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.loaderText}>Loading return…</Text>
              </View>
            ) : !returnDetail ? (
              <View style={styles.loaderWrap}>
                <Text style={styles.loaderText}>No return found for this order.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                <View style={styles.returnDetailStatus}>
                  <Icon name="keyboard-return" size={16} color="#6D28D9" />
                  <Text style={styles.returnDetailStatusText}>
                    {returnStatusLabel(returnDetail.status)}
                  </Text>
                </View>

                <Text style={styles.returnDetailLabel}>Reason</Text>
                <Text style={styles.returnDetailValue}>{returnDetail.reason || '—'}</Text>

                {returnDetail.adminNotes ? (
                  <View
                    style={[
                      styles.returnDetailNoteBox,
                      returnDetail.status === 'rejected' && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                    ]}>
                    <Text style={styles.returnDetailNoteLabel}>
                      {returnDetail.status === 'rejected' ? 'Why it was not approved' : 'Note from support'}
                    </Text>
                    <Text style={styles.returnDetailNoteText}>{returnDetail.adminNotes}</Text>
                  </View>
                ) : null}

                {returnDetail.status !== 'rejected' ? (
                  <View style={styles.returnRefundBox}>
                    <Icon name="cash-refund" size={16} color="#166534" />
                    <Text style={styles.returnRefundText}>
                      {returnDetail.status === 'received_at_hub'
                        ? `Item received. Your refund will be issued ${returnDetail.isCod ? 'to your bank account within 10 working days' : 'to your original payment method'}.`
                        : `Once we collect and verify the item, your refund will be issued ${returnDetail.isCod ? 'to your bank account within 10 working days' : 'to your original payment method'}.`}
                    </Text>
                  </View>
                ) : null}

                {Array.isArray(returnDetail.mediaUrls) && returnDetail.mediaUrls.length > 0 ? (
                  <>
                    <Text style={styles.returnDetailLabel}>Photos you shared</Text>
                    <View style={styles.returnDetailMediaRow}>
                      {returnDetail.mediaUrls.map((m: any, i: number) => (
                        <Image
                          key={i}
                          source={{ uri: typeof m === 'string' ? m : m?.url }}
                          style={styles.returnDetailMedia}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 14 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 2,
  },
  backLinkText: { fontSize: 16, fontWeight: '800' },
  header: { marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 4, color: '#475569', fontWeight: '600' },
  loaderWrap: { marginTop: 50, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, color: '#475569', fontWeight: '700' },
  emptyCard: {
    marginTop: 18,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    alignItems: 'center',
    ...shadow.sm,
  },
  emptyTitle: { marginTop: 10, color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptySub: { marginTop: 6, color: '#64748B', textAlign: 'center', fontWeight: '700' },
  orderCard: {
    marginTop: 12,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    ...shadow.sm,
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

  // ── New invoice layout styles (matching web admin) ──
  invHeader: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  invMetaCol: { flex: 1.4 },
  invBillRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  invBillCol: { flex: 1 },
  invBillOfSupply: { fontSize: 11, fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', marginBottom: 2 },
  invMeta: { fontSize: 9, color: '#334155', fontWeight: '600', marginTop: 1, lineHeight: 13 },
  invBillLabel: { fontSize: 9, fontWeight: '900', color: '#0F172A', marginBottom: 2 },
  invBillText: { fontSize: 9, color: '#334155', fontWeight: '600', marginTop: 1, lineHeight: 12 },
  invTable: { borderWidth: 1, borderColor: '#000000' },
  invTableHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  invTh: { fontSize: 9, fontWeight: '800', color: '#0F172A' },
  invTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    alignItems: 'flex-start',
  },
  invTd: { fontSize: 10, color: '#0F172A', fontWeight: '600', lineHeight: 13 },
  invPageTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  invPageTotalText: { fontSize: 9, fontWeight: '800', color: '#0F172A' },
  invQrRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  invQrBlock: { alignItems: 'center' },
  invQrImage: { width: 100, height: 100, borderRadius: 4, borderWidth: 1, borderColor: '#000000', backgroundColor: '#FFFFFF' },
  invQrScanText: { fontSize: 10, fontWeight: '800', color: '#0F172A', marginTop: 4, textAlign: 'center' },
  invQrVpa: { fontSize: 9, color: '#475569', fontWeight: '600', textAlign: 'center', marginTop: 1 },
  invQrRef: { fontSize: 9, color: '#475569', fontWeight: '600', textAlign: 'center', marginTop: 1 },
  invGrandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  invForSeller: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  invSubTotalLabel: { fontSize: 9, color: '#475569', fontWeight: '700' },
  invSubTotalAmt: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  invAmtPayLabel: { fontSize: 9, color: '#475569', fontWeight: '700' },
  invAmtPay: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  invUpiBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignSelf: 'center',
  },
  invUpiBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  invFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  invFooterLabel: { fontSize: 10, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  invFooterText: { fontSize: 9, color: '#475569', fontWeight: '600', lineHeight: 13 },
  invFooterLogo: { alignItems: 'center', flexShrink: 0 },

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
  returnJourney: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  returnJourneyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  returnJourneyTitle: { color: '#7C3AED', fontWeight: '900', fontSize: 13 },
  returnJourneyDetailsHint: { marginLeft: 'auto', color: '#7C3AED', fontWeight: '800', fontSize: 12 },
  returnRejectedText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  returnDetailStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 4, marginBottom: 4,
  },
  returnDetailStatusText: { color: '#6D28D9', fontWeight: '900', fontSize: 13 },
  returnDetailLabel: {
    color: '#64748B', fontWeight: '800', fontSize: 12, marginTop: 12,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  returnDetailValue: { color: '#0F172A', fontWeight: '600', fontSize: 14, marginTop: 4, lineHeight: 20 },
  returnDetailNoteBox: {
    marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', padding: 12,
  },
  returnDetailNoteLabel: { color: '#475569', fontWeight: '800', fontSize: 12, marginBottom: 3 },
  returnDetailNoteText: { color: '#0F172A', fontWeight: '500', fontSize: 13, lineHeight: 19 },
  returnRefundBox: {
    marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', padding: 12,
  },
  returnRefundText: { flex: 1, color: '#166534', fontWeight: '600', fontSize: 13, lineHeight: 19 },
  returnDetailMediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  returnDetailMedia: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F1F5F9' },
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
  invoiceUpi: { marginTop: 16, alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  invoiceUpiTitle: { color: '#0F172A', fontWeight: '900', fontSize: 13, marginBottom: 10 },
  invoiceUpiQr: { width: 180, height: 180, borderRadius: 10, backgroundColor: '#FFFFFF' },
  invoiceUpiAmt: { marginTop: 10, color: '#0F172A', fontWeight: '900', fontSize: 16 },
  invoiceUpiVpa: { marginTop: 2, color: '#475569', fontWeight: '700', fontSize: 11 },
  invoiceUpiBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 11, paddingHorizontal: 22, borderRadius: 12 },
  invoiceUpiBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  orderedThrough: { marginTop: 14, alignItems: 'center', paddingBottom: 10 },
  orderedLogoImage: { width: 44, height: 44, borderRadius: 8, resizeMode: 'contain' },
  orderedThroughSub: { marginTop: 4, fontSize: 11, color: '#475569', fontWeight: '700' },
  orderedThroughBrand: { color: '#DC2626', fontWeight: '900', fontSize: 15 },
  returnBtn: {
    borderWidth: 1,
    borderColor: '#C4B5FD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
  },
  returnBtnText: { fontWeight: '800', fontSize: 12, marginLeft: 5, color: '#7C3AED' },
  returnModalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
    backgroundColor: '#F8FAFC',
  },
  returnModalLabel: { color: '#334155', fontWeight: '800', fontSize: 12, marginTop: 12 },
  mediaPickRow: { flexDirection: 'row', gap: 8 },
  mediaPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
  },
  mediaPickBtnText: { color: '#6D28D9', fontWeight: '800', fontSize: 12 },
  mediaThumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  mediaThumbWrap: { position: 'relative' },
  mediaThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#F1F5F9' },
  mediaThumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  mediaVideoChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  mediaVideoChipText: { flex: 1, color: '#166534', fontWeight: '700', fontSize: 12 },
  returnModalSection: { color: '#7C3AED', fontWeight: '900', fontSize: 13, marginTop: 14, marginBottom: 2 },
  returnSubmitBtn: {
    marginTop: 18,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  returnSubmitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  returnSubmitBtnDisabled: { opacity: 0.6 },
});

export default OrdersScreen;
