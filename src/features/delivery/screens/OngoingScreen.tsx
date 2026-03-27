import React, { useEffect, useMemo, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useOrders } from '../../../hooks/useOrders';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { themes } from '../../../utils/theme';
import {
  useGetDirectionsRouteQuery,
  useLazyGeocodeAddressQuery,
  useUpdateDeliveryCurrentLocationMutation,
} from '../../../services/api/mobileApi';

type LatLng = { latitude: number; longitude: number };

const OngoingScreen = () => {
  const { ongoing, setStatus } = useOrders();
  const activeOrder = ongoing[0];
  const [route, setRoute] = useState<LatLng[]>([]);
  const [step, setStep] = useState(0);

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [updateDeliveryCurrentLocation] = useUpdateDeliveryCurrentLocationMutation();
  const [geocodeAddress, { isFetching: isGeocoding }] = useLazyGeocodeAddressQuery();
  const [resolvedDestination, setResolvedDestination] = useState<LatLng | null>(null);

  const destinationFromCoords: LatLng | null =
    typeof activeOrder?.customerLatitude === 'number' &&
    typeof activeOrder?.customerLongitude === 'number'
      ? {
          latitude: activeOrder.customerLatitude,
          longitude: activeOrder.customerLongitude,
        }
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

  const {
    data: directionsRes,
    isFetching: isDirectionsFetching,
  } = useGetDirectionsRouteQuery(directionsArgs);

  const firstRoute = directionsRes?.data?.routes?.[0];
  const steps = firstRoute?.steps ?? [];
  const currentInstruction = steps.length
    ? steps[Math.min(step, steps.length - 1)]?.instruction
    : undefined;

  useEffect(() => {
    // Reset step when a new route is loaded.
    setStep(0);
    const newRoute = directionsRes?.data?.routes?.[0]?.routePoints ?? [];
    setRoute(newRoute);
  }, [directionsRes]);

  useEffect(() => {
    const resolveDestination = async () => {
      if (!activeOrder) {
        setResolvedDestination(null);
        return;
      }
      if (destinationFromCoords) {
        setResolvedDestination(null);
        return;
      }
      const address = (activeOrder.address || '').trim();
      if (!address) {
        setResolvedDestination(null);
        return;
      }

      try {
        const res = await geocodeAddress({ address }).unwrap();
        const data = res?.data;
        if (
          typeof data?.latitude === 'number' &&
          typeof data?.longitude === 'number'
        ) {
          setResolvedDestination({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        } else {
          setResolvedDestination(null);
        }
      } catch {
        setResolvedDestination(null);
      }
    };

    resolveDestination();
  }, [activeOrder, destinationFromCoords, geocodeAddress]);

  useEffect(() => {
    const requestLocationPermissionAndroid = async () => {
      if (Platform.OS !== 'android') return true;
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    };

    let intervalRef: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const loadOrigin = async () => {
      try {
        const ok = await requestLocationPermissionAndroid();
        if (!ok) return;

        const geo = (globalThis as any)?.navigator?.geolocation;
        if (!geo?.getCurrentPosition) return;

        geo.getCurrentPosition(
          async (pos: any) => {
            const coords = pos?.coords;
            if (
              typeof coords?.latitude === 'number' &&
              typeof coords?.longitude === 'number'
            ) {
              const nextOrigin = {
                latitude: coords.latitude,
                longitude: coords.longitude,
              };
              if (isMounted) setOrigin(nextOrigin);
              try {
                await updateDeliveryCurrentLocation(nextOrigin).unwrap();
              } catch {
                // Ignore API write failures; map can still show local GPS.
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
        );
      } catch {
        // Ignore; map will stay empty.
      }
    };

    loadOrigin();
    intervalRef = setInterval(() => {
      loadOrigin();
    }, 15000);

    return () => {
      isMounted = false;
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [updateDeliveryCurrentLocation]);

  const moveStatus = async () => {
    if (!activeOrder) {
      return;
    }
    if (activeOrder.status === 'picked') {
      await setStatus(activeOrder.id, 'en_route');
      setStep(prev => Math.min(prev + 1, route.length - 1));
      return;
    }
    if (activeOrder.status === 'en_route') {
      await setStatus(activeOrder.id, 'delivered');
    }
  };

  const statusLabel =
    activeOrder?.status === 'picked'
        ? 'Picked up'
        : activeOrder?.status === 'en_route'
          ? 'On the way'
          : activeOrder?.status === 'delivered'
            ? 'Delivered'
            : 'No active order';

  const nextActionLabel =
    activeOrder?.status === 'picked'
      ? 'Start Trip'
      : activeOrder?.status === 'en_route'
        ? 'Mark Delivered'
        : 'Advance Status';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ongoing Delivery</Text>
      <Text style={styles.subtitle}>Track progress and complete quickly</Text>

      <View style={styles.mapPlaceholder}>
        {origin && destination ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: origin.latitude,
              longitude: origin.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}>
            <Marker coordinate={origin} title="Your location" />
            <Marker coordinate={destination} pinColor="#DC2626" title="Customer" />
            {!!route.length && <Polyline coordinates={route} strokeWidth={5} strokeColor="#16A34A" />}
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Icon name="map-marker-path" size={20} color="#16A34A" />
            <Text style={styles.mapText}>Route preview (waiting for location)</Text>
          </View>
        )}

        <View style={styles.mapContent}>
          <View style={styles.mapOverlay}>
            <Icon name="map-marker-path" size={20} color="#16A34A" />
            <Text style={styles.mapText}>
              {isDirectionsFetching || isGeocoding
                ? 'Loading route...'
                : firstRoute?.distanceText && firstRoute?.durationText
                  ? `${firstRoute.distanceText} • ${firstRoute.durationText}`
                  : 'Live route preview'}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{route.length}</Text>
              <Text style={styles.metricLabel}>Route points</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {Math.min(step + 1, route.length || 1)}
              </Text>
              <Text style={styles.metricLabel}>Current step</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{statusLabel}</Text>
              <Text style={styles.metricLabel}>Status</Text>
            </View>
          </View>

          <View style={styles.locationWrap}>
            <View style={styles.locationRow}>
              <Icon name="crosshairs-gps" size={16} color="#15803D" />
              <Text style={styles.mapSubtext}>
                Lat: {origin?.latitude?.toFixed?.(4) ?? '0.0000'}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="crosshairs" size={16} color="#15803D" />
              <Text style={styles.mapSubtext}>
                Lng: {origin?.longitude?.toFixed?.(4) ?? '0.0000'}
              </Text>
            </View>
            {!!currentInstruction && (
              <View style={styles.locationRow}>
                <Icon name="map-marker-outline" size={16} color="#15803D" />
                <Text style={styles.mapSubtext}>{currentInstruction}</Text>
              </View>
            )}
            <View style={styles.locationRow}>
              <Icon name="clipboard-list-outline" size={16} color="#15803D" />
              <Text style={styles.mapSubtext}>
                {activeOrder ? `${activeOrder.id} (${statusLabel})` : 'No ongoing order'}
              </Text>
            </View>
          </View>

          {!!activeOrder && activeOrder.status !== 'delivered' && (
            <TouchableOpacity style={styles.action} onPress={() => moveStatus()}>
              <Icon name="truck-fast-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionText}>{nextActionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themes.delivery.accent, padding: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#14532D' },
  subtitle: { marginTop: 3, color: '#15803D', fontWeight: '600', marginBottom: 12 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapContent: { flex: 1, gap: 12, position: 'relative', zIndex: 2 },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  mapOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 3,
  },
  mapText: { fontSize: 13, fontWeight: '800', color: '#166534', marginLeft: 6 },
  metricsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F8FFF9',
    borderRadius: 12,
    padding: 10,
  },
  metricValue: { color: '#14532D', fontWeight: '900', fontSize: 14 },
  metricLabel: { color: '#15803D', marginTop: 2, fontSize: 11, fontWeight: '700' },
  locationWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F8FFF9',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  mapSubtext: { color: '#15803D', marginLeft: 8, fontWeight: '600', flex: 1 },
  action: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionText: { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 },
});

export default OngoingScreen;
