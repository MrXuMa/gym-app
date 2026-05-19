import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/navigation/AppHeader';
import { ProfileHeaderButton } from '@/components/navigation/ProfileHeaderButton';
import { homeTheme } from '@/constants/theme';

type AppScreenProps = {
  children: ReactNode;
  title?: string;
  showProfile?: boolean;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  edges?: ('top' | 'bottom')[];
};

export function AppScreen({
  children,
  title,
  showProfile = true,
  headerLeft,
  headerRight,
  edges = ['top'],
}: AppScreenProps) {
  const rightSlot =
    headerRight ?? (showProfile ? <ProfileHeaderButton /> : <View style={styles.headerSpacer} />);

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <StatusBar style="light" />
      <AppHeader title={title} leftSlot={headerLeft} rightSlot={rightSlot} />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
  },
  content: {
    flex: 1,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
});
