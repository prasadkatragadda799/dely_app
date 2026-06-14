import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { skipToken } from '@reduxjs/toolkit/query';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import Toast from 'react-native-toast-message';
import { useOrders } from '../../../hooks/useOrders';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import { Order } from '../../../types';
import {
  useGetDirectionsRouteQuery,
  useGetPaymentQrQuery,
  useLazyGeocodeAddressQuery,
  useUpdateDeliveryCurrentLocationMutation,
} from '../../../services/api/mobileApi';

type LatLng = { latitude: number; longitude: number };

const GREEN = '#16A34A';
const DARK_GREEN = '#14532D';
const WHITE = '#FFFFFF';
const RED = '#DC2626';
const AMBER = '#D97706';

const formatPhoneForCall = (raw?: string): string | null => {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  return cleaned.length >= 10 ? cleaned : null;
};

const OngoingScreen = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const { confirm } = useAppAlert();
  const { ongoing, setStatus, revertToHub, refetchOrders } = useOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'qr'>('cash');

  const { data: paymentQrData } = useGetPaymentQrQuery();

  // Active = the order whose map/route is being shown. Default to the first
  // ongoing order, but allow the courier to pick a different one when they
  // have multiple in flight.
  const activeOrder = useMemo<Order | null>(() => {
    if (ongoing.length === 0) return null;
    return ongoing.find(o => o.id === activeOrderId) ?? ongoing[0];
  }, [ongoing, activeOrderId]);

  const mapRef = useRef<MapView>(null);

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [step, setStep] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [updateDeliveryCurrentLocation] = useUpdateDeliveryCurrentLocationMutation();
  const [geocodeAddress, { isFetching: isGeocoding }] = useLazyGeocodeAddressQuery();

  // Resolve destination from coordinates or geocode address
  const destinationFromCoords: LatLng | null =
    typeof activeOrder?.customerLatitude === 'number' &&
    typeof activeOrder?.customerLongitude === 'number'
      ? { latitude: activeOrder.customerLatitude, longitude: activeOrder.customerLongitude }
      : null;

  const destination = destinationFromCoords ?? resolvedDestination;

  const directionsArgs = useMemo(
    () =>
      origin && destination
        ? {
            originLat: origin.latitude,
            originLng: origin.longitude,
            destinationLat: destination.latitude,
            destinationLng: destination.longitude,
            mode: 'driving' as const,
          }
        : skipToken,
    [origin, destination],
  );

  const { data: directionsRes, isFetching: isDirectionsFetching } =
    useGetDirectionsRouteQuery(directionsArgs);

  const firstRoute = directionsRes?.data?.routes?.[0];
  const steps = firstRoute?.steps ?? [];
  const currentInstruction =
    steps.length > 0 ? steps[Math.min(step, steps.length - 1)]?.instruction : null;
  const distanceText = firstRoute?.distanceText ?? null;
  const durationText = firstRoute?.durationText ?? null;

  // Update route when directions load
  useEffect(() => {
    setStep(0);
    const pts = directionsRes?.data?.routes?.[0]?.routePoints ?? [];
    setRoute(pts);
  }, [directionsRes]);

  // Geocode address fallback for the active order
  useEffect(() => {
    const resolve = async () => {
      if (!activeOrder || destinationFromCoords) {
        setResolvedDestination(null);
        return;
      }
      const address = (activeOrder.address || '').trim();
      if (!address) return;
      try {
        const res = await geocodeAddress({ address }).unwrap();
        const d = res?.data;
        if (typeof d?.latitude === 'number' && typeof d?.longitude === 'number') {
          setResolvedDestination({ latitude: d.latitude, longitude: d.longitude });
        }
      } catch {
        // map will stay empty
      }
    };
    resolve();
  }, [activeOrder, destinationFromCoords, geocodeAddress]);

  // Live GPS tracking with backend sync
  useEffect(() => {
    const requestPerm = async () => {
      if (Platform.OS !== 'android') return true;
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    const poll = async () => {
      const ok = await requestPerm();
      if (!ok) return;
      Geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords;
          if (mounted) setOrigin({ latitude, longitude });
          try {
            await updateDeliveryCurrentLocation({ latitude, longitude }).unwrap();
          } catch {
            // non-fatal
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    };

    poll();
    interval = setInterval(poll, 15000);
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [updateDeliveryCurrentLocation]);

  // Fit map to show both markers when route loads
  useEffect(() => {
    if (origin && destination && mapRef.current) {
      mapRef.current.fitToCoordinates([origin, destination], {
        edgePadding: { top: 140, right: 40, bottom: 360, left: 40 },
        animated: true,
      });
    }
  }, [origin, destination]);

  const openInGoogleMaps = (dest: LatLng | null) => {
    if (!dest) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const callCustomer = (order: Order) => {
    const phone = formatPhoneForCall(order.customerPhone);
    if (!phone) {
      Toast.show({
        type: 'error',
        text1: 'No phone number',
        text2: "This order doesn't have a customer phone on file.",
      });
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Toast.show({ type: 'error', text1: 'Could not start call' });
    });
  };

  const handleStartTrip = async (order: Order) => {
    if (actionLoadingId) return;
    setActionLoadingId(order.id);
    try {
      await setStatus(order.id, 'en_route');
      Toast.show({ type: 'success', text1: 'Trip started' });
      await refetchOrders();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not start trip', text2: 'Please try again.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDelivered = (order: Order) => {
    if (actionLoadingId) return;
    setPaymentMode('cash');
    setPaymentOrder(order);
  };

  const confirmDelivery = async () => {
    if (!paymentOrder) return;
    const order = paymentOrder;
    setPaymentOrder(null);
    setActionLoadingId(order.id);
    try {
      await setStatus(order.id, 'delivered');
      Toast.show({ type: 'success', text1: 'Order marked as delivered' });
      await refetchOrders();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not update order' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevertToHub = async (order: Order) => {
    if (actionLoadingId) return;
    const ok = await confirm({
      title: 'Return to Hub',
      message:
        'The customer is unreachable. Returning this order to the hub will release it for reassignment. Continue?',
      confirmLabel: 'Return to Hub',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    setActionLoadingId(order.id);
    try {
      await revertToHub(order.id, 'Customer unreachable');
      Toast.show({ type: 'success', text1: 'Returned to hub for reassignment' });
      await refetchOrders();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not return order',
        text2: err?.data?.detail ?? err?.data?.message ?? 'Please try again.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={['top']}>
        <Icon name="truck-outline" size={48} color="#BBF7D0" />
        <Text style={styles.emptyTitle}>No active delivery</Text>
        <Text style={styles.emptySubtitle}>Accept an order from the Assigned tab to begin</Text>
      </SafeAreaView>
    );
  }

  const statusColor =
    activeOrder.status === 'en_route' ? '#2563EB' : GREEN;

  const renderOrderCard = (order: Order, isActive: boolean) => {
    const isLoading = actionLoadingId === order.id;
    const orderShortId = (order.orderNumber ?? order.id).toString().slice(-8).toUpperCase();
    return (
      <View
        key={order.id}
        style={[
          styles.orderCard,
          isActive && styles.orderCardActive,
        ]}
      >
        {/* Customer header */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setActiveOrderId(order.id)}
          style={styles.cardHeaderRow}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              {isActive && <View style={[styles.activeDot, { backgroundColor: statusColor }]} />}
              <Text style={styles.customerName} numberOfLines={1}>
                {order.customerName}
              </Text>
            </View>
            <Text style={styles.customerAddress} numberOfLines={2}>
              {order.address}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Icon name="receipt" size={11} color="#166534" />
                <Text style={styles.metaChipText}>#{orderShortId}</Text>
              </View>
              <View style={styles.metaChip}>
                <Icon name="currency-inr" size={11} color="#166534" />
                <Text style={styles.metaChipText}>{order.amount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.metaChip, order.status === 'en_route' ? styles.metaChipBlue : styles.metaChipGreen]}>
                <Text style={[styles.metaChipText, { color: WHITE }]}>
                  {order.status === 'en_route' ? 'En route' : 'Picked up'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.callButton, !order.customerPhone && styles.callButtonDisabled]}
            onPress={() => callCustomer(order)}
            activeOpacity={0.85}
          >
            <Icon name="phone" size={18} color={order.customerPhone ? GREEN : '#9CA3AF'} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Phone display (so the courier can read it even if call fails) */}
        {order.customerPhone ? (
          <Text style={styles.phoneText}>📞 {order.customerPhone}</Text>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {order.status === 'picked' ? (
            <TouchableOpacity
              style={[styles.actionPrimary, isLoading && styles.actionDisabled]}
              onPress={() => handleStartTrip(order)}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Icon name="truck-fast-outline" size={16} color={WHITE} />
                  <Text style={styles.actionPrimaryText}>Start Trip</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionPrimary, styles.actionPrimaryBlue, isLoading && styles.actionDisabled]}
              onPress={() => handleMarkDelivered(order)}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Icon name="check-circle-outline" size={16} color={WHITE} />
                  <Text style={styles.actionPrimaryText}>Mark Delivered</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionSecondary, isLoading && styles.actionDisabled]}
            onPress={() => handleRevertToHub(order)}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={AMBER} />
            ) : (
              <>
                <Icon name="undo-variant" size={16} color={AMBER} />
                <Text style={styles.actionSecondaryText}>Return to Hub</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map for the active order */}
      {origin && destination ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: origin.latitude,
            longitude: origin.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
          showsUserLocation
          showsMyLocationButton={false}>
          <Marker coordinate={origin} title="You">
            <View style={styles.myLocationDot}>
              <Icon name="navigation" size={14} color={WHITE} />
            </View>
          </Marker>
          <Marker coordinate={destination} title={activeOrder.customerName}>
            <View style={styles.destMarker}>
              <Icon name="home-map-marker" size={18} color={WHITE} />
            </View>
          </Marker>
          {route.length > 0 && (
            <Polyline coordinates={route} strokeWidth={5} strokeColor={GREEN} />
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          {isGeocoding || !origin ? (
            <ActivityIndicator size="large" color={GREEN} />
          ) : (
            <Icon name="map-search-outline" size={40} color="#BBF7D0" />
          )}
          <Text style={styles.mapPlaceholderText}>
            {!origin ? 'Getting your location…' : 'Resolving delivery address…'}
          </Text>
        </View>
      )}

      {/* Top bar — count + nav helper */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          <View style={styles.orderPill}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.orderPillText} numberOfLines={1}>
              {ongoing.length} active deliver{ongoing.length === 1 ? 'y' : 'ies'} · {activeOrder.customerName}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => openInGoogleMaps(destination)}
            activeOpacity={0.85}
            disabled={!destination}
          >
            <Icon name="google-maps" size={20} color={destination ? DARK_GREEN : '#9CA3AF'} />
          </TouchableOpacity>
        </View>

        {(distanceText || durationText) && (
          <View style={styles.etaPill}>
            <Icon name="clock-fast" size={14} color={DARK_GREEN} />
            <Text style={styles.etaText}>
              {[durationText, distanceText].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
        )}
        {isDirectionsFetching && (
          <View style={styles.etaPill}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={styles.etaText}>Loading route…</Text>
          </View>
        )}
        {currentInstruction ? (
          <View style={styles.instructionPill}>
            <Icon name="arrow-right-circle-outline" size={16} color={GREEN} />
            <Text style={styles.instructionText} numberOfLines={2}>
              {currentInstruction}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Bottom: scrollable list of all ongoing deliveries */}
      <View style={[styles.bottomSheet, { bottom: tabBarHeight }]}>
        <View style={styles.bottomHandle} />
        <FlatList
          data={ongoing}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderOrderCard(item, item.id === activeOrder.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Payment Collection Modal */}
      <Modal
        visible={!!paymentOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Collect Payment</Text>
                <Text style={styles.modalSubtitle}>
                  ₹{paymentOrder?.amount.toLocaleString('en-IN')} from {paymentOrder?.customerName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentOrder(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Mode tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, paymentMode === 'cash' && styles.modeTabActive]}
                onPress={() => setPaymentMode('cash')}
                activeOpacity={0.85}>
                <Icon name="cash" size={18} color={paymentMode === 'cash' ? GREEN : '#6B7280'} />
                <Text style={[styles.modeTabText, paymentMode === 'cash' && styles.modeTabTextActive]}>
                  Cash
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, paymentMode === 'qr' && styles.modeTabActive]}
                onPress={() => setPaymentMode('qr')}
                activeOpacity={0.85}>
                <Icon name="qrcode-scan" size={18} color={paymentMode === 'qr' ? GREEN : '#6B7280'} />
                <Text style={[styles.modeTabText, paymentMode === 'qr' && styles.modeTabTextActive]}>
                  QR / UPI
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode content */}
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 8 }}>
              {paymentMode === 'cash' ? (
                <View style={styles.cashBox}>
                  <Icon name="cash-multiple" size={40} color={GREEN} />
                  <Text style={styles.cashAmount}>
                    ₹{paymentOrder?.amount.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.cashHint}>
                    Collect exact cash from the customer before confirming delivery.
                  </Text>
                </View>
              ) : paymentQrData?.data?.paymentQrUrl ? (
                <View style={styles.qrBox}>
                  <Text style={styles.qrHint}>Show this QR to the customer to scan & pay</Text>
                  <Image
                    source={{ uri: paymentQrData.data.paymentQrUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.qrAmount}>₹{paymentOrder?.amount.toLocaleString('en-IN')}</Text>
                </View>
              ) : (
                <View style={styles.cashBox}>
                  <Icon name="qrcode-remove" size={40} color="#9CA3AF" />
                  <Text style={styles.cashHint}>
                    No QR code configured yet.{'\n'}Ask your admin to upload one in Settings.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Confirm button */}
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={confirmDelivery}
              activeOpacity={0.88}>
              <Icon name="check-circle-outline" size={20} color={WHITE} />
              <Text style={styles.confirmBtnText}>
                {paymentMode === 'cash' ? 'Cash Collected — Mark Delivered' : 'Payment Done — Mark Delivered'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: DARK_GREEN, marginTop: 8 },
  emptySubtitle: { textAlign: 'center', color: '#166534', fontWeight: '500', lineHeight: 20 },

  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mapPlaceholderText: { color: '#15803D', fontWeight: '600', fontSize: 14 },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  topBarInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  orderPillText: { flex: 1, fontWeight: '700', color: DARK_GREEN, fontSize: 13 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  etaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: WHITE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  etaText: { fontWeight: '700', color: DARK_GREEN, fontSize: 13 },
  instructionPill: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  instructionText: { flex: 1, color: DARK_GREEN, fontWeight: '700', fontSize: 12, lineHeight: 16 },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  bottomHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  listContent: { paddingHorizontal: 14, paddingBottom: 4 },

  // Order card
  orderCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderCardActive: {
    borderColor: GREEN,
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  customerName: { fontWeight: '900', fontSize: 15, color: DARK_GREEN, flex: 1 },
  customerAddress: { color: '#374151', fontSize: 12, lineHeight: 16, marginTop: 2 },
  phoneText: { color: '#0F766E', fontSize: 12, fontWeight: '700', marginTop: 6 },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  metaChipText: { color: '#166534', fontWeight: '700', fontSize: 11 },
  metaChipGreen: { backgroundColor: GREEN, borderColor: GREEN },
  metaChipBlue: { backgroundColor: '#2563EB', borderColor: '#2563EB' },

  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonDisabled: { opacity: 0.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },

  actionRow: { flexDirection: 'column', gap: 8, marginTop: 10 },
  actionPrimary: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPrimaryBlue: { backgroundColor: '#2563EB' },
  actionPrimaryText: { color: WHITE, fontWeight: '900', fontSize: 13 },
  actionDisabled: { opacity: 0.6 },

  actionSecondary: {
    borderWidth: 1.5,
    borderColor: AMBER,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
  },
  actionSecondaryText: { color: AMBER, fontWeight: '900', fontSize: 13 },

  // Markers
  myLocationDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RED,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Payment modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modeTabActive: {
    borderColor: GREEN,
    backgroundColor: '#F0FDF4',
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  modeTabTextActive: {
    color: GREEN,
  },
  modalBody: {
    maxHeight: 320,
  },
  cashBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  cashAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: DARK_GREEN,
    letterSpacing: -1,
  },
  cashHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  qrBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  qrHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: DARK_GREEN,
  },
  confirmBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 15,
  },
});

export default OngoingScreen;
