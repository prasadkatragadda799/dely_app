import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../hooks/useAuth';
import { AuthStackParamList } from '../../../navigation/types';
import { UserRole } from '../../../types';
import TermsAndConditionsModal from '../../../shared/ui/TermsAndConditionsModal';
import { getApiErrorMessage } from '../../../utils/apiErrorMessage';
import {
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';
import { API_V1_BASE_URL } from '../../../services/api/config';
import { palette, radius, shadow, divisionTheme } from '../../../utils/theme';

const ACCENT = divisionTheme.fmcg;

type GstData = {
  gst_number: string;
  trade_name: string;
  legal_name: string;
  status: string;
  business_type: string;
  registration_date: string;
  pan_number: string;
  address?: { street?: string; city?: string; state?: string; pincode?: string };
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type RegisterForm = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  businessName: string;
  gstNumber: string;
  fmcgNumber: string;
  shopKycUri?: string;
  requestId?: string;
};

const RegisterScreen = ({ navigation }: Props) => {
  const { alert: appAlert } = useAppAlert();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [pendingForm, setPendingForm] = useState<RegisterForm | null>(null);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const { registerWithRole, verifyCustomerOtp } = useAuth();
  const { control, handleSubmit, setValue, getValues } = useForm<RegisterForm>({
    defaultValues: {
      name: '',
      phone: '',
      addressLine1: '',
      addressLine2: undefined,
      city: '',
      state: '',
      pincode: '',
      businessName: '',
      gstNumber: '',
      fmcgNumber: '',
      shopKycUri: undefined,
      requestId: undefined,
    },
  });

  const [gstFetching, setGstFetching] = useState(false);
  const [gstInfo, setGstInfo] = useState<GstData | null>(null);
  const [gstError, setGstError] = useState<string | null>(null);

  const fetchGstDetails = async () => {
    const gstin = getValues('gstNumber').trim().toUpperCase();
    if (!gstin || gstin.length < 15) {
      setGstError('Enter a valid 15-character GSTIN first.');
      return;
    }
    setGstFetching(true);
    setGstInfo(null);
    setGstError(null);
    try {
      const res = await fetch(`${API_V1_BASE_URL}/kyc/verify-gst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gst_number: gstin }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setGstInfo(json.data as GstData);
        if (json.data.trade_name) {
          setValue('businessName', json.data.trade_name, { shouldDirty: true });
        }
      } else {
        setGstError(json.detail || json.message || 'GST number not found or invalid.');
      }
    } catch {
      setGstError('Could not verify GST. Check your connection.');
    } finally {
      setGstFetching(false);
    }
  };

  const [shopKycUri, setShopKycUri] = useState<string | undefined>(undefined);
  const [gstCertUri, setGstCertUri] = useState<string | undefined>(undefined);
  const [fssaiLicenseUri, setFssaiLicenseUri] = useState<string | undefined>(undefined);
  const [udyamRegUri, setUdyamRegUri] = useState<string | undefined>(undefined);
  const [tradeCertUri, setTradeCertUri] = useState<string | undefined>(undefined);

  const pickImage = (setter: (uri?: string) => void) => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, resp => {
      const asset: Asset | undefined = resp.assets?.[0];
      setter(asset?.uri);
    });
  };

  const hasAtLeastOneDoc = !!(gstCertUri || fssaiLicenseUri || udyamRegUri || tradeCertUri);

  const onSubmit = async (form: RegisterForm) => {
    if (!acceptedTerms) {
      await appAlert({ title: 'Terms required', message: 'Please accept terms to continue.' });
      return;
    }
    if (selectedRole === 'delivery') {
      await appAlert({
        title: 'Delivery registration unavailable',
        message: 'Delivery partners are created by admin. Please use "Continue as Partner" to login, or contact support.',
      });
      return;
    }
    if (selectedRole === 'customer') {
      if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim() || !form.businessName.trim()) {
        await appAlert({
          title: 'Complete your profile',
          message: 'Address and business name are required.',
        });
        return;
      }
      if (!shopKycUri) {
        await appAlert({
          title: 'Shop photo required',
          message: 'Please upload a photo of your shop.',
        });
        return;
      }
      if (!hasAtLeastOneDoc) {
        await appAlert({
          title: 'Supporting document required',
          message: 'Please upload at least one supporting document (GST certificate, FSSAI license, Udyam registration, or trade certificate).',
        });
        return;
      }
    }
    const enrichedForm: RegisterForm = { ...form, shopKycUri };
    try {
      setRegistering(true);
      const businessProfile = selectedRole === 'customer' ? {
        businessName: form.businessName,
        gstNumber: form.gstNumber,
        fmcgNumber: form.fmcgNumber,
        shopImageUri: shopKycUri,
        gstCertificate: gstCertUri,
        fssaiLicense: fssaiLicenseUri,
        udyamRegistration: udyamRegUri,
        tradeCertificate: tradeCertUri,
      } : null;
      const autoPassword = `DC_${form.phone.replace(/\D/g, '')}_vendor`;
      const next = await registerWithRole({
        name: form.name,
        phone: form.phone,
        password: autoPassword,
        role: selectedRole,
        businessProfile,
        address: form.addressLine1 || form.addressLine2 ? { address_line1: form.addressLine1, address_line2: form.addressLine2 } : undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      });
      setPendingForm({ ...enrichedForm, requestId: next.requestId });
      setOtpVisible(true);
    } catch (e: unknown) {
      await appAlert({ title: 'Registration failed', message: getApiErrorMessage(e) });
    } finally {
      setRegistering(false);
    }
  };

  const verifyOtp = async (code?: string) => {
    if (!pendingForm) return;
    const otpCode = (code ?? otpInput).trim();
    try {
      setVerifyingOtp(true);
      if (!pendingForm.requestId) throw new Error('OTP request missing. Please register again.');
      await verifyCustomerOtp({ phone: pendingForm.phone, requestId: pendingForm.requestId, otp: otpCode, role: selectedRole });
      setOtpVisible(false);
      setOtpInput('');
      setPendingForm(null);
    } catch (e: unknown) {
      await appAlert({ title: 'OTP verification failed', message: getApiErrorMessage(e) });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setOtpInput(digits);
    if (digits.length === 6 && !verifyingOtp) verifyOtp(digits);
  };

  const SectionCard = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBadge}>
          <Icon name={icon} size={15} color={ACCENT.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );

  const FieldLabel = ({ label, optional }: { label: string; optional?: boolean }) => (
    <Text style={styles.fieldLabel}>
      {label}
      {optional ? <Text style={styles.optionalText}> (optional)</Text> : null}
    </Text>
  );

  const InputBox = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <View style={styles.inputBox}>
      <Icon name={icon} size={17} color="#94A3B8" />
      {children}
    </View>
  );


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.9}>
              <Icon name="arrow-left" size={20} color={palette.ink} />
            </TouchableOpacity>
            <View style={styles.topBarLogoMark}>
              <Image source={require('../../../../assets/logo.png')} style={styles.topBarLogo} resizeMode="contain" />
            </View>
            <View style={{ width: 42 }} />
          </View>

          {/* Page heading */}
          <View style={styles.pageHeading}>
            <Text style={styles.pageTitle}>Create Account</Text>
            <Text style={styles.pageSubtitle}>Join DelyCart and start ordering</Text>
          </View>

          {/* ── Section 1: Personal Info ── */}
          <SectionCard icon="account-outline" title="Personal Info">
            <FieldLabel label="Full name" />
            <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
              <InputBox icon="account-outline">
                <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} autoCapitalize="words" />
              </InputBox>
            )} />

            <FieldLabel label="Phone number" />
            <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
              <InputBox icon="phone-outline">
                <TextInput style={styles.input} placeholder="+91 XXXXX XXXXX" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} keyboardType="phone-pad" />
              </InputBox>
            )} />
          </SectionCard>

          {/* ── Section 2: Business Details (only for customer) ── */}
          {selectedRole === 'customer' ? (
            <SectionCard icon="store-outline" title="Business Details">

              {/* GST Number */}
              <FieldLabel label="GST Number (GSTIN)" />
              <Controller control={control} name="gstNumber" render={({ field: { onChange, value } }) => (
                <View style={styles.inputBox}>
                  <Icon name="receipt-outline" size={17} color="#94A3B8" />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    placeholderTextColor="#CBD5E1"
                    value={value}
                    onChangeText={v => { onChange(v); setGstInfo(null); setGstError(null); }}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    onPress={fetchGstDetails}
                    disabled={gstFetching}
                    style={styles.fetchBtn}
                    activeOpacity={0.85}
                  >
                    {gstFetching
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Text style={styles.fetchBtnText}>Verify</Text>}
                  </TouchableOpacity>
                </View>
              )} />
              {gstError ? (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={13} color="#DC2626" />
                  <Text style={styles.errorText}>{gstError}</Text>
                </View>
              ) : null}

              {/* GST verified card */}
              {gstInfo ? (
                <View style={styles.gstCard}>
                  <View style={styles.gstCardTop}>
                    <Icon name="check-decagram" size={18} color="#16A34A" />
                    <Text style={styles.gstCardTopText}>GST Verified</Text>
                    <Text style={[styles.gstStatusBadge, { backgroundColor: gstInfo.status === 'Active' ? '#DCFCE7' : '#FEE2E2', color: gstInfo.status === 'Active' ? '#15803D' : '#B91C1C' }]}>
                      {gstInfo.status}
                    </Text>
                  </View>
                  <Text style={styles.gstTradeName}>{gstInfo.trade_name}</Text>
                  {gstInfo.legal_name !== gstInfo.trade_name ? (
                    <Text style={styles.gstLegalName}>{gstInfo.legal_name}</Text>
                  ) : null}
                  <View style={styles.gstMetaRow}>
                    <View style={styles.gstMetaItem}>
                      <Text style={styles.gstMetaKey}>PAN</Text>
                      <Text style={styles.gstMetaVal}>{gstInfo.pan_number}</Text>
                    </View>
                    <View style={styles.gstMetaItem}>
                      <Text style={styles.gstMetaKey}>Type</Text>
                      <Text style={styles.gstMetaVal}>{gstInfo.business_type}</Text>
                    </View>
                    <View style={styles.gstMetaItem}>
                      <Text style={styles.gstMetaKey}>Since</Text>
                      <Text style={styles.gstMetaVal}>{gstInfo.registration_date}</Text>
                    </View>
                  </View>
                  {gstInfo.address?.street ? (
                    <View style={styles.gstAddressRow}>
                      <Icon name="map-marker-outline" size={13} color="#6B7280" />
                      <Text style={styles.gstAddress}>
                        {[gstInfo.address.street, gstInfo.address.city, gstInfo.address.pincode].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Business Name */}
              <FieldLabel label="Business Name" />
              <Controller control={control} name="businessName" render={({ field: { onChange, value } }) => (
                <InputBox icon="storefront-outline">
                  <TextInput style={styles.input} placeholder="Your registered business name" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} />
                </InputBox>
              )} />

              {/* FMCG Number */}
              <FieldLabel label="FMCG / FSSAI Number (optional)" />
              <Controller control={control} name="fmcgNumber" render={({ field: { onChange, value } }) => (
                <InputBox icon="barcode-scan">
                  <TextInput style={styles.input} placeholder="Enter FSSAI license number" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} />
                </InputBox>
              )} />
            </SectionCard>
          ) : null}

          {/* ── Section 3: Address (only for customer) ── */}
          {selectedRole === 'customer' ? (
            <SectionCard icon="map-marker-outline" title="Address">

              <View style={styles.row}>
                <View style={styles.rowCol}>
                  <FieldLabel label="City" />
                  <Controller control={control} name="city" render={({ field: { onChange, value } }) => (
                    <InputBox icon="city-variant-outline">
                      <TextInput style={styles.input} placeholder="City" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} autoCapitalize="words" />
                    </InputBox>
                  )} />
                </View>
                <View style={styles.rowGap} />
                <View style={styles.rowCol}>
                  <FieldLabel label="State" />
                  <Controller control={control} name="state" render={({ field: { onChange, value } }) => (
                    <InputBox icon="flag-outline">
                      <TextInput style={styles.input} placeholder="State" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} autoCapitalize="words" />
                    </InputBox>
                  )} />
                </View>
              </View>

              <FieldLabel label="Pincode" />
              <Controller control={control} name="pincode" render={({ field: { onChange, value } }) => (
                <InputBox icon="map-marker-radius-outline">
                  <TextInput style={styles.input} placeholder="6-digit pincode" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={6} />
                </InputBox>
              )} />

              <FieldLabel label="Address Line 1" />
              <Controller control={control} name="addressLine1" render={({ field: { onChange, value } }) => (
                <InputBox icon="home-outline">
                  <TextInput style={styles.input} placeholder="House no., Street, Locality" placeholderTextColor="#CBD5E1" value={value} onChangeText={onChange} autoCapitalize="sentences" />
                </InputBox>
              )} />

              <FieldLabel label="Address Line 2" optional />
              <Controller control={control} name="addressLine2" render={({ field: { onChange, value } }) => (
                <InputBox icon="map-marker-plus-outline">
                  <TextInput style={styles.input} placeholder="Landmark, Area (optional)" placeholderTextColor="#CBD5E1" value={value ?? ''} onChangeText={onChange} autoCapitalize="sentences" />
                </InputBox>
              )} />
            </SectionCard>
          ) : null}

          {/* ── Section 4: Documents (only for customer) ── */}
          {selectedRole === 'customer' ? (
            <SectionCard icon="file-document-outline" title="Documents">
              {/* Shop Photo - required */}
              <Text style={styles.fieldLabel}>Shop Photo <Text style={{ color: '#DC2626' }}>*</Text></Text>
              <Text style={styles.docSectionHint}>A clear photo of your shop front (required).</Text>
              <TouchableOpacity style={styles.kycUploadCard} onPress={() => pickImage(setShopKycUri)} activeOpacity={0.8}>
                {shopKycUri ? (
                  <Image source={{ uri: shopKycUri }} style={styles.kycPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.kycEmptyContent}>
                    <View style={styles.kycIconWrap}>
                      <Icon name="store-outline" size={36} color="#1D4ED8" />
                    </View>
                    <Text style={styles.kycUploadLabel}>Tap to upload Shop Photo</Text>
                    <Text style={styles.kycUploadHint}>Required</Text>
                  </View>
                )}
                {shopKycUri ? (
                  <View style={styles.kycChangeRow}>
                    <Icon name="camera-retake-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.kycChangeText}>Tap to change photo</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              {/* Supporting Documents - at least one required */}
              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
                Supporting Documents <Text style={{ color: '#DC2626' }}>*</Text>
              </Text>
              <Text style={styles.docSectionHint}>Upload at least one of the following business documents.</Text>

              {[
                { label: 'GST Certificate', icon: 'receipt-outline', uri: gstCertUri, setter: setGstCertUri },
                { label: 'FSSAI License', icon: 'shield-check-outline', uri: fssaiLicenseUri, setter: setFssaiLicenseUri },
                { label: 'Udyam Registration', icon: 'briefcase-outline', uri: udyamRegUri, setter: setUdyamRegUri },
                { label: 'Trade Certificate', icon: 'certificate-outline', uri: tradeCertUri, setter: setTradeCertUri },
              ].map(({ label, icon, uri, setter }) => (
                <TouchableOpacity key={label} style={styles.docPickerRow} onPress={() => pickImage(setter)} activeOpacity={0.8}>
                  <View style={[styles.docPickerThumb, uri ? styles.docPickerThumbDone : null]}>
                    {uri
                      ? <Image source={{ uri }} style={styles.docPickerImage} resizeMode="cover" />
                      : <Icon name={icon} size={24} color={uri ? '#1D4ED8' : '#94A3B8'} />}
                  </View>
                  <View style={styles.docPickerInfo}>
                    <Text style={styles.docPickerLabel}>{label}</Text>
                    <Text style={styles.docPickerStatus}>
                      {uri ? 'Uploaded — tap to change' : 'Tap to upload (optional)'}
                    </Text>
                  </View>
                  {uri ? <Icon name="check-circle" size={20} color="#16A34A" /> : <Icon name="upload-outline" size={20} color="#94A3B8" />}
                </TouchableOpacity>
              ))}

              {!hasAtLeastOneDoc ? (
                <View style={styles.errorRow}>
                  <Icon name="information-outline" size={13} color="#D97706" />
                  <Text style={[styles.errorText, { color: '#D97706' }]}>At least one supporting document is required</Text>
                </View>
              ) : null}
            </SectionCard>
          ) : null}

          {/* ── Footer: Terms + Submit ── */}
          <View style={styles.footerCard}>
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedTerms(prev => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                {acceptedTerms ? <Icon name="check" size={11} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => setTermsModalVisible(true)}>
                  terms & conditions
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.registerBtn, registering && { opacity: 0.7 }]}
              disabled={registering}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.9}
            >
              {registering
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : (
                  <View style={styles.registerBtnInner}>
                    <Text style={styles.registerBtnText}>Create Account</Text>
                    <Icon name="arrow-right" size={18} color="#FFFFFF" />
                  </View>
                )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLinkWrap}>
            <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Modal */}
      <Modal transparent visible={otpVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Icon name="shield-key-outline" size={36} color="#1D4ED8" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Verify Your Number</Text>
            <Text style={styles.modalSubtitle}>Enter the 6-digit OTP sent to your phone</Text>
            <View style={[styles.inputBox, { marginTop: 16 }]}>
              <Icon name="numeric" size={17} color="#94A3B8" />
              <TextInput
                value={otpInput}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                placeholder="• • • • • •"
                placeholderTextColor="#CBD5E1"
                style={[styles.input, { letterSpacing: 6, fontSize: 18, fontWeight: '700' }]}
                maxLength={6}
                autoFocus
                editable={!verifyingOtp}
              />
              {verifyingOtp && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />}
            </View>
            <TouchableOpacity
              style={[styles.registerBtn, { marginTop: 16 }, (verifyingOtp || otpInput.length < 6) && { opacity: 0.6 }]}
              disabled={verifyingOtp || otpInput.length < 6}
              onPress={() => verifyOtp()}
              activeOpacity={0.9}
            >
              {verifyingOtp
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : (
                  <View style={styles.registerBtnInner}>
                    <Text style={styles.registerBtnText}>Verify & Continue</Text>
                    <Icon name="check" size={18} color="#FFFFFF" />
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpVisible(false)} style={{ marginTop: 14, alignSelf: 'center' }}>
              <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TermsAndConditionsModal visible={termsModalVisible} onClose={() => setTermsModalVisible(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  flex1: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 36 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.xs,
  },
  topBarLogoMark: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.xs,
  },
  topBarLogo: { width: 30, height: 30 },

  // Page heading
  pageHeading: { paddingHorizontal: 4, marginBottom: 20, marginTop: 8 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: palette.ink, letterSpacing: -0.5 },
  pageSubtitle: { color: palette.muted, fontSize: 14, marginTop: 4, fontWeight: '500' },

  // Section cards
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIconBadge: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: ACCENT.soft,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: palette.ink },
  sectionDivider: { height: 1, backgroundColor: palette.lineSoft, marginBottom: 14 },

  // Field label
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#475569',
    marginBottom: 6, marginTop: 12,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  optionalText: { fontWeight: '500', color: '#94A3B8', textTransform: 'none', letterSpacing: 0 },

  // Input box
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
    paddingLeft: 10,
    paddingVertical: 0,
  },

  // Fetch / Verify button
  fetchBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fetchBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // Error
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  // GST verified card
  gstCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
  },
  gstCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  gstCardTopText: { fontWeight: '800', color: '#15803D', fontSize: 13, flex: 1 },
  gstStatusBadge: {
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  gstTradeName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  gstLegalName: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 8 },
  gstMetaRow: { flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 6 },
  gstMetaItem: { flex: 1 },
  gstMetaKey: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  gstMetaVal: { fontSize: 12, color: '#374151', fontWeight: '700' },
  gstAddressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  gstAddress: { fontSize: 11, color: '#6B7280', flex: 1, lineHeight: 16 },

  // Row layout (city + state)
  row: { flexDirection: 'row' },
  rowCol: { flex: 1 },
  rowGap: { width: 12 },

  // Documents section
  docSectionHint: {
    fontSize: 12, color: '#64748B', fontWeight: '500',
    marginBottom: 14, lineHeight: 18,
  },

  // Single Shop KYC upload card
  kycUploadCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    backgroundColor: '#F0F7FF',
    overflow: 'hidden',
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycPreview: { width: '100%', height: 200 },
  kycEmptyContent: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  kycIconWrap: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  kycUploadLabel: { fontSize: 15, fontWeight: '800', color: '#1D4ED8', textAlign: 'center', marginBottom: 6 },
  kycUploadHint: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  kycChangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', width: '100%',
  },
  kycChangeText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },

  // Footer card
  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  termsText: { color: '#475569', fontSize: 13, fontWeight: '500', flex: 1 },
  termsLink: { color: '#1D4ED8', fontWeight: '700' },
  registerBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  registerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  // Login link
  loginLinkWrap: { alignItems: 'center', paddingVertical: 10 },
  loginLink: { color: palette.muted, fontSize: 13, fontWeight: '500' },
  loginLinkBold: { color: ACCENT.primary, fontWeight: '800' },

  // OTP Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  modalSubtitle: { color: '#64748B', textAlign: 'center', marginTop: 6, fontSize: 14 },

  // Document picker rows
  docPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  docPickerThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docPickerThumbDone: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  docPickerImage: { width: '100%', height: '100%' },
  docPickerInfo: { flex: 1 },
  docPickerLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  docPickerStatus: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
});

export default RegisterScreen;
