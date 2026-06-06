import React, { useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TermsAndConditionsModal from '../../../shared/ui/TermsAndConditionsModal';
import { palette, radius, shadow } from '../../../utils/theme';

const SUPPORT_EMAIL = 'delycart.in@gmail.com';

const HelpSupportScreen = () => {
  const [termsVisible, setTermsVisible] = useState(false);
  const legalCentreUrl = 'https://delycart.in/legal';
  const privacyPolicyUrl = 'https://delycart.in/privacy-policy';
  const termsWebUrl = 'https://delycart.in/terms-and-conditions';

  const openSupportMail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const openExternal = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>
        Need help? Reach out to our team anytime.
      </Text>

      <View style={styles.card}>
        <View style={styles.item}>
          <Icon name="email-outline" size={18} color="#3B82F6" />
          <Text style={styles.text}>{SUPPORT_EMAIL}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={openSupportMail}>
        <Text style={styles.buttonText}>Contact support</Text>
      </TouchableOpacity>

      <View style={styles.linksCard}>
        <Text style={styles.linksTitle}>Legal</Text>
        <TouchableOpacity onPress={() => openExternal(legalCentreUrl)} activeOpacity={0.9}>
          <Text style={styles.linkText}>Legal centre (all documents)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(privacyPolicyUrl)} activeOpacity={0.9}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(termsWebUrl)} activeOpacity={0.9}>
          <Text style={styles.linkText}>Terms & Conditions (web)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTermsVisible(true)} activeOpacity={0.9}>
          <Text style={styles.linkText}>Terms & Conditions (in app)</Text>
        </TouchableOpacity>
      </View>

      <TermsAndConditionsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
      />
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
    gap: 12,
    ...shadow.sm,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { color: palette.ink, fontWeight: '700' },
  button: {
    marginTop: 16,
    borderRadius: radius.md,
    backgroundColor: '#3B82F6',
    paddingVertical: 15,
    ...shadow.accent('#3B82F6'),
  },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '800' },
  linksCard: {
    marginTop: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 12,
    ...shadow.sm,
  },
  linksTitle: { fontWeight: '800', color: palette.ink },
  linkText: { color: '#3B82F6', fontWeight: '700' },
});

export default HelpSupportScreen;
