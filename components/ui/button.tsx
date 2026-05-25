import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { homeTheme } from '@/constants/theme';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'default',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={(state) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'default' ? homeTheme.colors.primaryForeground : homeTheme.colors.foreground}
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: homeTheme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: homeTheme.colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: homeTheme.colors.destructive,
  },
});

const labelStyles = StyleSheet.create({
  default: {
    color: homeTheme.colors.primaryForeground,
    textTransform: 'uppercase',
  },
  outline: {
    color: homeTheme.colors.foreground,
  },
  ghost: {
    color: homeTheme.colors.mutedForeground,
  },
  destructive: {
    color: homeTheme.colors.destructiveForeground,
    textTransform: 'uppercase',
  },
});
