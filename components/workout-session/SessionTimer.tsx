import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';

type SessionTimerProps = {
  title: string;
  startedAt: string;
};

export function SessionTimer({ title, startedAt }: SessionTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    function tick() {
      const started = new Date(startedAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <View style={styles.block}>
      <Text style={styles.workoutTitle} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Ionicons name="time-outline" size={16} color={homeTheme.colors.navYellow} />
          <Text style={styles.label}>Session time</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>
      <Text style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  workoutTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: homeTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: homeTheme.colors.navYellow,
  },
  liveText: {
    color: homeTheme.colors.navYellow,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timer: {
    color: homeTheme.colors.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
