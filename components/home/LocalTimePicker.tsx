import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import { formatResetTimeLocal } from '@/lib/bulletinTasks';

type LocalTimePickerProps = {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
};

function formatClock(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.stepperBlock}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperButtonPressed]}
          onPress={onDecrement}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons name="remove" size={18} color={homeTheme.colors.foreground} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperButtonPressed]}
          onPress={onIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons name="add" size={18} color={homeTheme.colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

export function LocalTimePicker({ hours, minutes, onChange }: LocalTimePickerProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.summary}>Comes back at {formatClock(hours, minutes)}</Text>
      <View style={styles.steppers}>
        <Stepper
          label="Hour"
          value={hours.toString().padStart(2, '0')}
          onDecrement={() => onChange((hours + 23) % 24, minutes)}
          onIncrement={() => onChange((hours + 1) % 24, minutes)}
        />
        <Stepper
          label="Minute"
          value={minutes.toString().padStart(2, '0')}
          onDecrement={() => onChange(hours, (minutes + 59) % 60)}
          onIncrement={() => onChange(hours, (minutes + 1) % 60)}
        />
      </View>
      <Text style={styles.hint}>Uses your phone&apos;s local time.</Text>
    </View>
  );
}

export function formatRecurringResetLabel(resetTimeLocal: string): string {
  return `Resets at ${formatResetTimeLocal(resetTimeLocal)}`;
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    padding: 14,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  summary: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
  },
  steppers: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperBlock: {
    flex: 1,
    gap: 6,
  },
  stepperLabel: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.input,
    backgroundColor: homeTheme.colors.background,
    paddingHorizontal: 4,
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    opacity: 0.7,
  },
  stepperValue: {
    color: homeTheme.colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
});
