import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { homeTheme } from '@/constants/theme';

export default function TasksScreen() {
  return (
    <AppScreen title="Tasks">
      <View style={styles.body}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.bodyText}>
          Workout tasks and reminders will live here. This feature is not available yet.
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
