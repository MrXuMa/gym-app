import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@/lib/tasks';
import { homeTheme } from '@/constants/theme';

type TaskRowProps = {
  task: Task;
  completing?: boolean;
  onComplete: () => void;
};

export function TaskRow({ task, completing = false, onComplete }: TaskRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.checkButton, completing && styles.checkButtonDisabled]}
        onPress={onComplete}
        disabled={completing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Mark "${task.title}" done`}
      >
        {completing ? (
          <ActivityIndicator size="small" color={homeTheme.colors.navYellow} />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color={homeTheme.colors.textMuted} />
        )}
      </Pressable>

      <Text style={styles.title} numberOfLines={3}>
        {task.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  checkButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
});
