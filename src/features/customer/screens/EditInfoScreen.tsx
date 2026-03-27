import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { setBusinessProfile } from '../businessProfileSlice';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

const EditInfoScreen = () => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const business = useAppSelector(state => state.businessProfile.profile);

  const [businessName, setBusinessName] = useState(business?.businessName ?? '');
  const [gstNumber, setGstNumber] = useState(business?.gstNumber ?? '');
  const [fmcgNumber, setFmcgNumber] = useState(business?.fmcgNumber ?? '');
  const [shopImageUri, setShopImageUri] = useState<string | undefined>(business?.shopImageUri);
  const [userIdUri, setUserIdUri] = useState<string | undefined>(business?.userIdUri);

  useEffect(() => {
    setBusinessName(business?.businessName ?? '');
    setGstNumber(business?.gstNumber ?? '');
    setFmcgNumber(business?.fmcgNumber ?? '');
    setShopImageUri(business?.shopImageUri);
    setUserIdUri(business?.userIdUri);
  }, [business]);

  const canSave = useMemo(() => {
    return (
      businessName.trim().length > 0 &&
      gstNumber.trim().length > 0 &&
      fmcgNumber.trim().length > 0
    );
  }, [businessName, gstNumber, fmcgNumber]);

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

  const onSave = () => {
    if (!canSave) {
      Alert.alert('Missing details', 'Please fill business name, GST, and FMCG number.');
      return;
    }

    dispatch(
      setBusinessProfile({
        businessName: businessName.trim(),
        gstNumber: gstNumber.trim(),
        fmcgNumber: fmcgNumber.trim(),
        shopImageUri,
        userIdUri,
      }),
    );

    Alert.alert('Saved', 'KYC details updated. Resubmit KYC from your Profile screen.');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <Text style={styles.title}>Edit KYC details</Text>
      <Text style={styles.subtitle}>These values are sent for KYC verification.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>User</Text>
        <Text style={styles.readOnlyValue}>
          {user?.name ?? 'Guest User'} ({user?.email ?? '—'})
        </Text>

        <Text style={styles.sectionLabel}>Business details</Text>

        <Text style={styles.inputLabel}>Business name</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Enter business name"
          autoCapitalize="words"
        />

        <Text style={styles.inputLabel}>GST number</Text>
        <TextInput
          style={styles.input}
          value={gstNumber}
          onChangeText={setGstNumber}
          placeholder="GSTIN"
          autoCapitalize="characters"
        />

        <Text style={styles.inputLabel}>FMCG number (FSSAI)</Text>
        <TextInput
          style={styles.input}
          value={fmcgNumber}
          onChangeText={setFmcgNumber}
          placeholder="14-digit FSSAI"
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Documents</Text>

        <View style={styles.docRow}>
          <TouchableOpacity
            style={styles.docButton}
            onPress={() => pickImage(setShopImageUri)}>
            {shopImageUri ? (
              <Image source={{ uri: shopImageUri }} style={styles.docPreview} />
            ) : (
              <Text style={styles.docButtonText}>Upload Shop Image</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.docButton}
            onPress={() => pickImage(setUserIdUri)}>
            {userIdUri ? (
              <Image source={{ uri: userIdUri }} style={styles.docPreview} />
            ) : (
              <Text style={styles.docButtonText}>Upload User ID</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: canSave ? '#1D4ED8' : '#A5B4FC' },
          ]}
          onPress={onSave}
          disabled={!canSave}>
          <Text style={styles.saveButtonText}>Save KYC details</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FBFF' },
  content: { padding: 16, paddingBottom: 36 },
  title: { fontSize: 24, fontWeight: '900', color: '#0B3B8F' },
  subtitle: { marginTop: 8, color: '#64748B', fontWeight: '700' },
  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  sectionLabel: {
    marginTop: 12,
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
  inputLabel: {
    marginTop: 12,
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
  docRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  docButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docButtonText: {
    fontWeight: '900',
    color: '#1D4ED8',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  docPreview: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '900' },
});

export default EditInfoScreen;
