import { supabase } from '@/lib/supabase';
import { throwIfSupabaseError } from '@/lib/supabaseError';

export const LIFTING_LEVELS = ['new', 'beginner', 'intermediate', 'advanced', 'veteran'] as const;

export type LiftingLevel = (typeof LIFTING_LEVELS)[number];

export type LiftingLevelOption = {
  value: LiftingLevel;
  label: string;
  years: string;
  description: string;
};

export const LIFTING_LEVEL_OPTIONS: LiftingLevelOption[] = [
  {
    value: 'new',
    label: 'New',
    years: '0 years',
    description: 'Just starting out — simple movements and moderate reps.',
  },
  {
    value: 'beginner',
    label: 'Beginner',
    years: '1–2 years',
    description: 'Building a foundation with compounds and basic accessories.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    years: '3–4 years',
    description: 'Solid technique — more volume and targeted accessories.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    years: '5–6 years',
    description: 'Experienced lifter — heavier work and specialized exercises.',
  },
  {
    value: 'veteran',
    label: 'Veteran',
    years: '7+ years',
    description: 'Long training history — advanced programming and variety.',
  },
];

export function isLiftingLevel(value: string | null | undefined): value is LiftingLevel {
  return LIFTING_LEVELS.includes(value as LiftingLevel);
}

export function formatLiftingLevelLabel(level: LiftingLevel | null | undefined): string {
  if (!level) return 'Not set';
  const option = LIFTING_LEVEL_OPTIONS.find((row) => row.value === level);
  if (!option) return level;
  return `${option.label} (${option.years})`;
}

export async function fetchProfileLiftingLevel(): Promise<LiftingLevel | null> {
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) return null;

  const { data, error } = await supabase
    .from('profiles_with_age')
    .select('lifting_level')
    .eq('id', userResult.user.id)
    .maybeSingle();

  if (error) throwIfSupabaseError(error, 'Could not load lifting level.');
}

export async function saveProfileLiftingLevel(level: LiftingLevel): Promise<LiftingLevel> {
  const { data, error } = await supabase.rpc('update_profile_lifting_level', {
    p_level: level,
  });

  if (error) throwIfSupabaseError(error, 'Could not save lifting level.');
}
