import { type ReactElement, type ReactNode, type RefObject } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { SessionExercise } from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';

export type DraggableExerciseListRef = DraggableFlatList<SessionExercise>;

export type ExerciseDragRenderProps = {
  exercise: SessionExercise;
  drag: () => void;
  isActive: boolean;
};

type DraggableExerciseListProps = {
  exercises: SessionExercise[];
  onReorder: (exercises: SessionExercise[]) => void;
  renderExercise: (props: ExerciseDragRenderProps) => ReactElement;
  scrollRef?: RefObject<DraggableExerciseListRef | null>;
  contentContainerStyle?: ViewStyle;
  ListFooterComponent?: ReactNode;
  emptyMessage?: string;
};

export function DraggableExerciseList({
  exercises,
  onReorder,
  renderExercise,
  scrollRef,
  contentContainerStyle,
  ListFooterComponent,
  emptyMessage = 'Add a workout to start logging sets.',
}: DraggableExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <View style={[styles.emptyWrap, contentContainerStyle]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        {ListFooterComponent}
      </View>
    );
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<SessionExercise>) {
    return (
      <ScaleDecorator activeScale={1.02}>
        <View style={[styles.itemWrap, isActive && styles.itemWrapActive]}>
          {renderExercise({ exercise: item, drag, isActive })}
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <DraggableFlatList
      ref={scrollRef}
      data={exercises}
      keyExtractor={(item) => item.id}
      onDragEnd={({ data }) => onReorder(data)}
      renderItem={renderItem}
      activationDistance={12}
      containerStyle={styles.list}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      ListFooterComponent={
        ListFooterComponent ? <View style={styles.footer}>{ListFooterComponent}</View> : undefined
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        scrollRef?.current?.scrollToOffset({
          offset: Math.max(0, averageItemLength * index),
          animated: true,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  itemWrap: {
    marginBottom: 0,
  },
  itemWrapActive: {
    opacity: 0.96,
  },
  footer: {
    marginTop: 4,
  },
  emptyWrap: {
    flexGrow: 1,
  },
  emptyText: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
});
