import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/card';
import { homeTheme } from '@/constants/theme';

type CoachSetupBannerProps = {
  isConfigured: boolean;
  connectionError?: string | null;
};

function isAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('unauthorized') ||
    lower.includes('invalid token') ||
    lower.includes('sign in')
  );
}

function getHint(connectionError: string): string {
  if (isAuthError(connectionError)) {
    return 'Sign in to the app, then pull to refresh on this tab.';
  }

  return 'Advice is processed in the background. Pending jobs may take a minute if the server is busy.';
}

export function CoachSetupBanner({ isConfigured, connectionError }: CoachSetupBannerProps) {
  if (connectionError) {
    const authError = isAuthError(connectionError);

    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons
            name={authError ? 'lock-closed-outline' : 'cloud-offline-outline'}
            size={22}
            color={homeTheme.colors.destructive}
          />
          <View style={styles.copy}>
            <Text style={styles.title}>
              {authError ? 'Sign in required' : 'Could not reach Coach'}
            </Text>
            <Text style={styles.body}>{connectionError}</Text>
            <Text style={styles.hint}>{getHint(connectionError)}</Text>
          </View>
        </View>
      </Card>
    );
  }

  if (isConfigured) {
    return null;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={22} color={homeTheme.colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.title}>Coach unavailable</Text>
          <Text style={styles.body}>
            Supabase is not configured in this build. Coach advice requires a connected backend.
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
