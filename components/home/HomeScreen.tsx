import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddWidgetButton } from '@/components/home/AddWidgetButton';
import { WidgetGrid } from '@/components/home/WidgetGrid';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';

const homeCrossWatermark = require('@/assets/images/home-cross-watermark.png');

export function HomeScreen() {
  const { displayName } = useProfile();
  const { metrics, loading, refreshing, refresh } = useHomeMetrics();

  return (
    <AppScreen title="Home" headerLeft={<AddWidgetButton />}>
      <View style={styles.screen}>
        <View style={styles.watermarkWrap} pointerEvents="none">
          <Image source={homeCrossWatermark} style={styles.watermark} contentFit="contain" />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Welcome, {displayName}.</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={homeTheme.colors.textPrimary}
                />
              }
            >
              <WidgetGrid metrics={metrics} />
            </ScrollView>
          )}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermark: {
    width: '120%',
    height: '110%',
    opacity: homeTheme.home.watermarkOpacity,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 12,
  },
  greeting: {
    color: homeTheme.colors.textPrimary,
    ...homeTheme.typography.greeting,
  },
  loader: {
    marginTop: 48,
  },
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
});
