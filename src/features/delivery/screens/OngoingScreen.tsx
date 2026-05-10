import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { skipToken } from '@reduxjs/toolkit/query';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useOrders } from '../../../hooks/useOrders';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import {
  useGetDirectionsRouteQuery,
  useLazyGeocodeAddressQuery,
  useUpdateDeliveryCurrentLocationMutation,
} from '../../../services/api/mobileApi';

type LatLng = { latitude: number; longitude: number };

const GREEN = '#16A34A';
const DARK_GREEN = '#14532D';
const WHITE = '#FFFFFF';

const OngoingScreen = () => {
  const { confirm } = useAppAlert();
  const { ongoing, setStatus } = useOrders();
  const activeOrder = ongoing[0];
  const mapRef = useRef<MapView>(null);

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [step, setStep] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);

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

  // Geocode address fallback
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
        // silently fall through — map stays empty
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
        edgePadding: { top: 140, right: 40, bottom: 320, left: 40 },
        animated: true,
      });
    }
  }, [origin, destination]);

  const openInGoogleMaps = () => {
    if (!destination) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    // In a real app, customer phone is fetched with order detail
    // Here we open a dial intent with a placeholder
    Linking.openURL('tel:');
  };

  const handlePrimaryAction = async () => {
    if (!activeOrder || isActionLoading) return;

    if (activeOrder.status === 'picked') {
      setIsActionLoading(true);
      try {
        await setStatus(activeOrder.id, 'en_route');
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    if (activeOrder.status === 'en_route') {
      const ok = await confirm({
        title: 'Mark as Delivered',
        message: `Confirm delivery for Order #${activeOrder.id}? This cannot be undone.`,
        confirmLabel: 'Yes, Delivered',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
      setIsActionLoading(true);
      try {
        await setStatus(activeOrder.id, 'delivered');
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const nextActionLabel =
    activeOrder?.status === 'picked'
      ? 'Start Trip'
      : activeOrder?.status === 'en_route'
        ? 'Mark as Delivered'
        : 'Delivered';

  const nextActionIcon =
    activeOrder?.status === 'picked' ? 'truck-fast-outline' : 'check-circle-outline';

  const statusColor =
    activeOrder?.status === 'en_route' ? '#2563EB' : GREEN;

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={['top']}>
        <Icon name="truck-outline" size={48} color="#BBF7D0" />
        <Text style={styles.emptyTitle}>No active delivery</Text>
        <Text style={styles.emptySubtitle}>Accept an order from the Assigned tab to begin</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
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

      {/* ── Top floating bar ── */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          {/* Order info pill */}
          <View style={styles.orderPill}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.orderPillText} numberOfLines={1}>
              {activeOrder.status === 'picked' ? 'Picked up' : 'En route'} · {activeOrder.customerName}
            </Text>
          </View>

          {/* Open in Maps */}
          <TouchableOpacity style={styles.iconButton} onPress={openInGoogleMaps} activeOpacity={0.85}>
            <Icon name="google-maps" size={20} color={DARK_GREEN} />
          </TouchableOpacity>
        </View>

        {/* Distance / ETA pill */}
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
      </SafeAreaView>

      {/* ── Bottom delivery card ── */}
      <View style={styles.bottomCard}>
        {/* Navigation instruction */}
        {currentInstruction ? (
          <View style={styles.instructionRow}>
            <Icon name="arrow-right-circle-outline" size={20} color={GREEN} />
            <Text style={styles.instructionText} numberOfLines={2}>
              {currentInstruction}
            </Text>
          </View>
        ) : null}

        {/* Customer info */}
        <View style={styles.customerRow}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{activeOrder.customerName}</Text>
            <Text style={styles.customerAddress} numberOfLines={2}>
              {activeOrder.address}
            </Text>
          </View>
          {/* Call button */}
          <TouchableOpacity style={styles.callButton} onPress={callCustomer} activeOpacity={0.85}>
            <Icon name="phone" size={20} color={GREEN} />
          </TouchableOpacity>
        </View>

        {/* Order meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Icon name="receipt" size={13} color="#166534" />
            <Text style={styles.metaChipText}>#{activeOrder.id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="currency-inr" size={13} color="#166534" />
            <Text style={styles.metaChipText}>{activeOrder.amount.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Primary action */}
        {activeOrder.status !== 'delivered' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              activeOrder.status === 'en_route' && styles.actionButtonDelivered,
              isActionLoading && styles.actionButtonDisabled,
            ]}
            onPress={handlePrimaryAction}
            activeOpacity={0.85}
            disabled={isActionLoading}>
            {isActionLoading ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <>
                <Icon name={nextActionIcon} size={18} color={WHITE} />
                <Text style={styles.actionButtonText}>{nextActionLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {activeOrder.status === 'delivered' && (
          <View style={styles.deliveredBanner}>
            <Icon name="check-circle" size={18} color={GREEN} />
            <Text style={styles.deliveredBannerText}>Delivered successfully</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },

  // Empty state
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

  // Map placeholder
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

  // Bottom card
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  instructionText: { flex: 1, color: DARK_GREEN, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerInfo: { flex: 1 },
  customerName: { fontWeight: '900', fontSize: 16, color: DARK_GREEN },
  customerAddress: { marginTop: 3, color: '#374151', fontSize: 13, lineHeight: 18 },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  metaChipText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  actionButton: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonDelivered: { backgroundColor: '#1D4ED8' },
  actionButtonDisabled: { opacity: 0.7 },
  actionButtonText: { color: WHITE, fontWeight: '900', fontSize: 15 },
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  deliveredBannerText: { color: DARK_GREEN, fontWeight: '900', fontSize: 15 },

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
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OngoingScreen;
