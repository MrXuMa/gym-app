import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { supabase } from '@/lib/supabase';
import { homeTheme } from '@/constants/theme';

type Exercise = {
  id: string;
  name: string;
};

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('id, name').order('name');

      if (error) {
        Alert.alert('Could not load exercises', error.message);
      } else {
        setExercises(data ?? []);
      }

      setLoading(false);
    }

    fetchExercises();
  }, []);

  return (
    <AppScreen title="Exercises">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No exercises found.</Text>}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
  list: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  item: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.surfaceBorder,
  },
  emptyText: {
    color: homeTheme.colors.textMuted,
    marginTop: 16,
    paddingHorizontal: homeTheme.spacing.screen,
  },
});
