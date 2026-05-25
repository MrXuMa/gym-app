import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { homeTheme } from '@/constants/theme';
import { getCoachQuestionValidationMessage, isValidCoachQuestion } from '@/lib/coach';
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
  const validationMessage = question.length > 0 ? getCoachQuestionValidationMessage(question) : null;
  const canSubmit = isValidCoachQuestion(question) && !submitting && !disabled;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Ask your coach</Text>
      <Input
        style={styles.input}
        value={question}
        onChangeText={onChangeQuestion}
        placeholder="e.g. How should I adjust my routine this week?"
        multiline
        maxLength={500}
        editable={!submitting && !disabled}
        textAlignVertical="top"
      />
      {validationMessage ? <Text style={styles.hint}>{validationMessage}</Text> : null}
      <Text style={styles.meta}>Advice is usually ready within a few minutes.</Text>
      <Button
        label="Request advice"
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
