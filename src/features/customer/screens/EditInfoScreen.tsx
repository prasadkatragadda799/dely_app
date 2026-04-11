import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { setBusinessProfile } from '../businessProfileSlice';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';

function KycDocPickCard({
  uri,
  label,
  icon,
  accent,
  onPick,
}: {
  uri?: string;
  label: string;
  icon: string;
  accent: string;
  onPick: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPick} style={editStyles.docCard} activeOpacity={0.85}>
      {uri ? (
        <Image source={{ uri }} style={editStyles.docPreview} />
      ) : (
        <View style={editStyles.docIconWrap}>
          <Icon name={icon} size={24} color={accent} />
        </View>
      )}
      <Text style={editStyles.docText}>{label}</Text>
    </TouchableOpacity>
  );
}

const EditInfoScreen = () => {
  const { alert: appAlert } = useAppAlert();
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const business = useAppSelector(state => state.businessProfile.profile);
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';
  const primary = isHomeKitchen ? '#16A34A' : '#1D4ED8';

  const [addressLine1, setAddressLine1] = useState(business?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(business?.addressLine2 ?? '');
  const [city, setCity] = useState(business?.city ?? '');
  const [stateVal, setStateVal] = useState(business?.state ?? '');
  const [pincode, setPincode] = useState(business?.pincode ?? '');
  const [businessName, setBusinessName] = useState(business?.businessName ?? '');
  const [gstNumber, setGstNumber] = useState(business?.gstNumber ?? '');
  const [fmcgNumber, setFmcgNumber] = useState(business?.fmcgNumber ?? '');
  const [gstCertificate, setGstCertificate] = useState<string | undefined>(
    business?.gstCertificate,
  );
  const [fssaiLicense, setFssaiLicense] = useState<string | undefined>(
    business?.fssaiLicense,
  );
  const [udyamRegistration, setUdyamRegistration] = useState<string | undefined>(
    business?.udyamRegistration,
  );
  const [tradeCertificate, setTradeCertificate] = useState<string | undefined>(
    business?.tradeCertificate,
  );
  const [shopImageUri, setShopImageUri] = useState<string | undefined>(business?.shopImageUri);
  const [userIdUri, setUserIdUri] = useState<string | undefined>(business?.userIdUri);

  useEffect(() => {
    setAddressLine1(business?.addressLine1 ?? '');
    setAddressLine2(business?.addressLine2 ?? '');
    setCity(business?.city ?? '');
    setStateVal(business?.state ?? '');
    setPincode(business?.pincode ?? '');
    setBusinessName(business?.businessName ?? '');
    setGstNumber(business?.gstNumber ?? '');
    setFmcgNumber(business?.fmcgNumber ?? '');
    setGstCertificate(business?.gstCertificate);
    setFssaiLicense(business?.fssaiLicense);
    setUdyamRegistration(business?.udyamRegistration);
    setTradeCertificate(business?.tradeCertificate);
    setShopImageUri(business?.shopImageUri);
    setUserIdUri(business?.userIdUri);
  }, [business]);

  const fssaiDigits = useMemo(
    () => fmcgNumber.replace(/\D/g, ''),
    [fmcgNumber],
  );

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!addressLine1.trim()) issues.push('Address line 1');
    if (!city.trim()) issues.push('City');
    if (!stateVal.trim()) issues.push('State');
    if (!pincode.trim()) issues.push('Pincode');
    if (!businessName.trim()) issues.push('Business name');
    if (!gstNumber.trim()) issues.push('GST number');
    if (!fmcgNumber.trim()) issues.push('FMCG (FSSAI) number');
    if (fssaiDigits.length !== 14) {
      issues.push('FSSAI must be exactly 14 digits');
    }
    if (!gstCertificate) issues.push('GST certificate photo');
    if (!fssaiLicense) issues.push('FSSAI license photo');
    if (!udyamRegistration) issues.push('Udyam registration photo');
    if (!tradeCertificate) issues.push('Trade certificate photo');
    if (!shopImageUri) issues.push('Shop photo');
    if (!userIdUri) issues.push('User ID photo');
    return issues;
  }, [
    addressLine1,
    city,
    stateVal,
    pincode,
    businessName,
    gstNumber,
    fmcgNumber,
    fssaiDigits.length,
    gstCertificate,
    fssaiLicense,
    udyamRegistration,
    tradeCertificate,
    shopImageUri,
    userIdUri,
  ]);

  const canSave = validationIssues.length === 0;

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

  const onSave = async () => {
    if (!canSave) {
      await appAlert({
        title: 'Complete your profile',
        message: validationIssues.length
          ? validationIssues.map(s => `• ${s}`).join('\n')
          : 'Please fill all required fields.',
      });
      return;
    }

    dispatch(
      setBusinessProfile({
        ...(business ?? {
          businessName: '',
          gstNumber: '',
          fmcgNumber: '',
        }),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: stateVal.trim(),
        pincode: pincode.trim(),
        businessName: businessName.trim(),
        gstNumber: gstNumber.trim(),
        fmcgNumber: fmcgNumber.trim(),
        gstCertificate,
        fssaiLicense,
        udyamRegistration,
        tradeCertificate,
        shopImageUri,
        userIdUri,
      }),
    );

    await appAlert({
      title: 'Saved',
      message: 'KYC details updated. Resubmit KYC from your Profile screen.',
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <Text style={styles.title}>Edit KYC details</Text>
      <Text style={styles.subtitle}>
        Same fields as registration — update anything, then save and resubmit KYC from Profile.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>User</Text>
        <Text style={styles.readOnlyValue}>
          {user?.name ?? 'Guest User'} ({user?.email ?? '—'})
        </Text>

        <Text style={styles.sectionLabel}>Address details</Text>

        <View style={styles.grid2}>
          <View style={styles.colWithGap}>
            <Text style={styles.smallLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Enter city"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>State</Text>
            <TextInput
              style={styles.input}
              value={stateVal}
              onChangeText={setStateVal}
              placeholder="Enter state"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>
        </View>

        <Text style={styles.smallLabel}>Pincode</Text>
        <TextInput
          style={styles.input}
          value={pincode}
          onChangeText={setPincode}
          placeholder="Pincode"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />

        <Text style={styles.smallLabel}>Address line 1</Text>
        <TextInput
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="House / street / locality"
          placeholderTextColor="#94A3B8"
          autoCapitalize="sentences"
        />

        <Text style={styles.smallLabel}>Address line 2 (optional)</Text>
        <TextInput
          style={styles.input}
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Landmark (optional)"
          placeholderTextColor="#94A3B8"
          autoCapitalize="sentences"
        />

        <Text style={styles.sectionLabel}>Business details</Text>

        <View style={styles.grid2}>
          <View style={styles.colWithGap}>
            <Text style={styles.smallLabel}>Business name</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter business name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>GST number</Text>
            <TextInput
              style={styles.input}
              value={gstNumber}
              onChangeText={setGstNumber}
              placeholder="GSTIN"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Text style={styles.smallLabel}>FMCG number (FSSAI)</Text>
        <TextInput
          style={styles.input}
          value={fmcgNumber}
          onChangeText={setFmcgNumber}
          placeholder="14-digit FSSAI"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
        />

        <Text style={styles.sectionLabel}>Certificates & documents</Text>
        <Text style={styles.docHint}>
          Upload a clear photo of each certificate (same as registration).
        </Text>

        <View style={styles.docGrid}>
          <KycDocPickCard
            uri={gstCertificate}
            label="GST certificate"
            icon="file-certificate-outline"
            accent={primary}
            onPick={() => pickImage(setGstCertificate)}
          />
          <KycDocPickCard
            uri={fssaiLicense}
            label="FSSAI license"
            icon="file-document-outline"
            accent={primary}
            onPick={() => pickImage(setFssaiLicense)}
          />
        </View>

        <View style={[styles.docGrid, styles.docGridGap]}>
          <KycDocPickCard
            uri={udyamRegistration}
            label="Udyam registration"
            icon="file-document-outline"
            accent={primary}
            onPick={() => pickImage(setUdyamRegistration)}
          />
          <KycDocPickCard
            uri={tradeCertificate}
            label="Trade certificate"
            icon="file-check-outline"
            accent={primary}
            onPick={() => pickImage(setTradeCertificate)}
          />
        </View>

        <View style={[styles.docGrid, styles.docGridGap]}>
          <KycDocPickCard
            uri={shopImageUri}
            label="Shop photo"
            icon="storefront-outline"
            accent={primary}
            onPick={() => pickImage(setShopImageUri)}
          />
          <KycDocPickCard
            uri={userIdUri}
            label="User ID"
            icon="badge-account-outline"
            accent={primary}
            onPick={() => pickImage(setUserIdUri)}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            canSave
              ? isHomeKitchen
                ? styles.saveButtonKitchen
                : styles.saveButtonFmcg
              : styles.saveButtonMuted,
          ]}
          onPress={onSave}
          activeOpacity={0.9}>
          <Text style={styles.saveButtonText}>Save KYC details</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const editStyles = StyleSheet.create({
  docCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  docIconWrap: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPreview: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  docText: {
    marginTop: 8,
    fontWeight: '800',
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FBFF' },
  content: { padding: 16, paddingBottom: 36 },
  title: { fontSize: 24, fontWeight: '900', color: '#0B3B8F' },
  subtitle: { marginTop: 8, color: '#64748B', fontWeight: '700', lineHeight: 20 },
  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  sectionLabel: {
    marginTop: 14,
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14,
  },
  readOnlyValue: {
    marginTop: 6,
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  smallLabel: {
    marginTop: 10,
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
  },
  input: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  grid2: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colWithGap: { flex: 1 },
  col: { flex: 1 },
  docHint: {
    marginTop: 6,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  docGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  docGridGap: {
    marginTop: 10,
  },
  saveButton: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonFmcg: { backgroundColor: '#1D4ED8' },
  saveButtonKitchen: { backgroundColor: '#16A34A' },
  saveButtonMuted: { backgroundColor: '#CBD5E1' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '900' },
});

export default EditInfoScreen;
