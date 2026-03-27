import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const HelpSupportScreen = () => {
  const openSupportMail = async () => {
    const url = 'mailto:support@delycart.app';
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
          <Icon name="email-outline" size={18} color="#1D4ED8" />
          <Text style={styles.text}>support@delycart.app</Text>
        </View>
        <View style={styles.item}>
          <Icon name="phone-outline" size={18} color="#1D4ED8" />
          <Text style={styles.text}>+91 90000 00000</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={openSupportMail}>
        <Text style={styles.buttonText}>Contact support</Text>
      </TouchableOpacity>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { color: '#0F172A', fontWeight: '700' },
  button: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
  },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '800' },
});

export default HelpSupportScreen;
