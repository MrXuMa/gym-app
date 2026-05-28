import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import type { WidgetId } from '@/lib/widgetSettings';
import { ALL_WIDGET_DEFINITIONS, type WidgetDefinition } from '@/components/home/widgetRegistry';

type AddWidgetSheetProps = {
  visible: boolean;
  enabledWidgetIds: WidgetId[];
  onClose: () => void;
  onAdd: (id: WidgetId) => Promise<void> | void;
};

export function AddWidgetSheet({
  visible,
  enabledWidgetIds,
  onClose,
  onAdd,
}: AddWidgetSheetProps) {
  const [pendingId, setPendingId] = useState<WidgetId | null>(null);

  async function handleAdd(definition: WidgetDefinition) {
    if (enabledWidgetIds.includes(definition.id) || pendingId) {
      return;
    }
    setPendingId(definition.id);
    try {
      await onAdd(definition.id);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add widgets</Text>
            <Text style={styles.subtitle}>
              Tap a widget to add it to your home. Already-added widgets are marked.
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {ALL_WIDGET_DEFINITIONS.map((definition) => {
            const added = enabledWidgetIds.includes(definition.id);
            const submitting = pendingId === definition.id;

            return (
              <Pressable
                key={definition.id}
                disabled={added || submitting}
                style={({ pressed }) => [
                  styles.row,
                  added && styles.rowDisabled,
                  pressed && !added && styles.rowPressed,
                ]}
                onPress={() => handleAdd(definition)}
              >
                <View style={styles.icon}>
                  <Ionicons
                    name={definition.iconName}
                    size={22}
                    color={added ? homeTheme.colors.mutedForeground : homeTheme.colors.primary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{definition.title}</Text>
                  <Text style={styles.rowDescription}>{definition.description}</Text>
                </View>
                <View style={styles.statusSlot}>
                  {added ? (
                    <View style={styles.addedPill}>
                      <Ionicons name="checkmark" size={14} color={homeTheme.colors.mutedForeground} />
                      <Text style={styles.addedLabel}>Added</Text>
                    </View>
                  ) : submitting ? (
                    <Text style={styles.addingLabel}>Adding…</Text>
                  ) : (
                    <Ionicons
                      name="add-circle-outline"
                      size={26}
                      color={homeTheme.colors.primary}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: homeTheme.spacing.screen,
    marginBottom: 16,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  close: {
    color: homeTheme.colors.navYellow,
    fontSize: 15,
    fontWeight: '600',
    paddingTop: 4,
  },
  list: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 40,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    padding: 14,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  rowDescription: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  statusSlot: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  addedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: homeTheme.colors.muted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addedLabel: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
  },
  addingLabel: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '500',
  },
});
