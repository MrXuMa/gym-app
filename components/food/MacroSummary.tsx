import { StyleSheet, Text, View } from 'react-native';
import { homeTheme } from '@/constants/theme';
import { MACRO_COLORS } from '@/components/food/nutritionTheme';
import type { FoodTotals } from '@/lib/foodAnalysis';

type MacroSummaryProps = {
  totals: FoodTotals;
  kcalLabel?: string;
  compact?: boolean;
  /** Hide the large calorie hero (e.g. when kcal is shown elsewhere). */
  showKcal?: boolean;
};

function formatMacroGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}g` : `${rounded.toFixed(1)}g`;
}

export function MacroSummary({
  totals,
  kcalLabel = 'calories',
  compact = false,
  showKcal = true,
}: MacroSummaryProps) {
  const totalMacroG = totals.protein_g + totals.carbs_g + totals.fat_g;
  const hasMacros = totalMacroG > 0;
  const macroDenominator = totalMacroG || 1;
  const a11ySummary = `Protein ${formatMacroGrams(totals.protein_g)}, Carbs ${formatMacroGrams(totals.carbs_g)}, Fat ${formatMacroGrams(totals.fat_g)}`;

  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLabel={a11ySummary}>
      {showKcal && (
        <View style={styles.kcalCard}>
          <Text style={[styles.kcalNumber, compact && styles.kcalNumberCompact]}>
            {Math.round(totals.kcal)}
          </Text>
          <Text style={styles.kcalLabel}>{kcalLabel}</Text>
        </View>
      )}

      <View style={[styles.macroBarContainer, !hasMacros && styles.macroBarEmpty]}>
        {hasMacros ? (
          <>
            {totals.protein_g > 0 && (
              <View
                style={[
                  styles.macroBarSegment,
                  { flex: totals.protein_g / macroDenominator, backgroundColor: MACRO_COLORS.protein },
                ]}
              />
            )}
            {totals.carbs_g > 0 && (
              <View
                style={[
                  styles.macroBarSegment,
                  { flex: totals.carbs_g / macroDenominator, backgroundColor: MACRO_COLORS.carbs },
                ]}
              />
            )}
            {totals.fat_g > 0 && (
              <View
                style={[
                  styles.macroBarSegment,
                  { flex: totals.fat_g / macroDenominator, backgroundColor: MACRO_COLORS.fat },
                ]}
              />
            )}
          </>
        ) : null}
      </View>

      <View style={styles.macroPillRow}>
        <MacroPill label="Protein" value={formatMacroGrams(totals.protein_g)} color={MACRO_COLORS.protein} />
        <MacroPill label="Carbs" value={formatMacroGrams(totals.carbs_g)} color={MACRO_COLORS.carbs} />
        <MacroPill label="Fat" value={formatMacroGrams(totals.fat_g)} color={MACRO_COLORS.fat} />
      </View>
    </View>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', alignSelf: 'stretch' },
  kcalCard: { alignItems: 'center', marginBottom: 12 },
  kcalNumber: {
    color: homeTheme.colors.textPrimary,
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 60,
  },
  kcalNumberCompact: { fontSize: 44, lineHeight: 48 },
  kcalLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  macroBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
    gap: 2,
    width: '100%',
  },
  macroBarEmpty: {
    backgroundColor: homeTheme.colors.muted,
  },
  macroBarSegment: { borderRadius: 5, minWidth: 4 },
  macroPillRow: { flexDirection: 'row', gap: 10, width: '100%' },
  pill: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: homeTheme.colors.muted,
    gap: 4,
  },
  pillValue: { fontSize: 17, fontWeight: '800' },
  pillLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
