import { useEffect, type RefObject } from 'react';
import type { FlatList, ScrollView } from 'react-native';

type ScrollableList = ScrollView | FlatList<unknown>;

export function useScrollToDockedCard(
  scrollRef: RefObject<ScrollableList | null>,
  cardOffsetsRef: RefObject<Record<string, number>>,
  dockedExerciseId: string | null,
  exerciseIds?: string[],
) {
  useEffect(() => {
    if (!dockedExerciseId || !scrollRef.current) {
      return;
    }

    const list = scrollRef.current;

    if (exerciseIds?.length && 'scrollToIndex' in list) {
      const index = exerciseIds.indexOf(dockedExerciseId);
      if (index >= 0) {
        list.scrollToIndex({ index, viewOffset: 12, animated: true });
        return;
      }
    }

    const offset = cardOffsetsRef.current[dockedExerciseId];
    if (offset === undefined) {
      return;
    }

    const y = Math.max(0, offset - 12);

    if ('scrollToOffset' in list) {
      list.scrollToOffset({ offset: y, animated: true });
      return;
    }

    list.scrollTo({ y, animated: true });
  }, [cardOffsetsRef, dockedExerciseId, exerciseIds, scrollRef]);
}
