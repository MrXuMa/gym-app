import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { WidgetGrid } from '@/components/home/WidgetGrid';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { homeTheme } from '@/constants/theme';

export default function MetricsScreen() {
  const { metrics, loading, refreshing, refresh } = useHomeMetrics();

  return (
    <AppScreen title="Metrics">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={homeTheme.colors.textPrimary} />
          }
        >
          <Text style={styles.lead}>Your training metrics at a glance.</Text>
          <WidgetGrid metrics={metrics} layout="metrics" />
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  lead: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    marginBottom: homeTheme.spacing.cardGap,
  },
});
