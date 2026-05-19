import { Platform, StyleSheet } from 'react-native';
import { homeTheme } from '@/constants/theme';

export const authPlaceholderColor = homeTheme.colors.textMuted;

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
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
});

export const authStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: homeTheme.spacing.screen,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: homeTheme.radius.card,
    backgroundColor: homeTheme.auth.cardBackground,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardEntablature: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 2,
  },
  cardFrieze: {
    height: 2,
    backgroundColor: homeTheme.colors.travertine,
    opacity: 0.35,
  },
  cardArchitrave: {
    height: 1,
    backgroundColor: homeTheme.colors.surfaceBorder,
  },
  header: {
    color: homeTheme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  field: {
    minHeight: 48,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    backgroundColor: homeTheme.auth.fieldBackground,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: homeTheme.colors.textPrimary,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputIcon: {
    color: homeTheme.colors.accent,
    fontWeight: '700',
    marginLeft: 10,
    fontSize: 13,
  },
  optionText: {
    color: homeTheme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  passwordHelp: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -6,
    marginBottom: 14,
    textAlign: 'center',
  },
  statusMessage: {
    color: homeTheme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'center',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.55)',
    borderRadius: homeTheme.radius.card,
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: homeTheme.colors.textPrimary,
    padding: 16,
    borderRadius: homeTheme.radius.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: homeTheme.colors.travertine,
  },
  buttonText: {
    color: homeTheme.colors.buttonText,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: homeTheme.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  disabled: { opacity: 0.5 },
});
