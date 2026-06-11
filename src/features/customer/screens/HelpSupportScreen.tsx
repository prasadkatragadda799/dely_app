import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TermsAndConditionsModal from '../../../shared/ui/TermsAndConditionsModal';
import { useAppSelector } from '../../../hooks/redux';
import { palette, shadow, getDivision } from '../../../utils/theme';

const SUPPORT_EMAIL = 'delycart.in@gmail.com';

type LinkItem = {
  icon: string;
  label: string;
  onPress: () => void;
};

const HelpSupportScreen = () => {
  const [termsVisible, setTermsVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const homeDivision = useAppSelector(state => state.homeDivision?.division ?? 'fmcg');
  const primary = getDivision(homeDivision).primary;

  const legalCentreUrl = 'https://delycart.in/legal';
  const privacyPolicyUrl = 'https://delycart.in/privacy-policy';
  const termsWebUrl = 'https://delycart.in/terms-and-conditions';

  const openSupportMail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

  const openExternal = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  };

  const legalLinks: LinkItem[] = [
    { icon: 'gavel', label: 'Legal centre (all documents)', onPress: () => openExternal(legalCentreUrl) },
    { icon: 'shield-eye-outline', label: 'Privacy Policy', onPress: () => openExternal(privacyPolicyUrl) },
    { icon: 'file-document-outline', label: 'Terms & Conditions (web)', onPress: () => openExternal(termsWebUrl) },
    { icon: 'text-box-check-outline', label: 'Terms & Conditions (in app)', onPress: () => setTermsVisible(true) },
  ];

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 12 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      <View style={[styles.heroBanner, { backgroundColor: primary }]}>
        <View style={styles.heroIconWrap}>
          <Icon name="headset" size={34} color="#FFFFFF" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Help & Support</Text>
          <Text style={styles.heroSub}>
            We're here for you. Reach out anytime — we reply within 24 hours.
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: primary }]}>Contact us</Text>
      <View style={styles.card}>
        <View style={styles.contactRow}>
          <View style={[styles.contactIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Icon name="email-outline" size={22} color="#3B82F6" />
          </View>
          <View style={styles.contactMeta}>
            <Text style={styles.contactLabel}>Support email</Text>
            <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.mailButton, { backgroundColor: primary }]}
        onPress={openSupportMail}
        activeOpacity={0.9}>
        <Icon name="send-outline" size={18} color="#FFFFFF" />
        <Text style={styles.mailButtonText}>Email support</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: primary }]}>Legal</Text>
      <View style={styles.card}>
        {legalLinks.map((link, i) => (
          <TouchableOpacity
            key={link.label}
            style={[styles.linkRow, i < legalLinks.length - 1 && styles.linkRowDivider]}
            onPress={link.onPress}
            activeOpacity={0.85}>
            <View style={[styles.linkIconWrap, { backgroundColor: `${primary}14` }]}>
              <Icon name={link.icon} size={18} color={primary} />
            </View>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Icon name="chevron-right" size={18} color={palette.muted} />
          </TouchableOpacity>
        ))}
      </View>

      <TermsAndConditionsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
      />
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
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactMeta: { flex: 1 },
  contactLabel: { color: palette.muted, fontWeight: '700', fontSize: 12 },
  contactValue: { color: palette.ink, fontWeight: '800', fontSize: 14, marginTop: 2 },
  mailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 20,
    ...shadow.sm,
  },
  mailButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  linkRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  linkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: { flex: 1, color: palette.ink, fontWeight: '700', fontSize: 13 },
});

export default HelpSupportScreen;
