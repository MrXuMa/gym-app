import { StyleSheet } from 'react-native';
import { homeTheme } from '@/constants/theme';

/** Shared layout + chrome for live session, edit workout, and template editors. */
export const workoutEditorStyles = StyleSheet.create({
  body: {
    flex: 1,
  },
  loader: {
    marginTop: 48,
  },
  exerciseList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  scrollContentFlex: {
    flexGrow: 1,
  },
  scrollWithDock: {
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  destructiveButton: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  destructiveButtonText: {
    color: homeTheme.colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  headerActionText: {
    fontWeight: '700',
    fontSize: 15,
  },
  headerActionPrimary: {
    color: homeTheme.colors.navYellow,
  },
  headerActionDanger: {
    color: homeTheme.colors.danger,
  },
  metaCard: {
    marginHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  metaTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  metaSubtitle: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.card,
    color: homeTheme.colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  nameSection: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
  },
  reorderHint: {
    marginHorizontal: homeTheme.spacing.screen,
    marginBottom: 10,
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  coachBanner: {
    marginHorizontal: homeTheme.spacing.screen,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    gap: 6,
  },
  coachBannerTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  coachBannerText: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  coachBannerWarnings: {
    color: homeTheme.colors.destructive,
    fontSize: 12,
    lineHeight: 17,
  },
  disabled: {
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: homeTheme.spacing.screen,
    gap: 16,
  },
  emptyStateTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export const WORKOUT_EDITOR_COPY = {
  addExercise: 'Add exercise',
  emptyExercises: 'Add exercises with the button below.',
  reorderHint: 'Hold the ≡ grip on each block to reorder exercises.',
  addExerciseFailed: 'Could not add exercise.',
  removeExerciseFailed: 'Could not remove exercise.',
} as const;
