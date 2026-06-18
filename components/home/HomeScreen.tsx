import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddWidgetButton } from '@/components/home/AddWidgetButton';
import { AddWidgetSheet } from '@/components/home/AddWidgetSheet';
import { PredictedMaxPicker } from '@/components/home/PredictedMaxPicker';
import { WidgetEditSheet } from '@/components/home/WidgetEditSheet';
import { WidgetGrid } from '@/components/home/WidgetGrid';
import { WidgetMoveBar } from '@/components/home/WidgetMoveBar';
import { getWidgetDefinition } from '@/components/home/widgetRegistry';
import type { WidgetId } from '@/lib/widgetSettings';
import type {
  WidgetCallbacks,
  WidgetDefinition,
  WidgetEditAction,
  WidgetRenderResult,
} from '@/components/home/widgetRegistry';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';

export function HomeScreen() {
  const router = useRouter();
  const { displayName } = useProfile();
  const {
    metrics,
    settings,
    loading,
    refreshing,
    refresh,
    setPredictedMaxExerciseId,
    addWidget,
    removeWidget,
    moveWidget,
  } = useHomeMetrics();

  const [predictedMaxPickerVisible, setPredictedMaxPickerVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [movingWidgetId, setMovingWidgetId] = useState<WidgetId | null>(null);
  const [editTarget, setEditTarget] = useState<{
    definition: WidgetDefinition;
    editActions: WidgetEditAction[];
  } | null>(null);

  const movingDefinition = movingWidgetId ? getWidgetDefinition(movingWidgetId) : null;
  const movingIndex = movingWidgetId ? settings.enabledWidgetIds.indexOf(movingWidgetId) : -1;

  const callbacks: WidgetCallbacks = useMemo(
    () => ({
      openPredictedMaxPicker: () => setPredictedMaxPickerVisible(true),
      openWorkouts: () => router.push('/workouts'),
      openLog: () => router.push('/log'),
      openTrainingSplit: () => router.push('/training-split'),
    }),
    [router],
  );

  const handleLongPress = useCallback(
    (definition: WidgetDefinition, rendered: WidgetRenderResult) => {
      setEditTarget({ definition, editActions: rendered.editActions ?? [] });
    },
    [],
  );

  return (
    <AppScreen
      title="Home"
      headerLeft={<AddWidgetButton onPress={() => setAddSheetVisible(true)} />}
      showCrossWatermark
    >
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Welcome, {displayName}.</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
          ) : (
            <>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={
                  movingWidgetId ? undefined : (
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={refresh}
                      tintColor={homeTheme.colors.textPrimary}
                    />
                  )
                }
              >
                <WidgetGrid
                  metrics={metrics}
                  enabledWidgetIds={settings.enabledWidgetIds}
                  callbacks={callbacks}
                  movingWidgetId={movingWidgetId}
                  onLongPressWidget={handleLongPress}
                />
              </ScrollView>

              {movingWidgetId && movingDefinition && movingIndex >= 0 ? (
                <WidgetMoveBar
                  widgetTitle={movingDefinition.title}
                  positionLabel={`${movingIndex + 1} of ${settings.enabledWidgetIds.length}`}
                  canMoveUp={movingIndex > 0}
                  canMoveDown={movingIndex < settings.enabledWidgetIds.length - 1}
                  onMoveUp={() => void moveWidget(movingWidgetId, 'up')}
                  onMoveDown={() => void moveWidget(movingWidgetId, 'down')}
                  onDone={() => setMovingWidgetId(null)}
                />
              ) : null}
            </>
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

      <AddWidgetSheet
        visible={addSheetVisible}
        enabledWidgetIds={settings.enabledWidgetIds}
        onClose={() => setAddSheetVisible(false)}
        onAdd={async (id) => {
          await addWidget(id);
        }}
      />

      <WidgetEditSheet
        visible={editTarget !== null}
        definition={editTarget?.definition ?? null}
        editActions={editTarget?.editActions ?? []}
        onClose={() => setEditTarget(null)}
        onMoveWidget={(definition) => setMovingWidgetId(definition.id)}
        onRemove={async (definition) => {
          await removeWidget(definition.id);
          if (movingWidgetId === definition.id) {
            setMovingWidgetId(null);
          }
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
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
});
