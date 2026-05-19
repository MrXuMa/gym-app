import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { isValidWorkoutTitle, normalizeWorkoutTitle } from '@/lib/workoutDisplay';
import { homeTheme } from '@/constants/theme';

type NameWorkoutModalProps = {
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (title: string) => void;
};

export function NameWorkoutModal({ visible, submitting = false, onCancel, onConfirm }: NameWorkoutModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setError(null);
    }
  }, [visible]);

  function handleConfirm() {
    if (!isValidWorkoutTitle(title)) {
      setError('Enter a workout name (1–80 characters).');
      return;
    }

    onConfirm(normalizeWorkoutTitle(title));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.heading}>Name your workout</Text>
          <Text style={styles.subtitle}>Give this session a name before you start logging sets.</Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="e.g. Push Day, Leg Day"
            placeholderTextColor={homeTheme.colors.textMuted}
            autoFocus
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            editable={!submitting}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButton, submitting && styles.disabled]}
              disabled={submitting}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.startButton, submitting && styles.disabled]}
              disabled={submitting}
              onPress={handleConfirm}
            >
              {submitting ? (
                <ActivityIndicator color={homeTheme.colors.tabBar} />
              ) : (
                <Text style={styles.startText}>Start</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: homeTheme.spacing.screen,
  },
  card: {
    backgroundColor: homeTheme.colors.surface,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    padding: 20,
  },
  heading: {
    color: homeTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    borderRadius: homeTheme.radius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: homeTheme.colors.textPrimary,
    backgroundColor: homeTheme.colors.background,
    fontSize: 16,
  },
  inputError: {
    borderColor: homeTheme.colors.danger,
  },
  errorText: {
    color: homeTheme.colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    alignItems: 'center',
  },
  cancelText: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  startButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.navYellow,
    alignItems: 'center',
  },
  startText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
});
