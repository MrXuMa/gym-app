import { homeTheme } from '@/constants/theme';
import type { MealType } from '@/lib/foodAnalysis';

export const MACRO_COLORS = {
  protein: '#60a5fa',
  carbs: homeTheme.colors.primary,
  fat: homeTheme.colors.destructive,
} as const;

export const MEAL_ACCENT: Record<MealType, string> = {
  breakfast: '#fbbf24',
  lunch: homeTheme.colors.primary,
  dinner: '#a78bfa',
  snacks: '#34d399',
};

export const MEAL_ICONS: Record<MealType, 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' | 'cafe-outline'> = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snacks: 'cafe-outline',
};
