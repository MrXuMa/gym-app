import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { fetchExerciseCatalog } from '@/lib/exercises';
import { homeTheme } from '@/constants/theme';
import { getErrorMessage } from '@/lib/userFacingError';
import { notify } from '@/lib/platformAlert';

const ALL_MUSCLES = 'All';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Awaited<ReturnType<typeof fetchExerciseCatalog>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState(ALL_MUSCLES);

  useEffect(() => {
    async function loadExercises() {
      try {
        const rows = await fetchExerciseCatalog();
        setExercises(rows);
      } catch (error) {
        const message = getErrorMessage(error, 'Could not load exercises.');
        notify('Could not load exercises', message);
      } finally {
        setLoading(false);
      }
    }

    void loadExercises();
  }, []);

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const exercise of exercises) {
      if (exercise.targetMuscle) {
        groups.add(exercise.targetMuscle);
      }
    }

    return [ALL_MUSCLES, ...[...groups].sort()];
  }, [exercises]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const matchesSearch = !query || exercise.name.toLowerCase().includes(query);
      const matchesMuscle =
        muscleFilter === ALL_MUSCLES || exercise.targetMuscle === muscleFilter;

      return matchesSearch && matchesMuscle;
    });
  }, [exercises, muscleFilter, search]);

  return (
    <AppScreen title="Exercises">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Text style={styles.count}>{exercises.length} exercises</Text>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises..."
              placeholderTextColor={homeTheme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              {muscleGroups.map((item) => {
                const active = muscleFilter === item;

                return (
                  <Pressable
                    key={item}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setMuscleFilter(item)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No exercises match your search.</Text>}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.item}>{item.name}</Text>
                {item.targetMuscle ? <Text style={styles.muscle}>{item.targetMuscle}</Text> : null}
              </View>
            )}
          />
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
  toolbar: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 8,
    gap: 10,
  },
  count: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  search: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: homeTheme.colors.textPrimary,
    backgroundColor: homeTheme.colors.card,
    fontSize: 16,
  },
  filterRow: {
    gap: 10,
    paddingRight: homeTheme.spacing.screen,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: homeTheme.colors.card,
  },
  filterChipActive: {
    backgroundColor: homeTheme.colors.navYellow,
    borderColor: homeTheme.colors.navYellow,
  },
  filterChipText: {
    color: homeTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: homeTheme.colors.tabBar,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
    gap: 2,
  },
  item: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  muscle: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
  },
  emptyText: {
    color: homeTheme.colors.textMuted,
    marginTop: 16,
  },
});
