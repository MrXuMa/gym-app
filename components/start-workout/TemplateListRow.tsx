import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutTemplateListItem } from '@/lib/workoutTemplates';
import { homeTheme } from '@/constants/theme';

const DELETE_WIDTH = 88;

type TemplateListRowProps = {
  template: WorkoutTemplateListItem;
  selected: boolean;
  deleting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
};

export function TemplateListRow({
  template,
  selected,
  deleting,
  onSelect,
  onEdit,
  onDelete,
  onSwipeableWillOpen,
}: TemplateListRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  function handleWillOpen() {
    if (swipeableRef.current) {
      onSwipeableWillOpen(swipeableRef.current);
    }
  }

  function renderRightActions() {
    return (
      <RectButton
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        enabled={!deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.deleteContent}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.deleteLabel}>Delete</Text>
          </View>
        )}
      </RectButton>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={handleWillOpen}
      >
        <Pressable
          style={[styles.row, selected && styles.rowSelected]}
          onPress={onSelect}
          onLongPress={onEdit}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityState={{ selected }}
        >
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {template.name}
            </Text>
            <Text style={styles.meta}>
              {template.exerciseCount} {template.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </Text>
          </View>
          {selected ? <Ionicons name="checkmark-circle" size={22} color={homeTheme.colors.navYellow} /> : null}
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: homeTheme.colors.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowSelected: {
    borderColor: homeTheme.colors.ring,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  deleteAction: {
    width: DELETE_WIDTH,
    backgroundColor: homeTheme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: homeTheme.radius.card,
    marginBottom: 8,
  },
  deleteContent: {
    alignItems: 'center',
    gap: 4,
  },
  deleteLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
