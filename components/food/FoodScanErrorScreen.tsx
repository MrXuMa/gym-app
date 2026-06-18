import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import { FOOD_SCAN_DAILY_LIMIT, type FoodAnalysisErrorCode } from '@/lib/foodAnalysis';

type FoodScanErrorScreenProps = {
  code: FoodAnalysisErrorCode;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
};

function errorMeta(code: FoodAnalysisErrorCode): {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  canRetry: boolean;
} {
  switch (code) {
    case 'limit_reached':
      return {
        icon: 'ban-outline',
        title: 'Limit reached',
        canRetry: false,
      };
    case 'parse_failed':
      return {
        icon: 'scan-outline',
        title: 'Could not read photo',
        canRetry: true,
      };
    case 'timeout':
      return {
        icon: 'time-outline',
        title: 'Analysis timed out',
        canRetry: true,
      };
    case 'in_progress':
      return {
        icon: 'hourglass-outline',
        title: 'Scan in progress',
        canRetry: true,
      };
    default:
      return {
        icon: 'alert-circle-outline',
        title: 'Analysis failed',
        canRetry: true,
      };
  }
}

export function FoodScanErrorScreen({ code, message, onRetry, onDismiss }: FoodScanErrorScreenProps) {
  const meta = errorMeta(code);
  const isLimit = code === 'limit_reached';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={meta.icon} size={56} color={homeTheme.colors.destructive} />
      </View>

      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.message}>{message}</Text>

      {isLimit && (
        <Text style={styles.hint}>
          Daily maximum: {FOOD_SCAN_DAILY_LIMIT} scans. Resets at midnight Eastern time.
        </Text>
      )}

      <View style={styles.actions}>
        {meta.canRetry ? (
          <Pressable style={styles.primaryBtn} onPress={onRetry}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={onDismiss}>
            <Text style={styles.primaryBtnText}>Got it</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
          <Text style={styles.secondaryBtnText}>Back to scanner</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    width: '100%',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: homeTheme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: homeTheme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  hint: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 300,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
    marginTop: 28,
  },
  primaryBtn: {
    backgroundColor: homeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: homeTheme.colors.primaryForeground,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: homeTheme.colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: homeTheme.colors.secondaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
});
