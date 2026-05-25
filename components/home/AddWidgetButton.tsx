import { Alert, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';

export function AddWidgetButton() {
  function handlePress() {
    Alert.alert('Coming soon', 'Custom widgets will be available in a future update.');
  }

  return (
    <Pressable
      style={styles.button}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Add widget"
    >
      <Ionicons name="add" size={26} color={homeTheme.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: homeTheme.radius.button,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
