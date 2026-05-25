import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddWidgetButton } from '@/components/home/AddWidgetButton';
import { PredictedMaxPicker } from '@/components/home/PredictedMaxPicker';
import { WidgetGrid } from '@/components/home/WidgetGrid';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';

export function HomeScreen() {
  const { displayName } = useProfile();
  const { metrics, settings, loading, refreshing, refresh, setPredictedMaxExerciseId } =
    useHomeMetrics();
  const [predictedMaxPickerVisible, setPredictedMaxPickerVisible] = useState(false);

  return (
    <AppScreen title="Home" headerLeft={<AddWidgetButton />} showCrossWatermark>
      <View style={styles.screen}>
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
              <WidgetGrid
                metrics={metrics}
                onEditPredictedMax={() => setPredictedMaxPickerVisible(true)}
              />
            </ScrollView>
          )}
        </View>
      </View>

      <PredictedMaxPicker
        visible={predictedMaxPickerVisible}
        selectedExerciseId={settings.predictedMaxExerciseId}
        onClose={() => setPredictedMaxPickerVisible(false)}
        onSelect={async (exerciseId) => {
          await setPredictedMaxExerciseId(exerciseId);
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
