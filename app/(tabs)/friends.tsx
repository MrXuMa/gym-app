import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { homeTheme } from '@/constants/theme';

export default function FriendsScreen() {
  return (
    <AppScreen title="Friends" showCrossWatermark>
      <View style={styles.body}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.bodyText}>
          Connect with training partners, share progress, and compare streaks. This tab is a placeholder for
          upcoming social features.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  bodyText: {
    color: homeTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
