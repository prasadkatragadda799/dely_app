import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../hooks/redux';
import { palette, shadow, getDivision } from '../../../utils/theme';

type SecurityRow = {
  icon: string;
  label: string;
  value: string;
  tint: string;
  action?: string;
};

const SecurityScreen = () => {
  const insets = useSafeAreaInsets();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const primary = getDivision(homeDivision).primary;

  const rows: SecurityRow[] = [
    {
      icon: 'lock-outline',
      label: 'Password',
      value: 'Protected',
      tint: '#3B82F6',
      action: 'Change',
    },
    {
      icon: 'shield-check-outline',
      label: 'Two-step verification',
      value: 'Available',
      tint: '#10B981',
      action: 'Enable',
    },
    {
      icon: 'cellphone-key',
      label: 'OTP login',
      value: 'Active on your mobile',
      tint: '#8B5CF6',
    },
    {
      icon: 'clock-check-outline',
      label: 'Session management',
      value: 'Login activity tracked',
      tint: '#F59E0B',
    },
    {
      icon: 'eye-off-outline',
      label: 'Data privacy',
      value: 'Your data is encrypted',
      tint: '#EC4899',
    },
  ];

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 12 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.heroBanner, { backgroundColor: primary }]}>
        <View style={styles.heroIconWrap}>
          <Icon name="shield-lock-outline" size={36} color="#FFFFFF" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Account Security</Text>
          <Text style={styles.heroSub}>
            Your account is protected. Manage settings below.
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: primary }]}>Security status</Text>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${row.tint}18` }]}>
              <Icon name={row.icon} size={20} color={row.tint} />
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
            {row.action ? (
              <TouchableOpacity
                style={[styles.actionChip, { borderColor: row.tint }]}
                activeOpacity={0.85}>
                <Text style={[styles.actionChipText, { color: row.tint }]}>{row.action}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.activeBadge}>
                <Icon name="check-circle" size={16} color="#10B981" />
              </View>
            )}
          </View>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: primary }]}>Tips</Text>
      <View style={styles.tipsCard}>
        {[
          'Never share your OTP with anyone.',
          'Use a strong, unique password.',
          'Log out from shared devices.',
        ].map(tip => (
          <View key={tip} style={styles.tipRow}>
            <Icon name="information-outline" size={14} color="#64748B" style={styles.tipIcon} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    ...shadow.md,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    marginBottom: 20,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMeta: { flex: 1 },
  rowLabel: { color: palette.ink, fontWeight: '800', fontSize: 13 },
  rowValue: { color: palette.muted, fontWeight: '600', fontSize: 12, marginTop: 2 },
  actionChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionChipText: { fontSize: 12, fontWeight: '800' },
  activeBadge: { width: 24, alignItems: 'center' },
  tipsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 10,
    ...shadow.sm,
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipIcon: { marginTop: 1 },
  tipText: { flex: 1, color: '#64748B', fontWeight: '600', fontSize: 13, lineHeight: 18 },
});

export default SecurityScreen;
