export type WidgetSize = 'compact' | 'large';

export function getWidgetSizing(size: WidgetSize, minimal = false) {
  if (size === 'large') {
    return {
      valueFontSize: 32,
      unitFontSize: 16,
      subtextFontSize: 13,
      subtextLineHeight: 18,
      iconSize: 36,
      sparklineWidth: 96,
      sparklineHeight: 48,
      showSubtext: true,
      showSparkline: true,
      showIcon: true,
    };
  }

  if (minimal) {
    return {
      valueFontSize: 22,
      unitFontSize: 12,
      subtextFontSize: 11,
      subtextLineHeight: 14,
      iconSize: 0,
      sparklineWidth: 0,
      sparklineHeight: 0,
      showSubtext: false,
      showSparkline: false,
      showIcon: false,
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
    showSubtext: true,
    showSparkline: true,
    showIcon: true,
  };
}
