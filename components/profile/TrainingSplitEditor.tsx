import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import {
  dayHasMuscle,
  findDropDayKey,
  moveMuscleBetweenDays,
  removeMuscleFromDay,
  SPLIT_DAY_KEYS,
  SPLIT_DAY_LABELS,
  type DayLayout,
  type SplitDayKey,
  type TrainingSplitSchedule,
} from '@/lib/trainingSplit';

type TrainingSplitEditorProps = {
  schedule: TrainingSplitSchedule;
  catalogMuscles: string[];
  onChange: (next: TrainingSplitSchedule) => void;
};

type DragSource = { muscle: string; fromDay: SplitDayKey | 'palette' };

export function TrainingSplitEditor({ schedule, catalogMuscles, onChange }: TrainingSplitEditorProps) {
  const dayRefs = useRef<Partial<Record<SplitDayKey, RNView | null>>>({});
  const dayLayouts = useRef<Partial<Record<SplitDayKey, DayLayout>>>({});
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [hoverDay, setHoverDay] = useState<SplitDayKey | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragActive = useSharedValue(0);

  const paletteMuscles = catalogMuscles;

  const measureDayLayouts = useCallback(() => {
    for (const key of SPLIT_DAY_KEYS) {
      const view = dayRefs.current[key];
      if (!view) continue;
      view.measureInWindow((x, y, width, height) => {
        dayLayouts.current[key] = { x, y, width, height };
      });
    }
  }, []);

  const finishDrag = useCallback(
    (muscle: string, fromDay: SplitDayKey | 'palette', absoluteX: number, absoluteY: number) => {
      const dropDay = findDropDayKey(dayLayouts.current, absoluteX, absoluteY);
      setDragging(null);
      setHoverDay(null);
      dragActive.value = 0;

      if (!dropDay) return;
      if (fromDay === dropDay) return;
      if (dayHasMuscle(schedule, dropDay, muscle)) return;

      onChange(moveMuscleBetweenDays(schedule, muscle, fromDay, dropDay));
    },
    [dragActive, onChange, schedule],
  );

  const startDrag = useCallback(
    (source: DragSource) => {
      measureDayLayouts();
      setDragging(source);
      dragActive.value = 1;
    },
    [dragActive, measureDayLayouts],
  );

  const updateHover = useCallback((absoluteX: number, absoluteY: number) => {
    const dropDay = findDropDayKey(dayLayouts.current, absoluteX, absoluteY);
    setHoverDay(dropDay);
  }, []);

  function registerDayLayout(key: SplitDayKey) {
    const view = dayRefs.current[key];
    if (!view) return;
    view.measureInWindow((x, y, width, height) => {
      dayLayouts.current[key] = { x, y, width, height };
    });
  }

  function handleTapAdd(muscle: string, day: SplitDayKey) {
    onChange(moveMuscleBetweenDays(schedule, muscle, 'palette', day));
  }

  function handleRemove(muscle: string, day: SplitDayKey) {
    onChange(removeMuscleFromDay(schedule, muscle, day));
  }

  const floatingStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value,
    transform: [
      { translateX: dragX.value - 48 },
      { translateY: dragY.value - 20 },
    ],
  }));

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Drag groups onto a day. Long-press to move · tap × to remove.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarRow}
        onLayout={measureDayLayouts}
      >
        {SPLIT_DAY_KEYS.map((dayKey) => {
          const muscles = schedule[dayKey];
          const highlighted = hoverDay === dayKey || dragging?.fromDay === dayKey;
          const dropBlocked = dragging != null && dayHasMuscle(schedule, dayKey, dragging.muscle);

          return (
            <View
              key={dayKey}
              ref={(node) => {
                dayRefs.current[dayKey] = node;
              }}
              onLayout={() => registerDayLayout(dayKey)}
              style={[
                styles.dayColumn,
                highlighted && styles.dayColumnActive,
                dropBlocked && styles.dayColumnBlocked,
              ]}
            >
              <Text style={styles.dayLabel}>{SPLIT_DAY_LABELS[dayKey]}</Text>
              <View style={styles.dayDropZone}>
                {muscles.length === 0 ? (
                  <Text style={styles.dayEmpty}>Drop here</Text>
                ) : (
                  muscles.map((muscle) => (
                    <DraggableMuscleChip
                      key={`${dayKey}-${muscle}`}
                      label={muscle}
                      variant="day"
                      onRemove={() => handleRemove(muscle, dayKey)}
                      onDragStart={() => startDrag({ muscle, fromDay: dayKey })}
                      onDragMove={(x, y) => {
                        dragX.value = x;
                        dragY.value = y;
                        updateHover(x, y);
                      }}
                      onDragEnd={(x, y) => finishDrag(muscle, dayKey, x, y)}
                    />
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.paletteTitle}>Muscle groups</Text>

      <View style={styles.palette}>
        {paletteMuscles.length === 0 ? (
          <Text style={styles.paletteEmpty}>No muscle groups in your exercise catalog.</Text>
        ) : (
          paletteMuscles.map((muscle) => (
            <DraggableMuscleChip
              key={`palette-${muscle}`}
              label={muscle}
              variant="palette"
              onDragStart={() => startDrag({ muscle, fromDay: 'palette' })}
              onDragMove={(x, y) => {
                dragX.value = x;
                dragY.value = y;
                updateHover(x, y);
              }}
              onDragEnd={(x, y) => finishDrag(muscle, 'palette', x, y)}
              onPress={() => {
                const targetDay = SPLIT_DAY_KEYS.find((key) => !dayHasMuscle(schedule, key, muscle));
                if (targetDay) {
                  handleTapAdd(muscle, targetDay);
                }
              }}
            />
          ))
        )}
      </View>

      {dragging ? (
        <Animated.View pointerEvents="none" style={[styles.floatingChip, floatingStyle]}>
          <Text style={styles.floatingChipText}>{dragging.muscle}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

type DraggableMuscleChipProps = {
  label: string;
  variant?: 'day' | 'palette';
  onDragStart: () => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: (absoluteX: number, absoluteY: number) => void;
  onPress?: () => void;
  onRemove?: () => void;
};

function DraggableMuscleChip({
  label,
  variant = 'day',
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
  onRemove,
}: DraggableMuscleChipProps) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDragEnd)(event.absoluteX, event.absoluteY);
    })
    .onFinalize((event, success) => {
      if (!success) {
        runOnJS(onDragEnd)(event.absoluteX, event.absoluteY);
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (onPress) {
      runOnJS(onPress)();
    }
  });

  const composed = Gesture.Exclusive(pan, tap);

  const chipBody = (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.chipBody, variant === 'palette' && styles.chipPalette]}>
        <Text style={styles.chipText} numberOfLines={2}>
          {label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );

  if (variant === 'day' && onRemove) {
    return (
      <View style={styles.dayChipRow}>
        <View style={styles.dayChipDragArea}>
          <GestureDetector gesture={composed}>
            <Animated.View style={styles.chipBodyDay}>
              <Text style={styles.chipText} numberOfLines={2}>
                {label}
              </Text>
            </Animated.View>
          </GestureDetector>
        </View>
        <Pressable
          style={({ pressed }) => [styles.chipRemove, pressed && styles.chipRemovePressed]}
          onPress={onRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
        >
          <Ionicons name="close" size={16} color={homeTheme.colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return chipBody;
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  calendarRow: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  dayColumn: {
    width: 112,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
    padding: 8,
    minHeight: 180,
  },
  dayColumnActive: {
    borderColor: homeTheme.colors.textPrimary,
  },
  dayColumnBlocked: {
    opacity: 0.45,
  },
  dayLabel: {
    color: homeTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  dayDropZone: {
    flex: 1,
    gap: 6,
  },
  dayEmpty: {
    color: homeTheme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
  paletteTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteEmpty: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
  },
  dayChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: homeTheme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    paddingRight: 2,
  },
  dayChipDragArea: {
    flex: 1,
    minWidth: 0,
  },
  chipBody: {
    backgroundColor: homeTheme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipBodyDay: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 0,
  },
  chipPalette: {
    backgroundColor: homeTheme.colors.card,
  },
  chipRemove: {
    padding: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipRemovePressed: {
    opacity: 0.6,
    backgroundColor: homeTheme.colors.border,
  },
  chipText: {
    color: homeTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  floatingChip: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
    elevation: 8,
    backgroundColor: homeTheme.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  floatingChipText: {
    color: homeTheme.colors.tabBar,
    fontSize: 13,
    fontWeight: '700',
  },
});
