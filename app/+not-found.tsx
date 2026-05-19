import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { HOME_PATH } from '@/lib/navigation';
import { homeTheme } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Link href={HOME_PATH} style={styles.link}>
        <Text style={styles.linkText}>Go to Home</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeTheme.colors.background,
    padding: 24,
  },
  title: { color: homeTheme.colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
  },
  linkText: { color: homeTheme.colors.tabBar, fontWeight: '800' },
});
