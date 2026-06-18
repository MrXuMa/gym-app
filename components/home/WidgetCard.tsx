import { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { Card } from '@/components/ui/card';
import { homeTheme } from '@/constants/theme';

type WidgetCardProps = {
  title: string;
  size?: WidgetSize;
  children: ReactNode;
};

export function WidgetCard({ title, size = 'small', children }: WidgetCardProps) {
  const sizing = getWidgetSizing(size);

  return (
    <Card
      style={[
        styles.card,
        {
          paddingHorizontal: sizing.cardPaddingHorizontal,
          paddingTop: sizing.cardPaddingTop,
          paddingBottom: sizing.cardPaddingBottom,
          minHeight: sizing.cardMinHeight,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          {
            fontSize: sizing.titleFontSize,
            marginBottom: sizing.titleMarginBottom,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View
        style={[
          styles.body,
          {
            minHeight: sizing.bodyMinHeight,
            gap: sizing.bodyGap,
          },
        ]}
      >
        {children}
      </View>
    </Card>
  );
}

type WidgetBodyProps = {
  size?: WidgetSize;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Optional inner wrapper when a widget needs the standard body footprint explicitly. */
export function WidgetBody({ size = 'small', children, style }: WidgetBodyProps) {
  const sizing = getWidgetSizing(size);

  return (
    <View
      style={[
        styles.widgetBody,
        {
          minHeight: sizing.bodyMinHeight,
          gap: sizing.bodyGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  title: {
    color: homeTheme.colors.mutedForeground,
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'none',
  },
  body: {
    justifyContent: 'center',
  },
  widgetBody: {
    justifyContent: 'center',
  },
});
