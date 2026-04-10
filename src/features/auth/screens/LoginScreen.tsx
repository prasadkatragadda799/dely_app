import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

type LoginForm = {
  phone: string;
};

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
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Image
              source={require('../../../../assets/logo.png')}
              style={styles.topBarLogo}
              resizeMode="contain"
            />
          </View>

          <View
            style={[
              styles.modeSegment,
              {
                borderColor:
                  mode === 'delivery'
                    ? 'rgba(16,185,129,0.25)'
                    : 'rgba(29,78,216,0.25)',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.modePill,
                mode === 'customer' && {
                  backgroundColor: '#1D4ED8',
                  borderColor: '#1D4ED8',
                },
              ]}
              onPress={() => setMode('customer')}
              activeOpacity={0.95}
            >
              <Icon
                name="account-outline"
                size={16}
                color={mode === 'customer' ? '#FFFFFF' : '#1D4ED8'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeText,
                  mode === 'customer' && { color: '#FFFFFF' },
                ]}
              >
                Client Login
              </Text>
            </TouchableOpacity>
            <View style={styles.modeDivider} />
            <TouchableOpacity
              style={[
                styles.modePill,
                mode === 'delivery' && {
                  backgroundColor: '#16A34A',
                  borderColor: '#16A34A',
                },
              ]}
              onPress={() => setMode('delivery')}
              activeOpacity={0.95}
            >
              <Icon
                name="truck-fast-outline"
                size={16}
                color={mode === 'delivery' ? '#FFFFFF' : '#16A34A'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeText,
                  mode === 'delivery' && { color: '#FFFFFF' },
                ]}
              >
                Delivery Partner
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'delivery' ? (
            <View>
              <View style={styles.deliveryHero}>
              <View style={styles.heroIconBox}>
                <Icon name="bike-fast" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.deliveryTitle}>Delivery Partner Portal</Text>
              <Text style={styles.deliverySubtitle}>
                Sign in to manage routes, delivery tasks, and performance in one
                place.
              </Text>
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <Icon name="shield-check-outline" size={14} color="#BFDBFE" />
                  <Text style={styles.trustChipText}>Secure Access</Text>
                </View>
                <View style={styles.trustChip}>
                  <Icon name="clock-outline" size={14} color="#BFDBFE" />
                  <Text style={styles.trustChipText}>Instant Sync</Text>
                </View>
              </View>
            </View>

            <View style={styles.deliveryCard}>
              <Text style={styles.deliveryLabel}>
                Registered mobile number
              </Text>

                <View style={styles.deliveryInputRow} collapsable={false}>
                  <Icon name="account-outline" size={18} color="#94A3B8" />
                  <TextInput
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#94A3B8"
                    value={deliveryPhone}
                    onChangeText={setDeliveryPhone}
                    style={styles.deliveryInput}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={15}
                  />
                </View>

              <View style={styles.passwordLabelRow}>
                <Text style={styles.deliveryLabel}>Password</Text>
                <TouchableOpacity
                  onPress={async () => {
                    Keyboard.dismiss();
                    const url = 'mailto:support@delycart.app?subject=Delivery%20Password%20Reset';
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
                  }}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.deliveryInputRow} collapsable={false}>
                <Icon name="lock-outline" size={18} color="#94A3B8" />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={deliveryPassword}
                  onChangeText={setDeliveryPassword}
                  style={styles.deliveryInput}
                  secureTextEntry={!showDeliveryPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowDeliveryPassword(prev => !prev)}
                  style={styles.eyeBtn}
                  activeOpacity={0.9}
                >
                  <Icon
                    name={showDeliveryPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={loading}
                onPress={onSubmitDelivery}
              >
                <Text style={styles.primaryButtonText}>
                  Continue as Partner
                </Text>
                <Icon name="arrow-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              {/* <Text style={styles.bottomQuestion}>
                Don't have an account yet?
              </Text>

              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.outlineButtonText}>
                  Join Delivery Network
                </Text>
              </TouchableOpacity> */}
            </View>

            {/* Mode switch moved to the segmented control above */}
            </View>
          ) : (
            <View>
              <View style={styles.deliveryHero}>
              <View style={styles.heroIconBox}>
                <Icon name="account-circle-outline" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.deliveryTitle}>Welcome Back</Text>
              <Text style={styles.deliverySubtitle}>
                Enter your mobile number to login with OTP.
              </Text>
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <Icon name="lock-outline" size={14} color="#BFDBFE" />
                  <Text style={styles.trustChipText}>Private & Safe</Text>
                </View>
                <View style={styles.trustChip}>
                  <Icon
                    name="lightning-bolt-outline"
                    size={14}
                    color="#BFDBFE"
                  />
                  <Text style={styles.trustChipText}>Quick Login</Text>
                </View>
              </View>
            </View>

            <View style={styles.deliveryCard}>
              <Text style={styles.deliveryLabel}>Phone number</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.deliveryInputRow} collapsable={false}>
                    <Icon name="phone-outline" size={18} color="#94A3B8" />
                    <TextInput
                      placeholder="Enter phone number"
                      placeholderTextColor="#94A3B8"
                      value={value ?? ''}
                      onChangeText={onChange}
                      style={styles.deliveryInput}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>
                )}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={loading}
                onPress={handleSubmit(onSubmitCustomer)}
              >
                <Text style={styles.primaryButtonText}>Send OTP</Text>
                <Icon name="arrow-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.bottomQuestion}>
                Don't have an account yet?
              </Text>

              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.outlineButtonText}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {/* Mode switch moved to the segmented control above */}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#062B66' },
  keyboardArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLogo: {
    width: 52,
    height: 52,
  },

  modeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 28,
    marginBottom: 20,
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modeDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'transparent',
  },
  modeText: {
    fontWeight: '900',
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 4,
  },

  topHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  brandText: { color: '#FFFFFF', fontWeight: '800' },
  deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  deliveryButtonText: { color: '#14532D', fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#334155', marginTop: 4, marginBottom: 14 },
  label: { color: '#1E3A8A', fontWeight: '700', marginTop: 8, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    paddingLeft: 10,
    paddingVertical: 12,
  },

  primaryButtonCustomer: {
    backgroundColor: '#1D4ED8',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonTextCustomer: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },

  link: {
    color: '#1D4ED8',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '700',
  },

  // Delivery UI
  deliveryHero: { marginTop: 6, alignItems: 'center' },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deliveryTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  deliverySubtitle: {
    marginTop: 8,
    color: '#D1E9FF',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  trustRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  trustChipText: {
    color: '#DBEAFE',
    fontWeight: '800',
    fontSize: 11,
  },
  deliveryCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  deliveryLabel: {
    color: '#0F172A',
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 8,
  },
  deliveryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  deliveryInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordLabelRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },

  primaryButton: {
    backgroundColor: '#1D4ED8',
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },

  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: { color: '#1D4ED8', fontWeight: '900' },
  bottomQuestion: {
    marginTop: 12,
    textAlign: 'center',
    color: '#64748B',
    fontWeight: '700',
  },

  featureRow: { marginTop: 18, flexDirection: 'row', gap: 12 },
  featureCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
  },
  featureTitle: {
    marginTop: 10,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  featureSubtitle: {
    marginTop: 4,
    color: '#D1E9FF',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },

  switchLink: { marginTop: 14, alignItems: 'center' },
  switchLinkText: { color: '#FFFFFF', fontWeight: '900', opacity: 0.9 },
});

export default LoginScreen;
