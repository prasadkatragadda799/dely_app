import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../../hooks/useAuth';
import { AuthStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN = 30;

const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  const tail = digits.slice(-4);
  return `XXXXXX${tail}`;
};

const OtpScreen = ({ navigation, route }: Props) => {
  const { phone, requestId } = route.params;
  const { verifyCustomerOtp, sendCustomerOtp } = useAuth();

  const maskedPhone = useMemo(() => maskPhone(phone), [phone]);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const onVerify = async (code: string) => {
    try {
      setLoading(true);
      await verifyCustomerOtp({ phone, requestId, otp: code.trim() });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'OTP verification failed',
        text2: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (digits.length === 6 && !loading) {
      onVerify(digits);
    }
  };

  const onResend = async () => {
    if (countdown > 0 || resendLoading) return;
    try {
      setResendLoading(true);
      const next = await sendCustomerOtp({ phone });
      navigation.setParams({ requestId: next.requestId });
      setCountdown(RESEND_COOLDOWN);
      setOtp('');
      Toast.show({ type: 'success', text1: 'OTP resent' });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Failed to resend OTP',
        text2: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.9}
          >
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
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {maskedPhone}
          </Text>

          <Text style={styles.label}>OTP</Text>
          <View style={styles.inputRow}>
            <Icon name="shield-key-outline" size={18} color="#64748B" />
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              placeholder="6-digit OTP"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              maxLength={6}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              editable={!loading}
            />
            {loading && <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />}
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
            disabled={loading || otp.length < 6}
            onPress={() => onVerify(otp)}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineButton, (countdown > 0 || resendLoading) && styles.buttonDisabled]}
            disabled={countdown > 0 || resendLoading}
            onPress={onResend}
          >
            {resendLoading ? (
              <ActivityIndicator color="#1D4ED8" size="small" />
            ) : (
              <Text style={styles.outlineButtonText}>
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#062B66' },
  keyboardArea: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  subtitle: { color: '#334155', marginTop: 6, marginBottom: 14, fontWeight: '600' },
  label: { color: '#0F172A', fontWeight: '800', marginTop: 10, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  input: { flex: 1, paddingVertical: 14, paddingLeft: 10, color: '#0F172A', fontSize: 20, letterSpacing: 6, fontWeight: '800' },
  button: {
    marginTop: 16,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  outlineButtonText: {
    color: '#1D4ED8',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
});

export default OtpScreen;
