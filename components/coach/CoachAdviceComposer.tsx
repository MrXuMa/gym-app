import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { homeTheme } from '@/constants/theme';
import { getCoachQuestionValidationMessage, isValidCoachQuestion } from '@/lib/coach';
import { StyleSheet, Switch, Text, View } from 'react-native';

type CoachAdviceComposerProps = {
  question: string;
  onChangeQuestion: (value: string) => void;
  onSubmit: () => void;
  templateMode: boolean;
  onToggleTemplateMode: (value: boolean) => void;
  submitting?: boolean;
  disabled?: boolean;
};

export function CoachAdviceComposer({
  question,
  onChangeQuestion,
  onSubmit,
  templateMode,
  onToggleTemplateMode,
  submitting = false,
  disabled = false,
}: CoachAdviceComposerProps) {
  const validationMessage = question.length > 0 ? getCoachQuestionValidationMessage(question) : null;
  const canSubmit = isValidCoachQuestion(question) && !submitting && !disabled;
  const toggleDisabled = submitting || disabled;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Ask your coach</Text>
      <Input
        style={styles.input}
        value={question}
        onChangeText={onChangeQuestion}
        placeholder={
          templateMode
            ? "e.g. Build me a push workout for today"
            : "e.g. How should I adjust my routine this week?"
        }
        multiline
        maxLength={500}
        editable={!submitting && !disabled}
        textAlignVertical="top"
      />
      {validationMessage ? <Text style={styles.hint}>{validationMessage}</Text> : null}

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Template Generator</Text>
          <Text style={styles.toggleSubtitle}>
            {templateMode
              ? 'Coach returns a concise session and builds a saveable workout template.'
              : 'Coach answers with analysis and advice. No template is created.'}
          </Text>
        </View>
        <Switch
          value={templateMode}
          onValueChange={onToggleTemplateMode}
          disabled={toggleDisabled}
          trackColor={{ false: homeTheme.colors.border, true: homeTheme.colors.primary }}
          thumbColor={homeTheme.colors.background}
        />
      </View>

      <Text style={styles.meta}>
        {templateMode
          ? 'Workout plan + template are usually ready within a few minutes.'
          : 'Advice is usually ready within a few minutes.'}
      </Text>
      <Button
        label={templateMode ? 'Generate workout' : 'Request advice'}
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
  },
  meta: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
});
