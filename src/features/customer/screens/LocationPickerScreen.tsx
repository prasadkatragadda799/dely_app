import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import { API_V1_BASE_URL } from '../../../services/api/config';

const DEFAULT_REGION = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const LocationPickerScreen = () => {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState('');
  const [isResolving, setIsResolving] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [pickedCoords, setPickedCoords] = useState({
    lat: DEFAULT_REGION.latitude,
    lng: DEFAULT_REGION.longitude,
  });

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsResolving(true);
    try {
      const res = await fetch(
        `${API_V1_BASE_URL}/maps/reverse-geocode?lat=${lat}&lng=${lng}`,
      );
      if (res.ok) {
        const json = await res.json();
        const d = json?.data;
        const text =
          [d?.address_line1, d?.city, d?.state].filter(Boolean).join(', ') ||
          [d?.city, d?.state].filter(Boolean).join(', ') ||
          'Unknown location';
        setAddress(text);
      } else {
        setAddress('Could not resolve address');
      }
    } catch {
      setAddress('Could not resolve address');
    } finally {
      setIsResolving(false);
    }
  }, []);

  const moveToCoords = useCallback(
    (latitude: number, longitude: number) => {
      setPickedCoords({ lat: latitude, lng: longitude });
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600,
      );
      reverseGeocode(latitude, longitude);
    },
    [reverseGeocode],
  );

  useEffect(() => {
    const fetchLocation = async () => {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          reverseGeocode(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
          return;
        }
      }

      // Try high-accuracy first; fall back to network/cached location
      Geolocation.getCurrentPosition(
        pos => {
          moveToCoords(pos.coords.latitude, pos.coords.longitude);
        },
        _err => {
          Geolocation.getCurrentPosition(
            pos => {
              moveToCoords(pos.coords.latitude, pos.coords.longitude);
            },
            _err2 => {
              reverseGeocode(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
      );
    };

    fetchLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRegionChangeComplete = useCallback(
    (r: Region) => {
      setPickedCoords({ lat: r.latitude, lng: r.longitude });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        reverseGeocode(r.latitude, r.longitude);
      }, 700);
    },
    [reverseGeocode],
  );

  const handleLocateMe = useCallback(async () => {
    if (isLocating) return;
    setIsLocating(true);
    Geolocation.getCurrentPosition(
      pos => {
        moveToCoords(pos.coords.latitude, pos.coords.longitude);
        setIsLocating(false);
      },
      () => {
        Geolocation.getCurrentPosition(
          pos => {
            moveToCoords(pos.coords.latitude, pos.coords.longitude);
            setIsLocating(false);
          },
          () => setIsLocating(false),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );
  }, [isLocating, moveToCoords]);

  const handleConfirm = useCallback(() => {
    const displayText =
      address.split(',').slice(0, 2).join(',').trim() || address;
    navigation.navigate('Home', {
      location: { text: displayText, lat: pickedCoords.lat, lng: pickedCoords.lng },
    });
  }, [navigation, address, pickedCoords]);

  return (
    <View style={styles.container}>
      {/* Uncontrolled map — animateToRegion moves it without snap-back */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Fixed center pin */}
      <View pointerEvents="none" style={styles.pinWrapper}>
        <Icon name="map-marker" size={48} color="#1D4ED8" />
        <View style={styles.pinShadow} />
      </View>

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#0B3B8F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set delivery location</Text>
      </SafeAreaView>

      {/* Locate me button */}
      <TouchableOpacity
        style={styles.locateBtn}
        onPress={handleLocateMe}
        disabled={isLocating}
        activeOpacity={0.85}>
        {isLocating ? (
          <ActivityIndicator size="small" color="#1D4ED8" />
        ) : (
          <Icon name="crosshairs-gps" size={22} color="#1D4ED8" />
        )}
      </TouchableOpacity>

      {/* Bottom address card */}
      <View style={styles.bottomCard}>
        <View style={styles.addressRow}>
          <Icon
            name="map-marker-outline"
            size={22}
            color="#1D4ED8"
            style={styles.addressIcon}
          />
          <View style={styles.addressTextWrap}>
            {isResolving ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Text style={styles.addressMain} numberOfLines={2}>
                {address || 'Move the map to set location'}
              </Text>
            )}
            <Text style={styles.addressHint}>Move the map to adjust pin</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (isResolving || !address) && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={isResolving || !address}
          activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>Confirm location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  pinWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinShadow: {
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: -6,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  addressIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressMain: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
    lineHeight: 22,
  },
  addressHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  confirmBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default LocationPickerScreen;
