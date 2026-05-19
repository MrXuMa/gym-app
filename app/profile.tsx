import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/layout/AppScreen';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';

export default function ProfileScreen() {
  const { profile, displayName, loading } = useProfile();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign out failed', error.message);
  }

  return (
    <AppScreen title="Profile" showProfile={false}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>@{profile?.username ?? '—'}</Text>

          <View style={styles.card}>
            <Row label="Email" value={profile?.email ?? '—'} />
            <Row label="Age" value={profile?.age != null ? String(profile.age) : '—'} />
            <Row label="Weight" value={profile?.weight != null ? `${profile.weight} lb` : '—'} />
            <Row label="Height" value={profile?.height != null ? `${profile.height} in` : '—'} />
          </View>

          <Pressable style={styles.signOut} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      )}
    </AppScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  body: { flex: 1, paddingHorizontal: homeTheme.spacing.screen, paddingTop: 8 },
  name: { color: homeTheme.colors.textPrimary, fontSize: 26, fontWeight: '700' },
  username: { color: homeTheme.colors.textMuted, fontSize: 15, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: homeTheme.colors.surface,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: homeTheme.colors.textMuted, fontSize: 14 },
  rowValue: { color: homeTheme.colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  signOut: {
    borderWidth: 1,
    borderColor: homeTheme.colors.danger,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: homeTheme.colors.danger, fontSize: 15, fontWeight: '700' },
});
