import { useEffect, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

export function useScrollToDockedCard(
  scrollRef: RefObject<ScrollView | null>,
  cardOffsetsRef: RefObject<Record<string, number>>,
  dockedExerciseId: string | null,
) {
  useEffect(() => {
    if (!dockedExerciseId || !scrollRef.current) {
      return;
    }

    const offset = cardOffsetsRef.current[dockedExerciseId];
    if (offset === undefined) {
      return;
    }

    scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated: true });
  }, [cardOffsetsRef, dockedExerciseId, scrollRef]);
}
