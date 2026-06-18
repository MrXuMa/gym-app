import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { homeTheme } from '@/constants/theme';
import type { HomeMetrics } from '@/lib/homeMetrics';
import { type WidgetId } from '@/lib/widgetSettings';
import { getWidgetWidthSpan } from '@/components/home/widgetSizing';
import {
  getWidgetDefinition,
  type WidgetCallbacks,
  type WidgetDefinition,
  type WidgetRenderResult,
} from '@/components/home/widgetRegistry';

type WidgetGridProps = {
  metrics: HomeMetrics;
  enabledWidgetIds: WidgetId[];
  callbacks: WidgetCallbacks;
  movingWidgetId?: WidgetId | null;
  onLongPressWidget: (definition: WidgetDefinition, rendered: WidgetRenderResult) => void;
};

const HOME_COLUMNS = 2;

type LaidOutRow = {
  cells: { definition: WidgetDefinition; rendered: WidgetRenderResult }[];
  spanUsed: number;
};

/**
 * Greedy row builder: pack consecutive widgets into rows of `HOME_COLUMNS` columns,
 * starting a new row whenever the next widget would overflow. A full-row widget
 * (`medium` or `large`) always sits on its own row.
 */
function layoutWidgets(
  entries: { definition: WidgetDefinition; rendered: WidgetRenderResult }[],
): LaidOutRow[] {
  const rows: LaidOutRow[] = [];
  let current: LaidOutRow | null = null;

  for (const entry of entries) {
    const span = getWidgetWidthSpan(entry.definition.size);
    if (!current || current.spanUsed + span > HOME_COLUMNS) {
      current = { cells: [], spanUsed: 0 };
      rows.push(current);
    }
    current.cells.push(entry);
    current.spanUsed += span;
  }

  return rows;
}

export function WidgetGrid({
  metrics,
  enabledWidgetIds,
  callbacks,
  movingWidgetId = null,
  onLongPressWidget,
}: WidgetGridProps) {
  const isMoveMode = movingWidgetId !== null;
  const entries = enabledWidgetIds
    .map((id) => {
      const definition = getWidgetDefinition(id);
      if (!definition) {
        return null;
      }
      const rendered = definition.render({ metrics, callbacks });
      return { definition, rendered };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const rows = layoutWidgets(entries);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.cells.map(({ definition, rendered }) => (
            <Pressable
              key={`cell-${definition.id}`}
              style={({ pressed }) => [
                styles.cell,
                getWidgetWidthSpan(definition.size) === 2 ? styles.fullCell : styles.halfCell,
                movingWidgetId === definition.id && styles.cellMoving,
                isMoveMode && movingWidgetId !== definition.id && styles.cellDimmed,
                pressed && !isMoveMode && styles.cellPressed,
              ]}
              onPress={isMoveMode ? undefined : rendered.onPress}
              onLongPress={isMoveMode ? undefined : () => onLongPressWidget(definition, rendered)}
              delayLongPress={350}
              disabled={isMoveMode}
              accessibilityRole="button"
              accessibilityLabel={
                movingWidgetId === definition.id
                  ? `${definition.title} widget selected for moving`
                  : `${definition.title} widget. Long press to edit.`
              }
            >
              {rendered.element}
            </Pressable>
          ))}
          {row.spanUsed < HOME_COLUMNS ? (
            <Fragment>
              {Array.from({ length: HOME_COLUMNS - row.spanUsed }).map((_, idx) => (
                <View key={`spacer-${rowIndex}-${idx}`} style={[styles.cell, styles.halfCell, styles.cellSpacer]} />
              ))}
            </Fragment>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  cell: {
    alignSelf: 'stretch',
  },
  halfCell: {
    flex: 1,
  },
  fullCell: {
    flexBasis: '100%',
    flexGrow: 1,
  },
  cellPressed: {
    opacity: 0.85,
  },
  cellMoving: {
    borderWidth: 2,
    borderColor: homeTheme.colors.primary,
    borderRadius: homeTheme.radius.card,
  },
  cellDimmed: {
    opacity: 0.55,
  },
  cellSpacer: {
    opacity: 0,
  },
});
