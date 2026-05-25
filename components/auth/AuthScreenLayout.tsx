import { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStyles } from '@/components/auth/authStyles';
import { homeTheme } from '@/constants/theme';

const authStatueBackground = require('@/assets/images/auth-statue.png');

type AuthScreenLayoutProps = {
  children: ReactNode;
};

export function AuthScreenLayout({ children }: AuthScreenLayoutProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.backdrop} pointerEvents="none">
        <Image
          source={authStatueBackground}
          style={styles.heroImage}
          contentFit="cover"
          contentPosition="bottom center"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={[...homeTheme.auth.overlayGradient]}
          locations={[...homeTheme.auth.overlayLocations]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={authStyles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
    ...Platform.select({
      web: {
        minHeight: '100vh' as unknown as number,
        width: '100%',
      },
    }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: homeTheme.colors.background,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        position: 'fixed' as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      },
    }),
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
