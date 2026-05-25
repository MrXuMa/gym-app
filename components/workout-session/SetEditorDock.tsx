import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';

export type DockedSetEditorView = {
  exerciseId: string;
  exerciseName: string;
  displayNumber: number;
  reps: string;
  weight: string;
  saving: boolean;
};

export type DockedSetEditorActions = {
  onChangeReps: (value: string) => void;
  onChangeWeight: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export type DockedSetEditorPayload = DockedSetEditorView & DockedSetEditorActions;

type SetEditorDockProps = DockedSetEditorView & DockedSetEditorActions;

export function SetEditorDock({
  exerciseName,
  displayNumber,
  reps,
  weight,
  saving,
  onChangeReps,
  onChangeWeight,
  onSave,
  onClose,
}: SetEditorDockProps) {
  return (
    <View style={styles.dock}>
      <View style={styles.dockHeader}>
        <View style={styles.dockHeaderText}>
          <Text style={styles.dockTitle} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={styles.dockSubtitle}>Set {displayNumber}</Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close set editor"
          style={styles.closeButton}
        >
          <Ionicons name="close" size={22} color={homeTheme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Weight ({WEIGHT_UNIT_LABEL})</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={onChangeWeight}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={homeTheme.colors.textMuted}
            editable={!saving}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Reps</Text>
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={onChangeReps}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={homeTheme.colors.textMuted}
            editable={!saving}
          />
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.disabled]}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={`Save set ${displayNumber}`}
      >
        {saving ? (
          <ActivityIndicator color={homeTheme.colors.tabBar} />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    marginHorizontal: homeTheme.spacing.screen,
    marginTop: 8,
    padding: 14,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.navYellow,
    backgroundColor: homeTheme.colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  dockHeaderText: {
    flex: 1,
  },
  dockTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  dockSubtitle: {
    color: homeTheme.colors.navYellow,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  fields: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: homeTheme.colors.textPrimary,
    backgroundColor: homeTheme.colors.background,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.6,
  },
});
