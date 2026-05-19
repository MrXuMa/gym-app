import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';

type WidgetCardProps = {
  title: string;
  size?: WidgetSize;
  children: ReactNode;
};

export function WidgetCard({ title, size = 'compact', children }: WidgetCardProps) {
  const isLarge = size === 'large';

  return (
    <View style={[styles.card, isLarge && styles.cardLarge]}>
      <View style={styles.entablature}>
        <View style={styles.frieze} />
        <View style={styles.architrave} />
      </View>
      <Text style={[styles.title, isLarge && styles.titleLarge]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: homeTheme.colors.surface,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    padding: 12,
    paddingTop: 10,
    overflow: 'hidden',
  },
  cardLarge: {
    padding: 18,
    paddingTop: 14,
    minHeight: 148,
  },
  entablature: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 2,
  },
  frieze: {
    height: 2,
    backgroundColor: homeTheme.colors.travertine,
    opacity: 0.35,
  },
  architrave: {
    height: 1,
    backgroundColor: homeTheme.colors.surfaceBorder,
  },
  title: {
    color: homeTheme.colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
    ...homeTheme.typography.widgetTitle,
  },
  titleLarge: {
    marginTop: 6,
    marginBottom: 12,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
