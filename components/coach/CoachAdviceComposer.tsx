import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { homeTheme } from '@/constants/theme';
import { getCoachPromptValidationMessage, isValidCoachPrompt } from '@/lib/coach';
import { StyleSheet, Text, View } from 'react-native';

type CoachAdviceComposerProps = {
  question: string;
  onChangeQuestion: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
};

export function CoachAdviceComposer({
  question,
  onChangeQuestion,
  onSubmit,
  submitting = false,
  disabled = false,
}: CoachAdviceComposerProps) {
  const validationMessage = question.length > 0 ? getCoachPromptValidationMessage(question) : null;
  const canSubmit = isValidCoachPrompt(question) && !submitting && !disabled;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Workout generator</Text>
      <Input
        style={styles.input}
        value={question}
        onChangeText={onChangeQuestion}
        placeholder="Optional: intense push workout, swap rows, 5 exercises…"
        multiline
        maxLength={500}
        editable={!submitting && !disabled}
        textAlignVertical="top"
      />
      {validationMessage ? <Text style={styles.hint}>{validationMessage}</Text> : null}

      <Text style={styles.meta}>
        Leave blank to use your weekly split, recent workouts, or a starter plan. Usually
        ready within a few minutes.
      </Text>
      <Button
        label="Generate workout"
        onPress={onSubmit}
        loading={submitting}
        disabled={!canSubmit}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    color: homeTheme.colors.destructive,
    fontSize: 12,
  },
  meta: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
});
