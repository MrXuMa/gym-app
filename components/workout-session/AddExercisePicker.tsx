import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { homeTheme } from '@/constants/theme';
import type { ExerciseCatalogItem } from '@/lib/exercises';

export type ExerciseOption = ExerciseCatalogItem;

type AddExercisePickerProps = {
  visible: boolean;
  exercises: ExerciseOption[];
  selectedExerciseIds: string[];
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
};

const ALL_MUSCLES = 'All';

export function AddExercisePicker({
  visible,
  exercises,
  selectedExerciseIds,
  onClose,
  onSelect,
}: AddExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState(ALL_MUSCLES);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setMuscleFilter(ALL_MUSCLES);
    }
  }, [visible]);

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

  function handleSelect(exerciseId: string) {
    onSelect(exerciseId);
    setSearch('');
    setMuscleFilter(ALL_MUSCLES);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add workout</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.searchSection}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search workouts..."
            placeholderTextColor={homeTheme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
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
                  <Text
                    style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<Text style={styles.empty}>No workouts match your search.</Text>}
          renderItem={({ item }) => {
            const alreadyAdded = selectedExerciseIds.includes(item.id);

            return (
              <Pressable
                style={[styles.row, alreadyAdded && styles.rowDisabled]}
                disabled={alreadyAdded}
                onPress={() => handleSelect(item.id)}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.targetMuscle ? <Text style={styles.rowMuscle}>{item.targetMuscle}</Text> : null}
                </View>
                {alreadyAdded ? <Text style={styles.added}>Added</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const FILTER_ROW_HEIGHT = 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  close: {
    color: homeTheme.colors.navYellow,
    fontSize: 15,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: homeTheme.spacing.screen,
    marginBottom: 8,
  },
  search: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: homeTheme.colors.textPrimary,
    backgroundColor: homeTheme.colors.card,
    fontSize: 16,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: FILTER_ROW_HEIGHT,
    maxHeight: FILTER_ROW_HEIGHT,
  },
  filterRow: {
    alignItems: 'center',
    gap: 10,
    paddingRight: homeTheme.spacing.screen,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: FILTER_ROW_HEIGHT,
    justifyContent: 'center',
    backgroundColor: homeTheme.colors.card,
  },
  filterChipActive: {
    backgroundColor: homeTheme.colors.navYellow,
    borderColor: homeTheme.colors.navYellow,
  },
  filterChipText: {
    color: homeTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: homeTheme.colors.tabBar,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowName: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  rowMuscle: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  added: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    color: homeTheme.colors.textMuted,
    marginTop: 24,
    fontSize: 15,
  },
});
