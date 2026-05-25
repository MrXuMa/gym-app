import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { homeTheme } from '@/constants/theme';

const crossWatermark = require('@/assets/images/home-cross-watermark.png');

export function ScreenCrossWatermark() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image source={crossWatermark} style={styles.image} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '90%',
    height: '78%',
    opacity: homeTheme.home.watermarkOpacity,
  },
});
