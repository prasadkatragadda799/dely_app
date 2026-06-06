import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Linking,
  Platform,
  ScrollView,
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

type LoginForm = {
  phone: string;
};

const CUSTOMER = divisionTheme.fmcg;
const DELIVERY = divisionTheme.homeKitchen;

const LoginScreen = ({ navigation }: Props) => {
  const { sendCustomerOtp, loginAsDelivery } = useAuth();
  const { control, handleSubmit } = useForm<LoginForm>({
    defaultValues: { phone: '' },
  });

  const [mode, setMode] = useState<'customer' | 'delivery'>('customer');
  const [showDeliveryPassword, setShowDeliveryPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryPassword, setDeliveryPassword] = useState('');

  const isDelivery = mode === 'delivery';
  const accent = isDelivery ? DELIVERY : CUSTOMER;

  const onSubmitCustomer = async (values: LoginForm) => {
    try {
      setLoading(true);
      const res = await sendCustomerOtp({ phone: values.phone });
      navigation.navigate('Otp', { phone: values.phone, requestId: res.requestId });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Failed to send OTP',
        text2: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitDelivery = async () => {
    try {
      setLoading(true);
      const digitsOnly = deliveryPhone.replace(/\D/g, '');
      await loginAsDelivery({
        phone: digitsOnly,
        password: deliveryPassword,
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Delivery login failed',
        text2: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* soft ambient glows */}
      <View style={[styles.glowTop, { backgroundColor: accent.primary }]} />
      <View style={[styles.glowBottom, { backgroundColor: accent.primaryDark }]} />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>Delycart</Text>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>
            {isDelivery ? 'Partner sign in' : 'Welcome back'}
          </Text>
          <Text style={styles.subhead}>
            {isDelivery
              ? 'Manage routes, tasks and performance in one place.'
              : 'Enter your mobile number to continue with a one-time code.'}
          </Text>

          {/* Segmented control */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[
                styles.segmentPill,
                !isDelivery && {
                  backgroundColor: CUSTOMER.primary,
                  ...shadow.accent(CUSTOMER.primary),
                },
              ]}
              onPress={() => setMode('customer')}
              activeOpacity={0.9}>
              <Icon
                name="account-outline"
                size={16}
                color={!isDelivery ? '#FFFFFF' : palette.muted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: !isDelivery ? '#FFFFFF' : palette.muted },
                ]}>
                Client
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentPill,
                isDelivery && {
                  backgroundColor: DELIVERY.primary,
                  ...shadow.accent(DELIVERY.primary),
                },
              ]}
              onPress={() => setMode('delivery')}
              activeOpacity={0.9}>
              <Icon
                name="truck-fast-outline"
                size={16}
                color={isDelivery ? '#FFFFFF' : palette.muted}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: isDelivery ? '#FFFFFF' : palette.muted },
                ]}>
                Delivery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {isDelivery ? (
              <>
                <Text style={styles.label}>Registered mobile number</Text>
                <View style={styles.inputRow}>
                  <Icon name="phone-outline" size={18} color={palette.faint} />
                  <TextInput
                    placeholder="10-digit mobile number"
                    placeholderTextColor={palette.faint}
                    value={deliveryPhone}
                    onChangeText={setDeliveryPhone}
                    style={styles.input}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={15}
                  />
                </View>

                <View style={styles.passwordLabelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      Keyboard.dismiss();
                      const url =
                        'mailto:support@delycart.app?subject=Delivery%20Password%20Reset';
                      const canOpen = await Linking.canOpenURL(url);
                      if (canOpen) {
                        await Linking.openURL(url);
                      } else {
                        Toast.show({
                          type: 'error',
                          text1: 'Unable to open email app',
                          text2: 'Please contact support@delycart.app',
                        });
                      }
                    }}>
                    <Text style={[styles.forgotText, { color: DELIVERY.primary }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <Icon name="lock-outline" size={18} color={palette.faint} />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={palette.faint}
                    value={deliveryPassword}
                    onChangeText={setDeliveryPassword}
                    style={styles.input}
                    secureTextEntry={!showDeliveryPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowDeliveryPassword(prev => !prev)}
                    style={styles.eyeBtn}
                    activeOpacity={0.9}>
                    <Icon
                      name={showDeliveryPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={palette.faint}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: DELIVERY.primary, ...shadow.accent(DELIVERY.primary) },
                    loading && styles.buttonLoading,
                  ]}
                  disabled={loading}
                  onPress={onSubmitDelivery}
                  activeOpacity={0.9}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Continue as partner</Text>
                      <Icon name="arrow-right" size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Phone number</Text>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.inputRow}>
                      <Icon name="phone-outline" size={18} color={palette.faint} />
                      <TextInput
                        placeholder="Enter phone number"
                        placeholderTextColor={palette.faint}
                        value={value ?? ''}
                        onChangeText={onChange}
                        style={styles.input}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                      />
                    </View>
                  )}
                />

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: CUSTOMER.primary, ...shadow.accent(CUSTOMER.primary) },
                    loading && styles.buttonLoading,
                  ]}
                  disabled={loading}
                  onPress={handleSubmit(onSubmitCustomer)}
                  activeOpacity={0.9}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Send OTP</Text>
                      <Icon name="arrow-right" size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.signupRow}>
                  <Text style={styles.signupQuestion}>New to Delycart?</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')}
                    activeOpacity={0.8}>
                    <Text style={[styles.signupLink, { color: CUSTOMER.primary }]}>
                      Create account
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Trust strip */}
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <Icon name="shield-check-outline" size={15} color={accent.primary} />
              <Text style={styles.trustChipText}>Secure & private</Text>
            </View>
            <View style={styles.trustChip}>
              <Icon name="lightning-bolt-outline" size={15} color={accent.primary} />
              <Text style={styles.trustChipText}>Fast checkout</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, overflow: 'hidden' },
  glowTop: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -130,
    left: -80,
    opacity: 0.1,
  },
  glowBottom: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    bottom: -160,
    right: -110,
    opacity: 0.08,
  },
  keyboardArea: { flex: 1, paddingHorizontal: spacing.xl },
  scrollContent: { flexGrow: 1, paddingTop: spacing.xl, paddingBottom: 160 },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.xxxl,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  logoImage: { width: 38, height: 38 },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: palette.ink,
  },

  headline: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: palette.ink },
  subhead: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: palette.muted,
  },

  segment: {
    flexDirection: 'row',
    marginTop: spacing.xxl,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.pill,
    padding: 5,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  segmentText: { fontWeight: '800', fontSize: 14 },

  card: {
    marginTop: spacing.xl,
    backgroundColor: palette.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow.md,
  },
  label: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: palette.surfaceAlt,
    gap: 10,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, color: palette.ink, fontWeight: '600' },
  eyeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  passwordLabelRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: { fontWeight: '800', fontSize: 12 },

  primaryButton: {
    marginTop: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
  },
  buttonLoading: { opacity: 0.8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  signupRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signupQuestion: { color: palette.muted, fontWeight: '600', fontSize: 13 },
  signupLink: { fontWeight: '800', fontSize: 13 },

  trustRow: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow.xs,
  },
  trustChipText: { color: palette.body, fontWeight: '700', fontSize: 12 },
});

export default LoginScreen;
