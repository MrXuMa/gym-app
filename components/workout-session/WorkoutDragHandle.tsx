import { Pressable, StyleSheet, View } from 'react-native';
import { homeTheme } from '@/constants/theme';

type WorkoutDragHandleProps = {
  onDrag: () => void;
  disabled?: boolean;
};

export function WorkoutDragHandle({ onDrag, disabled = false }: WorkoutDragHandleProps) {
  return (
    <Pressable
      style={[styles.handle, disabled && styles.handleDisabled]}
      onLongPress={onDrag}
      delayLongPress={120}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Reorder exercise"
      accessibilityHint="Press and hold, then drag to change exercise order"
    >
      <View style={styles.bars}>
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.line} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 28,
    marginRight: 6,
    marginLeft: -4,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.muted,
  },
  handleDisabled: {
    opacity: 0.5,
  },
  bars: {
    gap: 4,
    alignItems: 'center',
  },
  line: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: homeTheme.colors.mutedForeground,
  },
});
