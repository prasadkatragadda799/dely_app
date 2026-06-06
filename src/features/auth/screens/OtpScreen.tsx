import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { palette, radius, shadow, spacing, divisionTheme } from '../../../utils/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN = 30;
const ACCENT = divisionTheme.fmcg;
const OTP_LENGTH = 6;

const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  const tail = digits.slice(-4);
  return `••••••${tail}`;
};

const OtpScreen = ({ navigation, route }: Props) => {
  const { phone, requestId } = route.params;
  const { verifyCustomerOtp, sendCustomerOtp } = useAuth();

  const maskedPhone = useMemo(() => maskPhone(phone), [phone]);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [focused, setFocused] = useState(false);
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
    const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (digits.length === OTP_LENGTH && !loading) {
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

  const cells = Array.from({ length: OTP_LENGTH });

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.glowTop, { backgroundColor: ACCENT.primary }]} />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.9}>
            <Icon name="arrow-left" size={20} color={palette.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={[styles.iconBadge, { backgroundColor: ACCENT.soft }]}>
            <Icon name="shield-key-outline" size={26} color={ACCENT.primary} />
          </View>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to{'\n'}
            <Text style={styles.phoneStrong}>{maskedPhone}</Text>
          </Text>

          {/* OTP cells (hidden input drives the value) */}
          <Pressable style={styles.cellRow} onPress={() => inputRef.current?.focus()}>
            {cells.map((_, i) => {
              const char = otp[i] ?? '';
              const isActive = focused && i === otp.length;
              const isFilled = !!char;
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    isFilled && { borderColor: ACCENT.primary, backgroundColor: ACCENT.softer },
                    isActive && styles.cellActive,
                    isActive && { borderColor: ACCENT.primary },
                  ]}>
                  <Text style={styles.cellText}>{char}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={handleOtpChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            editable={!loading}
            style={styles.hiddenInput}
            caretHidden
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: ACCENT.primary, ...shadow.accent(ACCENT.primary) },
              (loading || otp.length < OTP_LENGTH) && styles.buttonDisabled,
            ]}
            disabled={loading || otp.length < OTP_LENGTH}
            onPress={() => onVerify(otp)}
            activeOpacity={0.9}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify & continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendQuestion}>Didn't receive it?</Text>
            <TouchableOpacity
              disabled={countdown > 0 || resendLoading}
              onPress={onResend}
              activeOpacity={0.8}>
              {resendLoading ? (
                <ActivityIndicator color={ACCENT.primary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.resendLink,
                    { color: countdown > 0 ? palette.faint : ACCENT.primary },
                  ]}>
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, overflow: 'hidden' },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -150,
    right: -90,
    opacity: 0.09,
  },
  keyboardArea: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  topBar: { position: 'absolute', top: spacing.lg, left: spacing.xl },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow.xs,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    ...shadow.md,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: palette.ink },
  subtitle: {
    color: palette.muted,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
  },
  phoneStrong: { color: palette.ink, fontWeight: '800' },

  cellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: spacing.xxl,
    width: '100%',
  },
  cell: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    backgroundColor: palette.surface,
    ...shadow.sm,
  },
  cellText: { fontSize: 22, fontWeight: '800', color: palette.ink },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },

  button: {
    marginTop: spacing.xxl,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    alignSelf: 'stretch',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '800', fontSize: 16 },

  resendRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resendQuestion: { color: palette.muted, fontWeight: '600', fontSize: 13 },
  resendLink: { fontWeight: '800', fontSize: 13 },
});

export default OtpScreen;
