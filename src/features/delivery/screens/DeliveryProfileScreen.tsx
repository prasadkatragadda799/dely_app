import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../../hooks/useAuth';
import {
  useGetDeliveryDashboardSummaryQuery,
  useGetDeliveryMeQuery,
  useUpdateDeliveryMeMutation,
} from '../../../services/api/mobileApi';
import { useAppAlert } from '../../../shared/alert/AppAlertProvider';

const DeliveryProfileScreen = () => {
  const { alert: appAlert, confirm } = useAppAlert();
  const { user, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const { data: meRes } = useGetDeliveryMeQuery();
  const [updateDeliveryMe, { isLoading: isUpdating }] = useUpdateDeliveryMeMutation();
  const deliveryMe = meRes?.data;

  const { data: dashboardRes } = useGetDeliveryDashboardSummaryQuery();
  const dashboard = dashboardRes?.data;

  const displayName = deliveryMe?.name ?? user?.name ?? 'Delivery Partner';
  const displayPhone = deliveryMe?.phone ?? user?.email ?? '';
  const isOnline = deliveryMe?.isOnline ?? deliveryMe?.is_online ?? false;
  const todayEarnings = dashboard?.todayEarnings ?? 0;
  const completedTodayCount = dashboard?.completedTodayCount ?? 0;
  const earningsChangePercent = dashboard?.earningsChangePercent ?? 0;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setName(deliveryMe?.name ?? '');
    setPhone(deliveryMe?.phone ?? '');
    setEmail(deliveryMe?.email ?? '');
    setVehicleNumber(deliveryMe?.vehicleNumber ?? deliveryMe?.vehicle_number ?? '');
    setVehicleType(deliveryMe?.vehicleType ?? deliveryMe?.vehicle_type ?? '');
  }, [
    deliveryMe?.name,
    deliveryMe?.phone,
    deliveryMe?.email,
    deliveryMe?.vehicleNumber,
    deliveryMe?.vehicle_number,
    deliveryMe?.vehicleType,
    deliveryMe?.vehicle_type,
  ]);

  const handleSave = async () => {
    try {
      await updateDeliveryMe({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        vehicleType: vehicleType.trim() || undefined,
      }).unwrap();
      await appAlert({
        title: 'Success',
        message: 'Profile updated successfully',
      });
      setIsEditing(false);
    } catch (error) {
      const message =
        (error as { data?: { detail?: string; message?: string } })?.data?.detail ||
        (error as { data?: { detail?: string; message?: string } })?.data?.message ||
        'Failed to update profile';
      await appAlert({ title: 'Update failed', message });
    }
  };

  const handleCancelEdit = () => {
    setName(deliveryMe?.name ?? '');
    setPhone(deliveryMe?.phone ?? '');
    setEmail(deliveryMe?.email ?? '');
    setVehicleNumber(deliveryMe?.vehicleNumber ?? deliveryMe?.vehicle_number ?? '');
    setVehicleType(deliveryMe?.vehicleType ?? deliveryMe?.vehicle_type ?? '');
    setIsEditing(false);
  };

  const handleLogoutPress = async () => {
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Delivery Profile</Text>
      <Text style={styles.subtitle}>Manage your performance and account</Text>

      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Icon name="account" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.partnerName}>{displayName}</Text>
        {!!displayPhone && <Text style={styles.partnerRole}>{displayPhone}</Text>}
        <Text style={styles.partnerRole}>
          Status: {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Icon name="currency-inr" size={18} color="#16A34A" />
          <Text style={styles.metricValue}>{todayEarnings}</Text>
          <Text style={styles.metricLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.metricCard}>
          <Icon name="truck-check-outline" size={18} color="#16A34A" />
          <Text style={styles.metricValue}>{completedTodayCount}</Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <Icon name="trending-up" size={18} color="#16A34A" />
          <Text style={styles.metricValue}>
            {earningsChangePercent >= 0 ? '+' : ''}
            {earningsChangePercent}%
          </Text>
          <Text style={styles.metricLabel}>Vs Yesterday</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.editIconButton, isEditing && styles.editIconButtonActive]}
            onPress={() => setIsEditing(prev => !prev)}
            activeOpacity={0.85}>
            <Icon name="pencil-outline" size={16} color={isEditing ? '#FFFFFF' : '#15803D'} />
          </TouchableOpacity>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          style={styles.input}
          placeholderTextColor="#6B7280"
          editable={isEditing}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone"
          keyboardType="phone-pad"
          style={styles.input}
          placeholderTextColor="#6B7280"
          editable={isEditing}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholderTextColor="#6B7280"
          editable={isEditing}
        />
        <TextInput
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          placeholder="Vehicle Number"
          autoCapitalize="characters"
          style={styles.input}
          placeholderTextColor="#6B7280"
          editable={isEditing}
        />
        <TextInput
          value={vehicleType}
          onChangeText={setVehicleType}
          placeholder="Vehicle Type"
          style={styles.input}
          placeholderTextColor="#6B7280"
          editable={isEditing}
        />
        {isEditing && (
          <View style={styles.editActionsRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit} disabled={isUpdating}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSave} disabled={isUpdating}>
              <Icon name="content-save-outline" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoRow}>
          <Icon name="card-account-details-outline" size={17} color="#166534" />
          <Text style={styles.value}>Partner: {displayName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="shield-check-outline" size={17} color="#166534" />
          <Text style={styles.value}>Account status: Active</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="clock-check-outline" size={17} color="#166534" />
          <Text style={styles.value}>
            Availability:{' '}
            {(deliveryMe?.is_available ?? deliveryMe?.isAvailable)
              ? 'Available'
              : 'Not available'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogoutPress}>
        <Icon name="logout" size={16} color="#FFFFFF" />
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 36 },
  title: { fontSize: 26, fontWeight: '900', color: '#14532D' },
  subtitle: { marginTop: 3, color: '#15803D', fontWeight: '600' },
  heroCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    paddingVertical: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerName: { marginTop: 10, color: '#14532D', fontSize: 18, fontWeight: '900' },
  partnerRole: { marginTop: 3, color: '#166534', fontWeight: '600' },
  metricsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 10,
  },
  metricValue: { marginTop: 6, color: '#14532D', fontWeight: '900', fontSize: 16 },
  metricLabel: { marginTop: 2, color: '#166534', fontWeight: '700', fontSize: 11 },
  infoCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  sectionTitle: { color: '#14532D', fontWeight: '800', fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  editIconButtonActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  editActionsRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: '#F0FDF4',
  },
  cancelButtonText: { color: '#166534', fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  value: { color: '#1F2937', marginLeft: 8, fontSize: 15, fontWeight: '600' },
  button: {
    marginTop: 20,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: { textAlign: 'center', color: '#FFFFFF', fontWeight: '800', marginLeft: 6 },
});

export default DeliveryProfileScreen;
