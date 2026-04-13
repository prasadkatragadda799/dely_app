import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  businessName: string;
  gstNumber: string;
  fmcgNumber: string;
  shopImageUri?: string;
  userIdUri?: string;
  gstCertificateUri?: string;
  fssaiLicenseUri?: string;
  udyamRegistrationUri?: string;
  tradeCertificateUri?: string;
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
  const { registerWithRole, verifyCustomerOtp } = useAuth();
  const { control, handleSubmit } = useForm<RegisterForm>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      addressLine1: '',
      addressLine2: undefined,
      city: '',
      state: '',
      pincode: '',
      businessName: '',
      gstNumber: '',
      fmcgNumber: '',
      shopImageUri: undefined,
      userIdUri: undefined,
      gstCertificateUri: undefined,
      fssaiLicenseUri: undefined,
      udyamRegistrationUri: undefined,
      tradeCertificateUri: undefined,
      requestId: undefined,
    },
  });

  const [shopImageUri, setShopImageUri] = useState<string | undefined>(undefined);
  const [userIdUri, setUserIdUri] = useState<string | undefined>(undefined);
  const [gstCertificateUri, setGstCertificateUri] = useState<string | undefined>(undefined);
  const [fssaiLicenseUri, setFssaiLicenseUri] = useState<string | undefined>(undefined);
  const [udyamRegistrationUri, setUdyamRegistrationUri] = useState<string | undefined>(undefined);
  const [tradeCertificateUri, setTradeCertificateUri] = useState<string | undefined>(undefined);

  const pickImage = (setter: (uri?: string) => void) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 1,
      },
      resp => {
        const asset: Asset | undefined = resp.assets?.[0];
        setter(asset?.uri);
      },
    );
  };

  const onSubmit = async (form: RegisterForm) => {
    if (!acceptedTerms) {
      await appAlert({
        title: 'Terms required',
        message: 'Please accept terms to continue.',
      });
      return;
    }

    if (selectedRole === 'delivery') {
      await appAlert({
        title: 'Delivery registration unavailable',
        message:
          'Delivery partners are created by admin. Please use “Continue as Partner” to login, or contact support.',
      });
      return;
    }

    if (selectedRole === 'customer') {
      if (
        !form.addressLine1.trim() ||
        !form.city.trim() ||
        !form.state.trim() ||
        !form.pincode.trim() ||
        !form.businessName.trim() ||
        !form.gstNumber.trim() ||
        !form.fmcgNumber.trim() ||
        !gstCertificateUri ||
        !fssaiLicenseUri ||
        !udyamRegistrationUri ||
        !tradeCertificateUri ||
        !shopImageUri ||
        !userIdUri
      ) {
        await appAlert({
          title: 'Complete your profile',
          message:
            'Address, business name, GST number, FMCG (FSSAI) number, uploads for GST certificate, FSSAI license, Udyam registration, trade certificate, shop photo, and user ID are required.',
        });
        return;
      }
    }

    const enrichedForm: RegisterForm = {
      ...form,
      shopImageUri,
      userIdUri,
      gstCertificateUri,
      fssaiLicenseUri,
      udyamRegistrationUri,
      tradeCertificateUri,
    };

    try {
      const businessProfile =
        selectedRole === 'customer'
          ? {
              businessName: form.businessName,
              gstNumber: form.gstNumber,
              gstCertificate: gstCertificateUri,
              fssaiLicense: fssaiLicenseUri,
              udyamRegistration: udyamRegistrationUri,
              tradeCertificate: tradeCertificateUri,
              fmcgNumber: form.fmcgNumber,
              shopImageUri,
              userIdUri,
            }
          : null;

      const next = await registerWithRole({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: selectedRole,
        businessProfile,
        address: form.addressLine1 || form.addressLine2 ? { address_line1: form.addressLine1, address_line2: form.addressLine2 } : undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      });

      setPendingForm({ ...enrichedForm, requestId: next.requestId });
      setOtpVisible(true);
      await appAlert({
        title: 'OTP sent',
        message: 'Check your phone for the verification code.',
      });
    } catch (e: unknown) {
      await appAlert({
        title: 'Registration failed',
        message: getApiErrorMessage(e),
      });
    }
  };

  const verifyOtp = async () => {
    if (!pendingForm) {
      return;
    }

    try {
      if (!pendingForm.requestId) {
        throw new Error('OTP request missing. Please register again.');
      }

      await verifyCustomerOtp({
        phone: pendingForm.phone,
        requestId: pendingForm.requestId,
        otp: otpInput.trim(),
        role: selectedRole,
      });
    } catch (e: unknown) {
      await appAlert({
        title: 'OTP verification failed',
        message: getApiErrorMessage(e),
      });
      return;
    }
    setOtpVisible(false);
    setOtpInput('');
    setPendingForm(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.9}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={require('../../../../assets/logo.png')}
              style={styles.topBarLogo}
              resizeMode="contain"
            />
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join and start ordering in minutes
            </Text>

            {(
              [
                { key: 'name', icon: 'account-outline', label: 'Full name' },
                { key: 'email', icon: 'email-outline', label: 'Email address' },
                { key: 'password', icon: 'lock-outline', label: 'Password' },
                { key: 'phone', icon: 'phone-outline', label: 'Phone number' },
              ] as const
            ).map(field => (
              <View key={field.key}>
                <Text style={styles.label}>{field.label}</Text>
                <Controller
                  control={control}
                  name={field.key}
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.inputRow}>
                      <Icon name={field.icon} size={18} color="#64748B" />
                      <TextInput
                        placeholder={field.label}
                        placeholderTextColor="#94A3B8"
                        value={value}
                        onChangeText={onChange}
                        style={styles.input}
                        secureTextEntry={field.key === 'password'}
                        keyboardType={
                          field.key === 'phone' ? 'phone-pad' : 'default'
                        }
                        autoCapitalize={
                          field.key === 'email' ? 'none' : 'sentences'
                        }
                      />
                    </View>
                  )}
                />
              </View>
            ))}

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {(['customer'] as UserRole[]).map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    selectedRole === role && styles.roleChipActive,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selectedRole === role && styles.roleChipTextActive,
                    ]}
                  >
                    {role === 'customer' ? 'Customer' : 'Delivery'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedRole === 'customer' ? (
              <View style={styles.businessBlock}>
                <Text style={[styles.label, { marginTop: 16, marginBottom: 10 }]}>
                  Address Details
                </Text>

                <View style={styles.grid2}>
                  <View style={styles.colWithGap}>
                    <Text style={styles.smallLabel}>City</Text>
                    <Controller
                      control={control}
                      name="city"
                      render={({ field: { onChange, value } }) => (
                        <View style={styles.inputRow}>
                          <Icon
                            name="city-variant-outline"
                            size={18}
                            color="#64748B"
                          />
                          <TextInput
                            placeholder="Enter city"
                            placeholderTextColor="#94A3B8"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                            autoCapitalize="words"
                          />
                        </View>
                      )}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.smallLabel}>State</Text>
                    <Controller
                      control={control}
                      name="state"
                      render={({ field: { onChange, value } }) => (
                        <View style={styles.inputRow}>
                          <Icon
                            name="flag-outline"
                            size={18}
                            color="#64748B"
                          />
                          <TextInput
                            placeholder="Enter state"
                            placeholderTextColor="#94A3B8"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                            autoCapitalize="words"
                          />
                        </View>
                      )}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.smallLabel}>Pincode</Text>
                  <Controller
                    control={control}
                    name="pincode"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.inputRow}>
                        <Icon
                          name="badge-account-outline"
                          size={18}
                          color="#64748B"
                        />
                        <TextInput
                          placeholder="Pincode"
                          placeholderTextColor="#94A3B8"
                          value={value}
                          onChangeText={onChange}
                          style={styles.input}
                          keyboardType="phone-pad"
                          autoCapitalize="none"
                        />
                      </View>
                    )}
                  />
                </View>

                <View>
                  <Text style={styles.smallLabel}>Address line 1</Text>
                  <Controller
                    control={control}
                    name="addressLine1"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.inputRow}>
                        <Icon
                          name="map-marker-outline"
                          size={18}
                          color="#64748B"
                        />
                        <TextInput
                          placeholder="House / street / locality"
                          placeholderTextColor="#94A3B8"
                          value={value}
                          onChangeText={onChange}
                          style={styles.input}
                          autoCapitalize="sentences"
                        />
                      </View>
                    )}
                  />
                </View>

                <View>
                  <Text style={styles.smallLabel}>Address line 2 (optional)</Text>
                  <Controller
                    control={control}
                    name="addressLine2"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.inputRow}>
                        <Icon
                          name="map-marker-plus-outline"
                          size={18}
                          color="#64748B"
                        />
                        <TextInput
                          placeholder="Landmark (optional)"
                          placeholderTextColor="#94A3B8"
                          value={value ?? ''}
                          onChangeText={onChange}
                          style={styles.input}
                          autoCapitalize="sentences"
                        />
                      </View>
                    )}
                  />
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>
                  Business Details
                </Text>
                <View style={styles.grid2}>
                  <View style={styles.colWithGap}>
                    <Text style={styles.smallLabel}>Business name</Text>
                    <Controller
                      control={control}
                      name="businessName"
                      render={({ field: { onChange, value } }) => (
                        <View style={styles.inputRow}>
                          <Icon
                            name="store-outline"
                            size={18}
                            color="#64748B"
                          />
                          <TextInput
                            placeholder="Enter business name"
                            placeholderTextColor="#94A3B8"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                          />
                        </View>
                      )}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.smallLabel}>GST number</Text>
                    <Controller
                      control={control}
                      name="gstNumber"
                      render={({ field: { onChange, value } }) => (
                        <View style={styles.inputRow}>
                          <Icon
                            name="receipt-outline"
                            size={18}
                            color="#64748B"
                          />
                          <TextInput
                            placeholder="GSTIN"
                            placeholderTextColor="#94A3B8"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                            autoCapitalize="characters"
                          />
                        </View>
                      )}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.smallLabel}>FMCG number</Text>
                  <Controller
                    control={control}
                    name="fmcgNumber"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.inputRow}>
                        <Icon
                          name="badge-account-outline"
                          size={18}
                          color="#64748B"
                        />
                        <TextInput
                          placeholder="Enter FMCG number"
                          placeholderTextColor="#94A3B8"
                          value={value}
                          onChangeText={onChange}
                          style={styles.input}
                        />
                      </View>
                    )}
                  />
                </View>

                <Text style={[styles.label, { marginTop: 16, marginBottom: 6 }]}>
                  Certificates & documents
                </Text>
                <Text style={styles.docHint}>
                  Upload a clear photo of each certificate (same as shop photo and ID).
                </Text>

                <View style={styles.docGrid}>
                  <TouchableOpacity
                    onPress={() => pickImage(setGstCertificateUri)}
                    style={[styles.docCard, styles.docCardGap]}>
                    {gstCertificateUri ? (
                      <Image source={{ uri: gstCertificateUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="file-certificate-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>GST certificate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => pickImage(setFssaiLicenseUri)}
                    style={styles.docCard}>
                    {fssaiLicenseUri ? (
                      <Image source={{ uri: fssaiLicenseUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="file-document-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>FSSAI license</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.docGrid, { marginTop: 10 }]}>
                  <TouchableOpacity
                    onPress={() => pickImage(setUdyamRegistrationUri)}
                    style={[styles.docCard, styles.docCardGap]}>
                    {udyamRegistrationUri ? (
                      <Image source={{ uri: udyamRegistrationUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="file-document-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>Udyam registration</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => pickImage(setTradeCertificateUri)}
                    style={styles.docCard}>
                    {tradeCertificateUri ? (
                      <Image source={{ uri: tradeCertificateUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="file-check-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>Trade certificate</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.docGrid, { marginTop: 10 }]}>
                  <TouchableOpacity
                    onPress={() => pickImage(setShopImageUri)}
                    style={[styles.docCard, styles.docCardGap]}>
                    {shopImageUri ? (
                      <Image source={{ uri: shopImageUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="storefront-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>Shop photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => pickImage(setUserIdUri)}
                    style={styles.docCard}>
                    {userIdUri ? (
                      <Image source={{ uri: userIdUri }} style={styles.docPreview} />
                    ) : (
                      <Icon name="badge-account-outline" size={24} color="#1D4ED8" />
                    )}
                    <Text style={styles.docText}>User ID</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.termsRow}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                onPress={() => setAcceptedTerms(prev => !prev)}
                style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}
                activeOpacity={0.8}
              >
                {acceptedTerms ? (
                  <Icon name="check" size={12} color="#FFFFFF" />
                ) : null}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => setTermsModalVisible(true)}
                >
                  terms & conditions
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Already have an account? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal transparent visible={otpVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>OTP Verification</Text>
            <Text style={styles.modalSubtitle}>
              Enter the OTP sent to your phone
            </Text>
            <View style={styles.inputRow}>
              <Icon name="shield-key-outline" size={18} color="#64748B" />
              <TextInput
                value={otpInput}
                onChangeText={setOtpInput}
                keyboardType="number-pad"
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                maxLength={6}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={verifyOtp}>
              <Text style={styles.buttonText}>Verify & Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpVisible(false)}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B3B8F' },
  keyboardArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 20 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLogo: { width: 120, height: 34 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#334155', marginTop: 4, marginBottom: 12 },
  label: {
    color: '#1E3A8A',
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  inputRow: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    paddingLeft: 10,
    paddingVertical: 12,
  },
  termsRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center' },
  roleRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  roleChip: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFF',
  },
  roleChipActive: { borderColor: '#1D4ED8', backgroundColor: '#DBEAFE' },
  roleChipText: { color: '#334155', fontWeight: '600' },
  roleChipTextActive: { color: '#1D4ED8' },
  businessBlock: {
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  grid2: { flexDirection: 'row', marginTop: 10 },
  col: { flex: 1 },
  colWithGap: { flex: 1, marginRight: 12 },
  smallLabel: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 6,
  },
  docHint: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17,
  },
  docGrid: { flexDirection: 'row', marginTop: 6 },
  docCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: 'rgba(248,250,255,0.9)',
    padding: 12,
    alignItems: 'center',
  },
  docCardGap: { marginRight: 12 },
  docPreview: {
    width: '100%',
    height: 92,
    borderRadius: 12,
  },
  docText: {
    marginTop: 10,
    color: '#1D4ED8',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  termsText: { color: '#334155', fontWeight: '500' },
  termsLink: { color: '#1D4ED8', fontWeight: '800' },
  button: {
    marginTop: 18,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 13,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    marginTop: 16,
    textAlign: 'center',
    color: '#93C5FD',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalSubtitle: { color: '#475569', marginTop: 4, marginBottom: 8 },
});

export default RegisterScreen;
