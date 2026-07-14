import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import Geolocation from 'react-native-geolocation-service';
import { useAuth } from '../../../hooks/useAuth';
import { useAppSelector } from '../../../hooks/redux';
import { CustomerProfileStackParamList } from '../../../navigation/types';
import {
  useCreateDeliveryLocationMutation,
  useDeleteDeliveryLocationMutation,
  useGetDeliveryLocationsQuery,
  useGetKycStatusQuery,
  useGetProfileQuery,
  useLazyReverseGeocodeQuery,
  useSkipKycMutation,
  useSubmitKycMutation,
  useUpdateDeliveryLocationMutation,
  useUploadKycImageMutation,
} from '../../../services/api/mobileApi';
import type { BusinessProfile } from '../businessProfileSlice';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import { palette, shadow, getDivision } from '../../../utils/theme';

function KycDocTile({ uri, label }: { uri?: string; label: string }) {
  return (
    <View style={styles.docBox}>
      {uri ? (
        <Image source={{ uri }} style={styles.docImg} />
      ) : (
        <View style={[styles.docImg, styles.docPlaceholder]}>
          <Text style={styles.docPlaceholderText}>Not uploaded</Text>
        </View>
      )}
      <Text style={styles.docLabel}>{label}</Text>
    </View>
  );
}

function hasAnyAddress(bp: BusinessProfile) {
  return Boolean(
    bp.addressLine1?.trim() ||
      bp.addressLine2?.trim() ||
      bp.city?.trim() ||
      bp.state?.trim() ||
      bp.pincode?.trim(),
  );
}

