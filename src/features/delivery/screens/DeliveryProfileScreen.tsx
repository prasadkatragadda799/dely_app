import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../../hooks/useAuth';
import {
  useGetDeliveryDashboardSummaryQuery,
  useGetDeliveryMeQuery,
  useUpdateDeliveryMeMutation,
  useToggleDeliveryAvailabilityMutation,
} from '../../../services/api/mobileApi';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';

const GREEN = '#16A34A';
const DARK_GREEN = '#14532D';
const WHITE = '#FFFFFF';

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const DeliveryProfileScreen = () => {
  const { confirm } = useAppAlert();
  const { user, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: meRes, refetch: refetchMe } = useGetDeliveryMeQuery();
  const [updateDeliveryMe, { isLoading: isUpdating }] = useUpdateDeliveryMeMutation();
  const [toggleAvailability] = useToggleDeliveryAvailabilityMutation();
  const deliveryMe = meRes?.data;

  const { data: dashboardRes } = useGetDeliveryDashboardSummaryQuery();
  const dashboard = dashboardRes?.data;

  const displayName = deliveryMe?.name ?? user?.name ?? 'Delivery Partner';
  const displayPhone = deliveryMe?.phone ?? '';
  const displayVehicle =
    (deliveryMe as any)?.vehicleNumber ??
    (deliveryMe as any)?.vehicle_number ??
    '';
  const displayVehicleType =
    (deliveryMe as any)?.vehicleType ??
    (deliveryMe as any)?.vehicle_type ??
    '';
  // "Available" = is_available (whether courier accepts new orders).
  // "is_online" is just the session-active flag (set on login/logout).
  const isAvailable =
    (deliveryMe as any)?.isAvailable ?? (deliveryMe as any)?.is_available ?? false;
  const todayEarnings = dashboard?.todayEarnings ?? 0;
  const completedTodayCount = dashboard?.completedTodayCount ?? 0;
  const earningsChangePercent = dashboard?.earningsChangePercent ?? 0;

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);

  useEffect(() => {
    setName(deliveryMe?.name ?? '');
    setPhone(deliveryMe?.phone ?? '');
    setEmail(deliveryMe?.email ?? '');
    setVehicleNumber(
      (deliveryMe as any)?.vehicleNumber ?? (deliveryMe as any)?.vehicle_number ?? '',
    );
    setVehicleType(
      (deliveryMe as any)?.vehicleType ?? (deliveryMe as any)?.vehicle_type ?? '',
    );
  }, [deliveryMe]);

  const handleToggleOnline = async () => {
    setIsTogglingOnline(true);
    try {
      await toggleAvailability({ available: !isAvailable }).unwrap();
      await refetchMe();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not update status' });
    } finally {
      setIsTogglingOnline(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateDeliveryMe({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        vehicleType: vehicleType.trim() || undefined,
      }).unwrap();
      Toast.show({ type: 'success', text1: 'Profile updated' });
      setIsEditing(false);
    } catch (err: any) {
      const msg =
        err?.data?.detail ?? err?.data?.message ?? 'Failed to update profile';
      Toast.show({ type: 'error', text1: msg });
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    await logout();
    Toast.show({ type: 'success', text1: 'Logged out successfully' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}>

        {/* ── Online / Offline banner ── */}
        <View style={[styles.onlineBanner, isAvailable ? styles.onlineBannerActive : styles.onlineBannerInactive]}>
          <View style={styles.onlineBannerLeft}>
            <View style={[styles.onlineDot, isAvailable ? styles.onlineDotActive : styles.onlineDotInactive]} />
            <View>
              <Text style={[styles.onlineTitle, isAvailable ? styles.onlineTitleActive : styles.onlineTitleInactive]}>
                {isAvailable ? 'You are Online' : 'You are Offline'}
              </Text>
              <Text style={styles.onlineSubtitle}>
                {isAvailable
                  ? 'Receiving new delivery orders'
                  : 'Toggle to start receiving orders'}
              </Text>
            </View>
          </View>
          {isTogglingOnline ? (
            <ActivityIndicator size="small" color={isAvailable ? GREEN : '#6B7280'} />
          ) : (
            <Switch
              value={isAvailable}
              onValueChange={handleToggleOnline}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={isAvailable ? GREEN : '#9CA3AF'}
              ios_backgroundColor="#D1D5DB"
            />
          )}
        </View>

        <View style={styles.content}>
          {/* ── Avatar + name ── */}
          <View style={styles.heroCard}>
            <View style={styles.avatar}>
              <Icon name="account" size={32} color={WHITE} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{displayName}</Text>
              {!!displayPhone && (
                <View style={styles.heroMeta}>
                  <Icon name="phone-outline" size={13} color="#15803D" />
                  <Text style={styles.heroMetaText}>{displayPhone}</Text>
                </View>
              )}
              {!!displayVehicle && (
                <View style={styles.heroMeta}>
                  <Icon name="motorbike" size={13} color="#15803D" />
                  <Text style={styles.heroMetaText}>
                    {displayVehicleType ? `${displayVehicleType} · ` : ''}{displayVehicle}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Earnings metrics ── */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Icon name="currency-inr" size={20} color={GREEN} />
              <Text style={styles.metricValue}>{formatCurrency(todayEarnings)}</Text>
              <Text style={styles.metricLabel}>Today's Earnings</Text>
            </View>
            <View style={styles.metricCard}>
              <Icon name="truck-check-outline" size={20} color={GREEN} />
              <Text style={styles.metricValue}>{completedTodayCount}</Text>
              <Text style={styles.metricLabel}>Delivered Today</Text>
            </View>
            <View style={styles.metricCard}>
              <Icon
                name={earningsChangePercent >= 0 ? 'trending-up' : 'trending-down'}
                size={20}
                color={earningsChangePercent >= 0 ? GREEN : '#DC2626'}
              />
              <Text
                style={[
                  styles.metricValue,
                  earningsChangePercent < 0 && styles.metricValueNegative,
                ]}>
                {earningsChangePercent >= 0 ? '+' : ''}{earningsChangePercent}%
              </Text>
              <Text style={styles.metricLabel}>vs Yesterday</Text>
            </View>
          </View>

          {/* ── Edit Profile ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              <TouchableOpacity
                style={[styles.editBtn, isEditing && styles.editBtnActive]}
                onPress={() => (isEditing ? setIsEditing(false) : setIsEditing(true))}
                activeOpacity={0.85}>
                <Icon
                  name={isEditing ? 'close' : 'pencil-outline'}
                  size={14}
                  color={isEditing ? WHITE : '#15803D'}
                />
                <Text style={[styles.editBtnText, isEditing && styles.editBtnTextActive]}>
                  {isEditing ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {[
              { label: 'Full Name', value: name, onChange: setName, icon: 'account-outline', keyboard: 'default' as const },
              { label: 'Phone', value: phone, onChange: setPhone, icon: 'phone-outline', keyboard: 'phone-pad' as const },
              { label: 'Email', value: email, onChange: setEmail, icon: 'email-outline', keyboard: 'email-address' as const },
              { label: 'Vehicle Number', value: vehicleNumber, onChange: setVehicleNumber, icon: 'card-text-outline', keyboard: 'default' as const },
              { label: 'Vehicle Type', value: vehicleType, onChange: setVehicleType, icon: 'motorbike', keyboard: 'default' as const },
            ].map(field => (
              <View key={field.label} style={styles.fieldRow}>
                <Icon name={field.icon} size={16} color="#6B7280" style={styles.fieldIcon} />
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {isEditing ? (
                    <TextInput
                      value={field.value}
                      onChangeText={field.onChange}
                      style={styles.fieldInput}
                      keyboardType={field.keyboard}
                      autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
                      placeholderTextColor="#9CA3AF"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <Text style={styles.fieldValue}>
                      {field.value || '—'}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {isEditing && (
              <TouchableOpacity
                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isUpdating}
                activeOpacity={0.85}>
                {isUpdating ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <>
                    <Icon name="content-save-outline" size={16} color={WHITE} />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* ── Account info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountRow}>
              <Icon name="shield-check-outline" size={16} color={GREEN} />
              <Text style={styles.accountText}>Account Status</Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>
            <View style={styles.accountRow}>
              <Icon name="star-outline" size={16} color="#F59E0B" />
              <Text style={styles.accountText}>Rating</Text>
              <Text style={styles.accountValue}>4.8 / 5.0</Text>
            </View>
          </View>

          {/* ── Logout ── */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.85}>
            <Icon name="logout" size={16} color="#DC2626" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Online banner
  onlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  onlineBannerActive: { backgroundColor: '#DCFCE7', borderBottomColor: '#86EFAC' },
  onlineBannerInactive: { backgroundColor: '#F3F4F6', borderBottomColor: '#E5E7EB' },
  onlineBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  onlineDotActive: { backgroundColor: GREEN },
  onlineDotInactive: { backgroundColor: '#9CA3AF' },
  onlineTitle: { fontWeight: '800', fontSize: 15 },
  onlineTitleActive: { color: DARK_GREEN },
  onlineTitleInactive: { color: '#374151' },
  onlineSubtitle: { color: '#6B7280', fontSize: 12, marginTop: 1 },

  content: { padding: 16, gap: 14 },

  // Hero card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { fontWeight: '900', fontSize: 18, color: DARK_GREEN },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { color: '#15803D', fontWeight: '600', fontSize: 13 },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  metricValue: { fontWeight: '900', fontSize: 16, color: DARK_GREEN },
  metricValueNegative: { color: '#DC2626' },
  metricLabel: { color: '#6B7280', fontWeight: '600', fontSize: 10, textAlign: 'center' },

  // Section card
  section: {
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontWeight: '800', fontSize: 15, color: DARK_GREEN },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnActive: { backgroundColor: '#374151', borderColor: '#374151' },
  editBtnText: { color: '#15803D', fontWeight: '700', fontSize: 12 },
  editBtnTextActive: { color: WHITE },

  // Profile fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldIcon: { marginTop: 3 },
  fieldContent: { flex: 1 },
  fieldLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  fieldValue: { color: '#111827', fontWeight: '600', fontSize: 14 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#111827',
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: DARK_GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: WHITE, fontWeight: '800', fontSize: 14 },

  // Account rows
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountText: { flex: 1, color: '#374151', fontWeight: '600', fontSize: 14 },
  accountValue: { color: DARK_GREEN, fontWeight: '700', fontSize: 14 },
  activePill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  activePillText: { color: DARK_GREEN, fontWeight: '800', fontSize: 12 },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    paddingVertical: 14,
  },
  logoutText: { color: '#DC2626', fontWeight: '800', fontSize: 15 },
});

export default DeliveryProfileScreen;
