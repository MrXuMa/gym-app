import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number | null;
  weight: number;
  height: number;
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
      .select('username, first_name, last_name, email, age, weight, height')
      .eq('id', userResult.user.id)
      .maybeSingle();

    setProfile(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username
    : 'Athlete';

  return { profile, displayName, loading, reload: load };
}