const ProfileScreen = () => {
  const { alert: appAlert, confirm } = useAppAlert();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomerProfileStackParamList>>();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const primary = getDivision(homeDivision).primary;
  const business = useAppSelector(state => state.businessProfile?.profile ?? null);

  // Profile data for pre-filling new address form.
  const { data: profileRes } = useGetProfileQuery();
  const profile = profileRes?.data as any;
  const businessAddress = profile?.address;
  const profileAddressLine1 =
    typeof businessAddress === 'object' && businessAddress
      ? businessAddress.address_line1 ?? businessAddress.addressLine1 ?? businessAddress.address ?? ''
      : '';
  const profileAddressLine2 =
    typeof businessAddress === 'object' && businessAddress
      ? businessAddress.address_line2 ?? businessAddress.addressLine2 ?? businessAddress.landmark ?? ''
      : '';
  const profileCity = profile?.city ?? profile?.businessCity ?? '';
  const profileState = profile?.state ?? profile?.businessState ?? '';
  const profilePincode = profile?.pincode ?? profile?.businessPincode ?? '';

  // Saved delivery addresses.
  const {
    data: savedAddressesEnvelope,
    refetch: refetchSavedAddresses,
    isLoading: isLoadingSavedAddresses,
  } = useGetDeliveryLocationsQuery(undefined, { skip: !user });
  type SavedAddress = {
    id: string; address_line1?: string; address_line2?: string;
    city?: string; state?: string; pincode?: string;
    type?: string; is_default?: boolean;
  };
  const savedAddresses = useMemo<SavedAddress[]>(
    () => ((savedAddressesEnvelope?.data as SavedAddress[]) ?? []) || [],
    [savedAddressesEnvelope],
  );
  const [createDeliveryLocation, { isLoading: isSavingAddress }] = useCreateDeliveryLocationMutation();
  const [deleteDeliveryLocation, { isLoading: isDeletingAddress }] = useDeleteDeliveryLocationMutation();
  const [updateDeliveryLocation, { isLoading: isSettingDefault }] = useUpdateDeliveryLocationMutation();
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const handleSetDefaultAddress = async (addr: SavedAddress) => {
    if (addr.is_default) return;
    setSettingDefaultId(addr.id);
    try {
      await updateDeliveryLocation({
        locationId: addr.id,
        address_line1: addr.address_line1 || '',
        address_line2: addr.address_line2 || undefined,
        city: addr.city || '',
        state: addr.state || '',
        pincode: addr.pincode || '',
        type: (addr.type as 'home' | 'office' | 'other') || 'home',
        is_default: true,
      } as any).unwrap();
      await refetchSavedAddresses();
      Toast.show({ type: 'success', text1: 'Default address updated' });
    } catch (err: any) {
      const serverMessage = err?.data?.detail || err?.data?.message;
      Toast.show({
        type: 'error',
        text1: 'Could not set default address',
        text2: typeof serverMessage === 'string' ? serverMessage : 'Please try again.',
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const ok = await confirm({
      title: 'Delete address',
      message: 'Are you sure you want to delete this address?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeletingAddressId(id);
    try {
      await deleteDeliveryLocation({ locationId: id }).unwrap();
      await refetchSavedAddresses();
      Toast.show({ type: 'success', text1: 'Address deleted' });
    } catch (err: any) {
      const serverMessage = err?.data?.detail || err?.data?.message;
      Toast.show({
        type: 'error',
        text1: 'Could not delete address',
        text2: typeof serverMessage === 'string' ? serverMessage : 'Please try again.',
      });
    } finally {
      setDeletingAddressId(null);
    }
  };

  // Add new address form state.
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editLine1, setEditLine1] = useState('');
  const [editLine2, setEditLine2] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [newAddrType, setNewAddrType] = useState<'home' | 'office' | 'other'>('home');
  const [reverseGeocode, { isFetching: isReverseGeocoding }] = useLazyReverseGeocodeQuery();
  const [isLocating, setIsLocating] = useState(false);

  const requestLocationPermissionAndroid = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const handleUseMyLocation = async () => {
    try {
      const ok = await requestLocationPermissionAndroid();
      if (!ok) {
        Toast.show({
          type: 'error',
          text1: 'Location permission denied',
          text2: 'Please allow location permission and try again.',
        });
        return;
      }

      setIsLocating(true);
      Geolocation.getCurrentPosition(
        async pos => {
          try {
            const lat = pos?.coords?.latitude;
            const lng = pos?.coords?.longitude;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
              throw new Error('Missing lat/lng from device');
            }

            const res = await reverseGeocode({ lat, lng }).unwrap();
            const data = res?.data;

            if (!data?.address_line1) {
              Toast.show({
                type: 'error',
                text1: 'Could not resolve address',
                text2: 'Google did not return address details for this location.',
              });
              return;
            }

            setEditLine1(data.address_line1 ?? '');
            setEditLine2(data.address_line2 ?? '');
            setEditCity(data.city ?? '');
            setEditState(data.state ?? '');
            setEditPincode(data.pincode ?? '');
          } catch {
            Toast.show({
              type: 'error',
              text1: 'Location resolution failed',
              text2: 'Please try again or enter address manually.',
            });
          } finally {
            setIsLocating(false);
          }
        },
        () => {
          setIsLocating(false);
          Toast.show({ type: 'error', text1: 'Failed to get your location', text2: 'Please try again.' });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    } catch {
      Toast.show({ type: 'error', text1: 'Could not fetch location' });
      setIsLocating(false);
    }
  };

  const openAddForm = (prefill = false) => {
    setEditLine1(prefill ? profileAddressLine1 : '');
    setEditLine2(prefill ? profileAddressLine2 : '');
    setEditCity(prefill ? profileCity : '');
    setEditState(prefill ? profileState : '');
    setEditPincode(prefill ? profilePincode : '');
    setNewAddrType('home');
    setIsAddingAddress(true);
  };

  const handleSaveAddress = async () => {
    const pincode = editPincode.trim();
    if (!editLine1.trim() || !editCity.trim() || !editState.trim() || !/^\d{6}$/.test(pincode)) {
      Toast.show({
        type: 'error',
        text1: 'Please complete all required fields',
        text2: 'Address line 1, city, state, and a 6-digit pincode are required.',
      });
      return;
    }
    try {
      await createDeliveryLocation({
        address_line1: editLine1.trim(),
        address_line2: editLine2.trim() || undefined,
        city: editCity.trim(),
        state: editState.trim(),
        pincode,
        type: newAddrType,
        is_default: true,
      } as any).unwrap();
      await refetchSavedAddresses();
      setIsAddingAddress(false);
      Toast.show({ type: 'success', text1: 'Address saved' });
    } catch (err: any) {
      const serverMessage = err?.data?.detail || err?.data?.message;
      Toast.show({
        type: 'error',
        text1: 'Could not save address',
        text2: typeof serverMessage === 'string' ? serverMessage : 'Please try again.',
      });
    }
  };

  const {
    data: kycEnvelope,
    isLoading: isKycLoading,
    refetch: refetchKyc,
  } = useGetKycStatusQuery(undefined, { skip: !user });
  const [uploadKycImageApi] = useUploadKycImageMutation();
  const [submitKycApi, { isLoading: isSubmittingKyc }] = useSubmitKycMutation();
  const [skipKycApi, { isLoading: isSkippingKyc }] = useSkipKycMutation();

  const kycStatus = useMemo(() => {
    const data: any = kycEnvelope?.data;
    return data?.kyc_status ?? data?.kycStatus ?? data?.kycStatus ?? null;
  }, [kycEnvelope]);

  const canSubmitKyc = useMemo(() => {
    if (!business) return false;
    if (!user) return false;
    if (kycStatus === 'verified') return false;
    return true;
  }, [business, user, kycStatus]);

  const handleSubmitKyc = async () => {
    if (!business) {
      await appAlert({
        title: 'Business details missing',
        message: 'Please complete your registration first.',
      });
      return;
    }

    // FSSAI is optional; only validate format when provided.
    const fssaiDigits = (business.fmcgNumber ?? '').toString().replace(/\D/g, '');
    if (fssaiDigits.length > 0 && fssaiDigits.length !== 14) {
      await appAlert({
        title: 'Invalid FSSAI number',
        message: 'FSSAI must be exactly 14 digits. Please correct your FSSAI number.',
      });
      return;
    }

    const uploadIfLocal = async (uri?: string): Promise<string | undefined> => {
      if (!uri || !uri.startsWith('file://')) return uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      const form = new FormData();
      form.append('file', { uri, name: `kyc.${ext}`, type: `image/${ext}` } as any);
      const res = await uploadKycImageApi(form).unwrap();
      return (res as any)?.data?.url ?? uri;
    };

    try {
      const shopUrl = await uploadIfLocal(business.shopImageUri ?? undefined);
      const fssaiUrl = await uploadIfLocal(business.fssaiLicense ?? undefined);
      const gstCertUrl = await uploadIfLocal(business.gstCertificate ?? undefined);
      const udyamUrl = await uploadIfLocal(business.udyamRegistration ?? undefined);
      const tradeCertUrl = await uploadIfLocal(business.tradeCertificate ?? undefined);

      await submitKycApi({
        business_name: business.businessName,
        gst_number: business.gstNumber || undefined,
        fssai_number: fssaiDigits.length === 14 ? fssaiDigits : undefined,
        shop_image_url: shopUrl,
        fssai_license_image_url: fssaiUrl,
        documents: {
          ...(gstCertUrl ? { gst_certificate: gstCertUrl } : {}),
          ...(udyamUrl ? { udyam_registration: udyamUrl } : {}),
          ...(tradeCertUrl ? { trade_certificate: tradeCertUrl } : {}),
        },
      }).unwrap();

      await refetchKyc();
      await appAlert({
        title: 'KYC submitted',
        message: 'Your verification is now under review.',
      });
    } catch (e: any) {
      const msg =
        e?.data?.message ??
        e?.error ??
        e?.data?.detail ??
        'Failed to submit KYC. Please try again.';
      await appAlert({ title: 'KYC submit failed', message: String(msg) });
    }
  };

  const handleSkipKyc = async () => {
    try {
      await skipKycApi().unwrap();
      await refetchKyc();
      await appAlert({
        title: 'KYC skipped',
        message: 'You can complete KYC later from your profile.',
      });
    } catch (e: any) {
      const msg = e?.data?.message ?? e?.error ?? 'Failed to skip KYC.';
      await appAlert({ title: 'KYC skip failed', message: String(msg) });
    }
  };

  const handleLogoutPress = async () => {
    const ok = await confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (ok) {
      void logout();
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: primary }]}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Icon name="account" size={34} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.name ?? 'Guest User'}
              </Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.email ?? '—'}
              </Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {(user?.role ?? 'customer').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Quick actions</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('EditInfo')}>
            <View style={[styles.actionIcon, { backgroundColor: `${primary}22` }]}>
              <Icon name="pencil-outline" size={18} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Edit Info</Text>
              <Text style={styles.actionSubtitle}>Update your profile details</Text>
            </View>
            <Icon name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('Security')}>
            <View style={[styles.actionIcon, { backgroundColor: `${primary}22` }]}>
              <Icon name="shield-check-outline" size={18} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Security</Text>
              <Text style={styles.actionSubtitle}>Change password & verification</Text>
            </View>
            <Icon name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={() => navigation.navigate('HelpSupport')}>
            <View style={[styles.actionIcon, { backgroundColor: `${primary}22` }]}>
              <Icon name="help-circle-outline" size={18} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Help & Support</Text>
              <Text style={styles.actionSubtitle}>Get help instantly</Text>
            </View>
            <Icon name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            {savedAddresses.length > 0 && !isAddingAddress && (
              <TouchableOpacity
                style={[styles.addNewBtn, { borderColor: `${primary}66` }]}
                onPress={() => openAddForm(false)}
                activeOpacity={0.85}>
                <Icon name="plus" size={14} color={primary} />
                <Text style={[styles.addNewBtnText, { color: primary }]}>Add new</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoadingSavedAddresses ? (
            <ActivityIndicator size="small" color={primary} style={{ marginTop: 12 }} />
          ) : !isAddingAddress && savedAddresses.length === 0 ? (
            <View style={styles.emptyAddressBox}>
              <Icon name="map-marker-plus-outline" size={26} color={primary} />
              <Text style={styles.emptyAddressTitle}>No saved addresses</Text>
              <Text style={styles.emptyAddressSubtitle}>
                Add your delivery address to speed up checkout.
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddressBtn, { backgroundColor: primary }]}
                onPress={() => openAddForm(true)}
                activeOpacity={0.9}>
                <Icon name="plus" size={15} color="#FFFFFF" />
                <Text style={styles.emptyAddressBtnText}>Add address</Text>
              </TouchableOpacity>
            </View>
          ) : !isAddingAddress ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              {savedAddresses.map(addr => {
                const typeLabel = (addr.type || 'home').toString();
                const fullAddress = [
                  addr.address_line1,
                  addr.address_line2,
                  [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
                ].filter(Boolean).join(', ');
                return (
                  <View key={addr.id} style={styles.savedAddrCard}>
                    <View style={styles.savedAddrBadgeRow}>
                      <View style={[styles.typeBadge, { backgroundColor: `${primary}1A`, borderColor: `${primary}40` }]}>
                        <Icon
                          name={typeLabel === 'office' ? 'office-building-outline' : typeLabel === 'other' ? 'map-marker-outline' : 'home-outline'}
                          size={11} color={primary} />
                        <Text style={[styles.typeBadgeText, { color: primary }]}>
                          {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
                        </Text>
                      </View>
                      {addr.is_default ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.setDefaultBtn, { borderColor: `${primary}66` }]}
                          onPress={() => handleSetDefaultAddress(addr)}
                          disabled={isSettingDefault && settingDefaultId === addr.id}
                          activeOpacity={0.85}>
                          {isSettingDefault && settingDefaultId === addr.id ? (
                            <ActivityIndicator size="small" color={primary} />
                          ) : (
                            <Text style={[styles.setDefaultBtnText, { color: primary }]}>
                              Set as default
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteAddrBtn}
                        onPress={() => handleDeleteAddress(addr.id)}
                        disabled={isDeletingAddress && deletingAddressId === addr.id}
                        activeOpacity={0.7}>
                        {isDeletingAddress && deletingAddressId === addr.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Icon name="trash-can-outline" size={16} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.savedAddrLine}>{fullAddress || '—'}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {isAddingAddress && (
            <View style={{ gap: 8, marginTop: 10 }}>
              <View style={styles.typeRow}>
                {(['home', 'office', 'other'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, newAddrType === t && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => setNewAddrType(t)}
                    activeOpacity={0.85}>
                    <Text style={[styles.typeChipText, newAddrType === t && { color: '#FFFFFF' }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.useLocationBtn, { borderColor: `${primary}66` }]}
                onPress={handleUseMyLocation}
                disabled={isLocating || isReverseGeocoding}
                activeOpacity={0.85}>
                <Icon name="crosshairs-gps" size={14} color={primary} />
                <Text style={[styles.useLocationBtnText, { color: primary }]}>
                  {isLocating || isReverseGeocoding ? 'Getting location...' : 'Use my current location'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.editLabel}>Address line 1 *</Text>
              <TextInput style={styles.editInput} value={editLine1} onChangeText={setEditLine1}
                placeholder="House / street / locality" autoCapitalize="none" />

              <Text style={styles.editLabel}>Address line 2</Text>
              <TextInput style={styles.editInput} value={editLine2} onChangeText={setEditLine2}
                placeholder="Landmark (optional)" autoCapitalize="sentences" />

              <View style={styles.editRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>City *</Text>
                  <TextInput style={styles.editInput} value={editCity} onChangeText={setEditCity}
                    placeholder="City" autoCapitalize="words" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>State *</Text>
                  <TextInput style={styles.editInput} value={editState} onChangeText={setEditState}
                    placeholder="State" autoCapitalize="words" />
                </View>
              </View>

              <Text style={styles.editLabel}>Pincode *</Text>
              <TextInput style={styles.editInput} value={editPincode}
                onChangeText={t => setEditPincode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="Pincode" keyboardType="number-pad" maxLength={6} />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editActionBtn, { backgroundColor: 'rgba(148,163,184,0.15)' }]}
                  onPress={() => setIsAddingAddress(false)}
                  disabled={isSavingAddress}
                  activeOpacity={0.9}>
                  <Text style={[styles.editActionBtnText, { color: '#64748B' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editActionBtn, { backgroundColor: primary }, isSavingAddress && { opacity: 0.7 }]}
                  onPress={handleSaveAddress}
                  disabled={isSavingAddress}
                  activeOpacity={0.9}>
                  <Text style={[styles.editActionBtnText, { color: '#FFFFFF' }]}>
                    {isSavingAddress ? 'Saving...' : 'Save address'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Business & KYC</Text>
          {business ? (
            <>
              {hasAnyAddress(business) ? (
                <>
                  <Text style={[styles.label, { marginTop: 6 }]}>Address details</Text>
                  {business.addressLine1?.trim() ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Address line 1</Text>
                      <Text style={styles.value}>{business.addressLine1.trim()}</Text>
                    </View>
                  ) : null}
                  {business.addressLine2?.trim() ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Address line 2</Text>
                      <Text style={styles.value}>{business.addressLine2.trim()}</Text>
                    </View>
                  ) : null}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>City</Text>
                    <Text style={styles.value}>{business.city?.trim() || '—'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>State</Text>
                    <Text style={styles.value}>{business.state?.trim() || '—'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Pincode</Text>
                    <Text style={styles.value}>{business.pincode?.trim() || '—'}</Text>
                  </View>
                </>
              ) : null}

              <Text style={[styles.label, { marginTop: 14 }]}>Business details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Business name</Text>
                <Text style={styles.value}>{business.businessName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>GST number</Text>
                <Text style={styles.value}>{business.gstNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>FMCG number (FSSAI)</Text>
                <Text style={styles.value}>{business.fmcgNumber}</Text>
              </View>

              {(() => {
                const uploadedDocs = [
                  { uri: business.shopImageUri, label: 'Shop photo' },
                  { uri: business.gstCertificate, label: 'GST certificate' },
                  { uri: business.fssaiLicense, label: 'FSSAI license' },
                  { uri: business.udyamRegistration, label: 'Udyam registration' },
                  { uri: business.tradeCertificate, label: 'Trade certificate' },
                ].filter(d => !!d.uri);
                if (uploadedDocs.length === 0) return null;
                const rows: typeof uploadedDocs[] = [];
                for (let i = 0; i < uploadedDocs.length; i += 2) {
                  rows.push(uploadedDocs.slice(i, i + 2));
                }
                return (
                  <>
                    <Text style={[styles.label, { marginTop: 14 }]}>Certificates & documents</Text>
                    {rows.map((row, ri) => (
                      <View key={ri} style={styles.docRow}>
                        {row.map(doc => (
                          <KycDocTile key={doc.label} uri={doc.uri} label={doc.label} />
                        ))}
                        {row.length === 1 && <View style={{ flex: 1 }} />}
                      </View>
                    ))}
                  </>
                );
              })()}

              <View style={{ marginTop: 18 }}>
                <Text style={[styles.label, { marginTop: 6 }]}>KYC verification</Text>
                {isKycLoading ? (
                  <View style={styles.kycLoaderRow}>
                    <ActivityIndicator size="small" color={primary} />
                    <Text style={styles.kycStatusText}>Checking status...</Text>
                  </View>
                ) : (
                <Text style={styles.kycStatusText}>
                  {`Status: ${kycStatus ?? 'unknown'}`}
                </Text>
                )}

                {kycStatus !== 'verified' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.kycEditButton, { borderColor: `${primary}66` }]}
                      onPress={() => navigation.navigate('EditInfo')}
                      disabled={!business}>
                      <Icon name="pencil-outline" size={18} color={primary} />
                      <Text style={[styles.kycEditButtonText, { color: primary }]}>
                        Edit KYC details
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.kycButton,
                        { backgroundColor: isSubmittingKyc ? '#A5B4FC' : primary },
                      ]}
                      onPress={handleSubmitKyc}
                      disabled={!canSubmitKyc || isSubmittingKyc}>
                      <Icon name="shield-check-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.kycButtonText}>
                        {kycStatus ? 'Resubmit KYC' : 'Submit KYC'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.kycSkipButton, { borderColor: `${primary}66` }]}
                      onPress={handleSkipKyc}
                      disabled={!user || isSkippingKyc}>
                      <Text style={[styles.kycSkipButtonText, { color: primary }]}>
                        Skip for now
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.kycVerifiedPill}>
                    <Icon name="shield-check" size={16} color="#16A34A" />
                    <Text style={styles.kycVerifiedPillText}>KYC verified</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>
              No business profile uploaded yet. Complete your details during registration.
            </Text>
          )}
        </View>

        <TouchableOpacity style={[styles.logout, { backgroundColor: '#EF4444' }]} onPress={handleLogoutPress}>
          <Icon name="logout" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 14 },
  heroCard: {
    borderRadius: 24,
    padding: 18,
    ...shadow.md,
  },
  heroGlowLeft: {
    position: 'absolute',
    width: 130,
    height: 130,
    left: -50,
    top: -40,
    borderRadius: 65,
    opacity: 0.15,
  },
  heroGlowRight: {
    position: 'absolute',
    width: 170,
    height: 170,
    right: -70,
    bottom: -90,
    borderRadius: 85,
    backgroundColor: '#22C55E',
    opacity: 0.1,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { color: '#FFFFFF', fontWeight: '900', fontSize: 19 },
  heroEmail: { marginTop: 4, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rolePillText: { fontWeight: '900', fontSize: 11, color: '#FFFFFF' },
  heroStats: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 12 },
  statValue: { color: '#FFFFFF', marginTop: 4, fontWeight: '900' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  sectionWrap: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E9EF',
  },
  sectionTitle: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F6',
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTitle: { fontWeight: '800', color: '#0F172A', fontSize: 14 },
  actionSubtitle: { marginTop: 2, color: '#64748B', fontWeight: '600', fontSize: 12 },
  infoRow: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: { color: '#64748B', fontWeight: '700' },
  value: { color: '#0F172A', fontWeight: '900', marginTop: 4 },
  docRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  docBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
  },
  docImg: { width: '100%', height: 86, borderRadius: 12, backgroundColor: '#EEF2FF' },
  docPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  docPlaceholderText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  docLabel: { marginTop: 8, textAlign: 'center', color: '#475569', fontWeight: '800', fontSize: 12 },
  docHint: {
    marginTop: 6,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: { marginTop: 10, color: '#64748B', fontWeight: '700', lineHeight: 18 },
  logout: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  logoutText: { color: '#FFFFFF', fontWeight: '900' },

  kycStatusText: {
    marginTop: 6,
    color: '#0F172A',
    fontWeight: '800',
  },
  kycLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  kycButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kycButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  kycSkipButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kycSkipButtonText: {
    fontWeight: '900',
  },
  kycEditButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(29,78,216,0.03)',
  },
  kycEditButtonText: {
    fontWeight: '900',
  },
  kycVerifiedPill: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kycVerifiedPillText: {
    fontWeight: '900',
    color: '#16A34A',
  },

  // ─── Saved addresses ───
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addNewBtnText: { fontSize: 12, fontWeight: '700' },
  emptyAddressBox: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyAddressTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  emptyAddressSubtitle: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 4 },
  emptyAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddressBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  savedAddrCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  savedAddrBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  deleteAddrBtn: { marginLeft: 8, padding: 4 },
  setDefaultBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  setDefaultBtnText: { fontSize: 11, fontWeight: '700' },
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 4,
  },
  useLocationBtnText: { fontSize: 13, fontWeight: '700' },
  savedAddrLine: { color: '#1F2937', fontSize: 13, lineHeight: 18 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  defaultBadge: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '800', color: '#166534', textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  editLabel: { color: '#64748B', fontWeight: '800', fontSize: 12, marginTop: 4 },
  editInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontWeight: '700',
  },
  editRow: { flexDirection: 'row', gap: 10 },
  defaultToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  defaultToggleText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  editActionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionBtnText: { fontWeight: '900' },
});

export default ProfileScreen;
