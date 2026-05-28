import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';

type WidgetMoveBarProps = {
  widgetTitle: string;
  positionLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDone: () => void;
};

export function WidgetMoveBar({
  widgetTitle,
  positionLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDone,
}: WidgetMoveBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.copy}>
        <Text style={styles.title}>Moving {widgetTitle}</Text>
        <Text style={styles.subtitle}>{positionLabel} · Use arrows to shift on home</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.iconButton, !canMoveUp && styles.iconButtonDisabled]}
          onPress={onMoveUp}
          disabled={!canMoveUp}
          accessibilityRole="button"
          accessibilityLabel="Move widget up"
        >
          <Ionicons
            name="chevron-up"
            size={22}
            color={canMoveUp ? homeTheme.colors.foreground : homeTheme.colors.mutedForeground}
          />
        </Pressable>

        <Pressable
          style={[styles.iconButton, !canMoveDown && styles.iconButtonDisabled]}
          onPress={onMoveDown}
          disabled={!canMoveDown}
          accessibilityRole="button"
          accessibilityLabel="Move widget down"
        >
          <Ionicons
            name="chevron-down"
            size={22}
            color={canMoveDown ? homeTheme.colors.foreground : homeTheme.colors.mutedForeground}
          />
        </Pressable>

        <Pressable
          style={styles.doneButton}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Done moving widget"
        >
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: homeTheme.spacing.screen,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.primary,
    backgroundColor: homeTheme.colors.card,
    gap: 10,
  },
  copy: {
    gap: 2,
  },
  title: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  doneButton: {
    marginLeft: 'auto',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.primary,
  },
  doneLabel: {
    color: homeTheme.colors.primaryForeground,
    fontSize: 14,
    fontWeight: '700',
  },
});
