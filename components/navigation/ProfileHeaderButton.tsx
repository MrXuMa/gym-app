import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';

export function ProfileHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Ionicons name="person-circle-outline" size={28} color={homeTheme.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
