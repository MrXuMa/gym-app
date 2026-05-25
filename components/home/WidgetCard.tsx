import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WidgetSize } from '@/components/home/widgetSizing';
import { Card } from '@/components/ui/card';
import { homeTheme } from '@/constants/theme';

type WidgetCardProps = {
  title: string;
  size?: WidgetSize;
  minimal?: boolean;
  children: ReactNode;
};

export function WidgetCard({ title, size = 'compact', minimal = false, children }: WidgetCardProps) {
  const isLarge = size === 'large';

  return (
    <Card style={[styles.card, minimal && styles.cardMinimal, isLarge && styles.cardLarge]}>
      <Text style={[styles.title, minimal && styles.titleMinimal, isLarge && styles.titleLarge]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.body, minimal && styles.bodyMinimal]}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    paddingTop: 12,
  },
  cardMinimal: {
    padding: 10,
    paddingTop: 9,
    borderColor: 'rgba(64, 64, 64, 0.6)',
  },
  cardLarge: {
    padding: 18,
    paddingTop: 14,
    minHeight: 148,
  },
  title: {
    color: homeTheme.colors.mutedForeground,
    marginBottom: 10,
    ...homeTheme.typography.widgetTitle,
  },
  titleMinimal: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'none',
    marginBottom: 6,
  },
  titleLarge: {
    marginBottom: 12,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bodyMinimal: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: 2,
  },
});
