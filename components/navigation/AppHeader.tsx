import { StyleSheet, Text, View } from 'react-native';
import { homeTheme } from '@/constants/theme';

type AppHeaderProps = {
  title?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function AppHeader({ title, leftSlot, rightSlot }: AppHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>{leftSlot ?? <View style={styles.sidePlaceholder} />}</View>

      {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.titleSpacer} />}

      <View style={styles.right}>{rightSlot ?? <View style={styles.sidePlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 48,
  },
  left: {
    minWidth: 72,
    alignItems: 'flex-start',
  },
  sidePlaceholder: {
    minWidth: 72,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: homeTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  titleSpacer: {
    flex: 1,
  },
  right: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
});
