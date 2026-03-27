import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SecurityScreen = () => {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Security</Text>
      <Text style={styles.subtitle}>Manage account safety and verification settings.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="check-decagram" size={18} color="#1D4ED8" />
          <Text style={styles.value}>Password protection is enabled</Text>
        </View>
        <View style={styles.row}>
          <Icon name="shield-check-outline" size={18} color="#1D4ED8" />
          <Text style={styles.value}>Two-step verification support available</Text>
        </View>
        <View style={styles.row}>
          <Icon name="clock-outline" size={18} color="#1D4ED8" />
          <Text style={styles.value}>Last login tracked for your account</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FBFF', padding: 16 },
  title: { fontSize: 24, fontWeight: '900', color: '#0B3B8F' },
  subtitle: { marginTop: 8, color: '#64748B', fontWeight: '700' },
  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { color: '#0F172A', fontWeight: '700' },
});

export default SecurityScreen;
