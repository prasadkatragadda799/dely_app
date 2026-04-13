import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TERMS_AND_CONDITIONS_TEXT } from '../../constants/termsAndConditionsText';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const TermsAndConditionsModal = ({ visible, onClose }: Props) => (
  <Modal
    transparent
    visible={visible}
    animationType="slide"
    onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
          <Text style={styles.body}>{TERMS_AND_CONDITIONS_TEXT}</Text>
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flex: 1,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  closeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  closeText: { color: '#1D4ED8', fontWeight: '800' },
  scroll: { marginTop: 10, flex: 1 },
  body: {
    color: '#0F172A',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
  },
});

export default TermsAndConditionsModal;
