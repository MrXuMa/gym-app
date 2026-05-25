import { StyleSheet, View, type ViewProps } from 'react-native';
import { homeTheme } from '@/constants/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
});
