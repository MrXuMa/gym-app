import { Platform, StyleSheet } from 'react-native';
import { homeTheme } from '@/constants/theme';

export const authPlaceholderColor = homeTheme.colors.mutedForeground;

export const webInputReset =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      } as any)
    : null;

const cardShadow = Platform.select({
  web: {
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});

export const authStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: homeTheme.spacing.screen,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderRadius: homeTheme.radius.card,
    backgroundColor: homeTheme.auth.cardBackground,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  header: {
    color: homeTheme.colors.foreground,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  field: {
    minHeight: 48,
    borderRadius: homeTheme.radius.input,
    borderWidth: 1,
    borderColor: homeTheme.colors.input,
    backgroundColor: homeTheme.auth.fieldBackground,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: homeTheme.colors.foreground,
    fontSize: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    color: homeTheme.colors.primary,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  link: {
    color: homeTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  passwordHelp: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusMessage: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: homeTheme.radius.input,
    backgroundColor: 'rgba(127, 29, 29, 0.25)',
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  footerLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    color: homeTheme.colors.mutedForeground,
    fontWeight: '500',
    fontSize: 14,
  },
  footerTextHighlight: {
    color: homeTheme.colors.primary,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
