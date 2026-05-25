import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchExerciseCatalog, type ExerciseCatalogItem } from '@/lib/exercises';
import { homeTheme } from '@/constants/theme';

type PredictedMaxPickerProps = {
  visible: boolean;
  selectedExerciseId: string | null;
  onClose: () => void;
  onSelect: (exerciseId: string | null) => Promise<void> | void;
};

const ALL_MUSCLES = 'All';

export function PredictedMaxPicker({
  visible,
  selectedExerciseId,
  onClose,
  onSelect,
}: PredictedMaxPickerProps) {
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState(ALL_MUSCLES);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setMuscleFilter(ALL_MUSCLES);
      setSubmittingId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchExerciseCatalog()
      .then((rows) => {
        if (!cancelled) {
          setExercises(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExercises([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
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

  async function handleSelect(exerciseId: string | null) {
    setSubmittingId(exerciseId ?? '__default__');
    try {
      await onSelect(exerciseId);
      onClose();
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Predicted max exercise</Text>
            <Text style={styles.subtitle}>Pick which lift the widget tracks.</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.defaultRow, selectedExerciseId === null && styles.defaultRowActive]}
          onPress={() => void handleSelect(null)}
          disabled={submittingId !== null}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowName}>Auto (Bench Press)</Text>
            <Text style={styles.rowMuscle}>Default — picks any "Bench Press" lift in your catalog.</Text>
          </View>
          {submittingId === '__default__' ? (
            <ActivityIndicator size="small" color={homeTheme.colors.navYellow} />
          ) : selectedExerciseId === null ? (
            <Ionicons name="checkmark-circle" size={20} color={homeTheme.colors.navYellow} />
          ) : null}
        </Pressable>

        <View style={styles.searchSection}>
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

        {loading ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color={homeTheme.colors.textPrimary}
          />
        ) : (
          <FlatList
            style={styles.list}
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={<Text style={styles.empty}>No exercises match your search.</Text>}
            renderItem={({ item }) => {
              const isSelected = selectedExerciseId === item.id;
              const isSubmitting = submittingId === item.id;

              return (
                <Pressable
                  style={[styles.row, isSelected && styles.rowActive]}
                  onPress={() => void handleSelect(item.id)}
                  disabled={submittingId !== null}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    {item.targetMuscle ? (
                      <Text style={styles.rowMuscle}>{item.targetMuscle}</Text>
                    ) : null}
                  </View>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={homeTheme.colors.navYellow} />
                  ) : isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={homeTheme.colors.navYellow} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  close: {
    color: homeTheme.colors.navYellow,
    fontSize: 15,
    fontWeight: '600',
    paddingTop: 4,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  defaultRowActive: {
    borderColor: homeTheme.colors.navYellow,
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
  rowActive: {
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderBottomColor: 'transparent',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 6,
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
  loader: {
    marginTop: 32,
  },
  empty: {
    color: homeTheme.colors.textMuted,
    marginTop: 24,
    fontSize: 15,
  },
});
