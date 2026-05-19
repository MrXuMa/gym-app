export type WidgetSize = 'compact' | 'large';

export function getWidgetSizing(size: WidgetSize) {
  if (size === 'large') {
    return {
      valueFontSize: 32,
      unitFontSize: 16,
      subtextFontSize: 13,
      subtextLineHeight: 18,
      iconSize: 36,
      sparklineWidth: 96,
      sparklineHeight: 48,
    };
  }

  return {
    valueFontSize: 28,
    unitFontSize: 13,
    subtextFontSize: 11,
    subtextLineHeight: 15,
    iconSize: 28,
    sparklineWidth: 56,
    sparklineHeight: 36,
  };
}
