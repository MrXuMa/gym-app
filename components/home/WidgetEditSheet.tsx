import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import type { WidgetDefinition, WidgetEditAction } from '@/components/home/widgetRegistry';

type WidgetEditSheetProps = {
  visible: boolean;
  definition: WidgetDefinition | null;
  editActions: WidgetEditAction[];
  onClose: () => void;
  onMoveWidget?: (definition: WidgetDefinition) => void;
  onRemove: (definition: WidgetDefinition) => Promise<void> | void;
};

export function WidgetEditSheet({
  visible,
  definition,
  editActions,
  onClose,
  onMoveWidget,
  onRemove,
}: WidgetEditSheetProps) {
  function handleMove() {
    if (!definition || !onMoveWidget) {
      return;
    }

    onClose();
    setTimeout(() => onMoveWidget(definition), 0);
  }
  function handleRemove() {
    if (!definition) {
      return;
    }
    Alert.alert(
      'Remove widget?',
      `${definition.title} will disappear from your home screen. You can add it back later from the + button.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await onRemove(definition);
            onClose();
          },
        },
      ],
    );
  }

  function handleAction(action: WidgetEditAction) {
    onClose();
    // Defer to next tick so the modal can finish dismissing before any follow-up modal opens.
    setTimeout(() => action.onSelect(), 0);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {definition ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name={definition.iconName} size={20} color={homeTheme.colors.primary} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{definition.title}</Text>
                  <Text style={styles.subtitle}>{definition.description}</Text>
                </View>
              </View>

              <View style={styles.actionList}>
                {onMoveWidget ? (
                  <Pressable
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                    onPress={handleMove}
                  >
                    <Ionicons name="move-outline" size={20} color={homeTheme.colors.foreground} />
                    <Text style={styles.actionLabel}>Move widget</Text>
                  </Pressable>
                ) : null}
                {editActions.map((action) => (
                  <Pressable
                    key={action.id}
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                    onPress={() => handleAction(action)}
                  >
                    <Ionicons name={action.iconName} size={20} color={homeTheme.colors.foreground} />
                    <Text style={styles.actionLabel}>{action.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.action, styles.removeAction, pressed && styles.actionPressed]}
                  onPress={handleRemove}
                >
                  <Ionicons name="trash-outline" size={20} color={homeTheme.colors.destructive} />
                  <Text style={[styles.actionLabel, styles.removeLabel]}>Remove widget</Text>
                </Pressable>
              </View>

              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: homeTheme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: homeTheme.colors.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  actionList: {
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.muted,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  removeAction: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  removeLabel: {
    color: homeTheme.colors.destructive,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLabel: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 15,
    fontWeight: '600',
  },
});
