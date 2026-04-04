import React, { useMemo } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../hooks/useAuth';
import { useAppSelector } from '../../../hooks/redux';
import { CustomerProfileStackParamList } from '../../../navigation/types';
import {
  useGetKycStatusQuery,
  useSkipKycMutation,
  useSubmitKycMutation,
} from '../../../services/api/mobileApi';
import type { BusinessProfile } from '../businessProfileSlice';

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
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomerProfileStackParamList>>();
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';
  const primarySoft = isHomeKitchen ? 'rgba(22,163,74,0.12)' : 'rgba(29,78,216,0.12)';
  const business = useAppSelector(state => state.businessProfile.profile);

  const {
    data: kycEnvelope,
    isLoading: isKycLoading,
    refetch: refetchKyc,
  } = useGetKycStatusQuery(undefined, { skip: !user });
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
      Alert.alert('Business details missing', 'Please complete your registration first.');
      return;
    }

    // Backend expects 14 digits for FSSAI; app currently collects this as `fmcgNumber`.
    const fssaiDigits = (business.fmcgNumber ?? '').toString().replace(/\D/g, '');
    if (fssaiDigits.length !== 14) {
      Alert.alert(
        'Invalid FSSAI number',
        'FSSAI must be exactly 14 digits. Please check your “FMCG number” field.',
      );
      return;
    }

    try {
      await submitKycApi({
        business_name: business.businessName,
        gst_number: business.gstNumber,
        fssai_number: fssaiDigits,
        shop_image_url: business.shopImageUri ?? undefined,
        // Prefer FSSAI license from registration; fall back for older local profiles.
        fssai_license_image_url:
          business.fssaiLicense ?? business.userIdUri ?? undefined,
      }).unwrap();

      await refetchKyc();
      Alert.alert('KYC submitted', 'Your verification is now under review.');
    } catch (e: any) {
      const msg =
        e?.data?.message ??
        e?.error ??
        e?.data?.detail ??
        'Failed to submit KYC. Please try again.';
      Alert.alert('KYC submit failed', msg);
    }
  };

  const handleSkipKyc = async () => {
    try {
      await skipKycApi().unwrap();
      await refetchKyc();
      Alert.alert('KYC skipped', 'You can complete KYC later from your profile.');
    } catch (e: any) {
      const msg = e?.data?.message ?? e?.error ?? 'Failed to skip KYC.';
      Alert.alert('KYC skip failed', msg);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
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
        <View style={[styles.heroCard, { borderColor: `${primary}30` }]}>
          <View style={[styles.heroGlowLeft, { backgroundColor: primary }]} />
          <View style={styles.heroGlowRight} />

          <View style={styles.heroTop}>
            <View style={[styles.avatar, { backgroundColor: primarySoft }]}>
              <Icon name="account-circle-outline" size={34} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{user?.name ?? 'Guest User'}</Text>
              <Text style={styles.heroEmail}>{user?.email ?? '—'}</Text>
            </View>
            <View style={[styles.rolePill, { borderColor: `${primary}55`, backgroundColor: primarySoft }]}>
              <Text style={[styles.rolePillText, { color: primary }]}>
                {(user?.role ?? 'customer').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Account</Text>
              <Text style={styles.statValue}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Division</Text>
              <Text style={styles.statValue}>
                {isHomeKitchen ? 'Home & Kitchen' : 'FMCG'}
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
            style={styles.actionRow}
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

              <Text style={[styles.label, { marginTop: 14 }]}>Certificates & documents</Text>
              <Text style={styles.docHint}>
                Same uploads as registration (GST, FSSAI, Udyam, trade, shop, user ID).
              </Text>
              <View style={styles.docRow}>
                <KycDocTile uri={business.gstCertificate} label="GST certificate" />
                <KycDocTile uri={business.fssaiLicense} label="FSSAI license" />
              </View>
              <View style={styles.docRow}>
                <KycDocTile uri={business.udyamRegistration} label="Udyam registration" />
                <KycDocTile uri={business.tradeCertificate} label="Trade certificate" />
              </View>
              <View style={styles.docRow}>
                <KycDocTile uri={business.shopImageUri} label="Shop photo" />
                <KycDocTile uri={business.userIdUri} label="User ID" />
              </View>

              <View style={{ marginTop: 18 }}>
                <Text style={[styles.label, { marginTop: 6 }]}>KYC verification</Text>
                <Text style={styles.kycStatusText}>
                  {isKycLoading ? 'Checking status...' : `Status: ${kycStatus ?? 'unknown'}`}
                </Text>

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
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingHorizontal: 14 },
  heroCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { color: '#0F172A', fontWeight: '900', fontSize: 19 },
  heroEmail: { marginTop: 4, color: '#475569', fontWeight: '600' },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: { fontWeight: '900', fontSize: 11 },
  heroStats: {
    marginTop: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: { flex: 1 },
  statLabel: { color: '#64748B', fontWeight: '700', fontSize: 12 },
  statValue: { color: '#0F172A', marginTop: 4, fontWeight: '900' },
  statDivider: { width: 1, height: 32, backgroundColor: '#CBD5E1' },
  sectionWrap: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { color: '#0F172A', fontWeight: '900', fontSize: 16 },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTitle: { fontWeight: '900', color: '#0F172A' },
  actionSubtitle: { marginTop: 2, color: '#64748B', fontWeight: '700', fontSize: 12 },
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
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: { color: '#FFFFFF', fontWeight: '900' },

  kycStatusText: {
    marginTop: 6,
    color: '#0F172A',
    fontWeight: '800',
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
});

export default ProfileScreen;
