import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { homeTheme } from '@/constants/theme';

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={homeTheme.colors.mutedForeground}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: homeTheme.colors.input,
    borderRadius: homeTheme.radius.input,
    backgroundColor: homeTheme.colors.background,
    color: homeTheme.colors.foreground,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
});
