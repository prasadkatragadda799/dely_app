import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { palette, radius, shadow } from '../../../utils/theme';

const SecurityScreen = () => {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Security</Text>
      <Text style={styles.subtitle}>Manage account safety and verification settings.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="check-decagram" size={18} color="#3B82F6" />
          <Text style={styles.value}>Password protection is enabled</Text>
        </View>
        <View style={styles.row}>
          <Icon name="shield-check-outline" size={18} color="#3B82F6" />
          <Text style={styles.value}>Two-step verification support available</Text>
        </View>
        <View style={styles.row}>
          <Icon name="clock-outline" size={18} color="#3B82F6" />
          <Text style={styles.value}>Last login tracked for your account</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  title: { fontSize: 24, fontWeight: '900', color: palette.ink },
  subtitle: { marginTop: 8, color: palette.muted, fontWeight: '700' },
  card: {
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 14,
    ...shadow.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { color: palette.ink, fontWeight: '700' },
});

export default SecurityScreen;
