export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetSizing = {
  /** Grid columns: small = half-row; medium and large = full-row. */
  widthSpan: 1 | 2;
  cardPaddingHorizontal: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardMinHeight: number;
  bodyMinHeight: number;
  bodyGap: number;
  titleFontSize: number;
  titleMarginBottom: number;
  valueFontSize: number;
  unitFontSize: number;
  secondaryFontSize: number;
  secondaryLineHeight: number;
  detailFontSize: number;
  detailLineHeight: number;
  subtextFontSize: number;
  subtextLineHeight: number;
  /** Max height for scrollable large-widget bodies (e.g. task lists). */
  bodyMaxHeight: number;
  sparklineWidth: number;
  sparklineHeight: number;
  showSubtext: boolean;
  iconSize: number;
};

/** Half-row tile — the only size implemented on home widgets today. */
const SMALL_SIZING: WidgetSizing = {
  widthSpan: 1,
  cardPaddingHorizontal: 10,
  cardPaddingTop: 9,
  cardPaddingBottom: 10,
  cardMinHeight: 81,
  bodyMinHeight: 46,
  bodyGap: 2,
  titleFontSize: 10,
  titleMarginBottom: 6,
  valueFontSize: 22,
  unitFontSize: 12,
  secondaryFontSize: 11,
  secondaryLineHeight: 14,
  detailFontSize: 12,
  detailLineHeight: 14,
  subtextFontSize: 11,
  subtextLineHeight: 14,
  bodyMaxHeight: 0,
  sparklineWidth: 68,
  sparklineHeight: 34,
  showSubtext: false,
  iconSize: 0,
};

/** Full-row tile, same height as small. Reserved for future widgets. */
const MEDIUM_SIZING: WidgetSizing = {
  ...SMALL_SIZING,
  widthSpan: 2,
  showSubtext: true,
};

/** Full-row tile, taller body for charts and richer content. Reserved for future widgets. */
const LARGE_SIZING: WidgetSizing = {
  ...MEDIUM_SIZING,
  cardMinHeight: 148,
  bodyMinHeight: 112,
  bodyMaxHeight: 220,
  cardPaddingHorizontal: 18,
  cardPaddingTop: 14,
  cardPaddingBottom: 18,
  titleMarginBottom: 12,
  valueFontSize: 32,
  unitFontSize: 16,
  subtextFontSize: 13,
  subtextLineHeight: 18,
  sparklineWidth: 96,
  sparklineHeight: 48,
  iconSize: 36,
};

const SIZING_BY_WIDGET_SIZE: Record<WidgetSize, WidgetSizing> = {
  small: SMALL_SIZING,
  medium: MEDIUM_SIZING,
  large: LARGE_SIZING,
};

export function getWidgetSizing(size: WidgetSize = 'small'): WidgetSizing {
  return SIZING_BY_WIDGET_SIZE[size];
}

export function getWidgetWidthSpan(size: WidgetSize): 1 | 2 {
  return getWidgetSizing(size).widthSpan;
}
