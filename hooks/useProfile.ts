import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Profile = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number | null;
  weight: number | null;
  height: number | null;
  goals: string[];
  lifting_level: string | null;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from('profiles_with_age')
      .select('username, first_name, last_name, email, age, weight, height, goals, lifting_level')
      .eq('id', userResult.user.id)
      .maybeSingle();

    setProfile(
      data
        ? {
            ...data,
            goals: Array.isArray(data.goals) ? data.goals.filter(Boolean) : [],
          }
        : null,
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        void load();
      }
    }, [load, loading]),
  );

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username
    : 'Athlete';

  return { profile, displayName, loading, reload: load };
}
