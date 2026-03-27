import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Deal } from '../../types';

type Props = {
  deal: Deal;
};

const DealCard = ({ deal }: Props) => {
  return (
    <View style={[styles.card, { backgroundColor: deal.color }]}>
      {deal.image ? (
        <Image
          source={{ uri: deal.image }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.overlay} />
      <Text style={styles.title}>{deal.title}</Text>
      <Text style={styles.subtitle}>{deal.subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 130,
    height: 95,
    borderRadius: 14,
    padding: 10,
    marginRight: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    zIndex: 2,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
    zIndex: 3,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
    fontSize: 12,
    zIndex: 3,
  },
});

export default DealCard;
