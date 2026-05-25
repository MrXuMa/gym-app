import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeTheme } from '@/constants/theme';

export type StartWorkoutMode = 'blank' | 'template';

type StartWorkoutModeToggleProps = {
  mode: StartWorkoutMode;
  onChange: (mode: StartWorkoutMode) => void;
};

export function StartWorkoutModeToggle({ mode, onChange }: StartWorkoutModeToggleProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.option, mode === 'blank' && styles.optionActive]}
        onPress={() => onChange('blank')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'blank' }}
      >
        <Text style={[styles.optionText, mode === 'blank' && styles.optionTextActive]}>Start blank</Text>
      </Pressable>
      <Pressable
        style={[styles.option, mode === 'template' && styles.optionActive]}
        onPress={() => onChange('template')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'template' }}
      >
        <Text style={[styles.optionText, mode === 'template' && styles.optionTextActive]}>Use template</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
    alignItems: 'center',
  },
  optionActive: {
    borderColor: homeTheme.colors.ring,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  optionText: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    color: homeTheme.colors.primary,
  },
});
