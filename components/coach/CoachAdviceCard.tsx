import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { CoachTemplateJob, CoachTemplateJobStatus } from '@/lib/coach';
import { sanitizeCoachJobError } from '@/lib/userFacingError';
import { homeTheme } from '@/constants/theme';

type CoachAdviceCardProps = {
  job: CoachTemplateJob;
  onReviewTemplate?: () => void;
  onRetry?: () => void;
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}

function pendingHint(job: CoachTemplateJob): string {
  const ageMs = Date.now() - new Date(job.createdAt).getTime();
  const stale = ageMs > 2 * 60_000;

  if (job.status === 'running') {
    return stale
      ? 'Still generating — the first template can take a minute while the model loads.'
      : 'Building your workout from split, goals, and logs…';
  }

  if (stale) {
    return 'Queued for a while — pull to refresh. Templates are processed in the background.';
  }

  return 'Queued — waiting for the coach to pick this up.';
}

function statusMeta(status: CoachTemplateJobStatus): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Queued', icon: 'time-outline', color: homeTheme.colors.mutedForeground };
    case 'running':
      return { label: 'Generating', icon: 'hourglass-outline', color: homeTheme.colors.primary };
    case 'completed':
      return { label: 'Ready', icon: 'checkmark-circle-outline', color: homeTheme.colors.travertine };
    case 'failed':
      return { label: 'Failed', icon: 'alert-circle-outline', color: homeTheme.colors.destructive };
  }
}

export function CoachAdviceCard({ job, onReviewTemplate, onRetry }: CoachAdviceCardProps) {
  const meta = statusMeta(job.status);
  const isInProgress = job.status === 'pending' || job.status === 'running';
  const promptLabel = job.prompt.trim() || "Today's split + goals";

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          {isInProgress ? (
            <ActivityIndicator size="small" color={homeTheme.colors.primary} />
          ) : (
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          )}
          <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.time}>{formatRelativeTime(job.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.question}>{promptLabel}</Text>

      {job.status === 'failed' && job.error ? (
        <Text style={styles.error}>{sanitizeCoachJobError(job.error)}</Text>
      ) : null}

      {isInProgress ? (
        <Text style={styles.pendingHint}>{pendingHint(job)}</Text>
      ) : null}

      {job.status === 'failed' && onRetry ? (
        <View style={styles.templateSection}>
          <Button label="Try again" onPress={onRetry} fullWidth />
        </View>
      ) : null}

      {job.status === 'completed' && onReviewTemplate ? (
        <View style={styles.templateSection}>
          <Button label="Review template draft" onPress={onReviewTemplate} fullWidth />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  time: {
    marginLeft: 'auto',
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
  },
  question: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  error: {
    color: homeTheme.colors.destructive,
    fontSize: 13,
    lineHeight: 19,
  },
  pendingHint: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  templateSection: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.colors.border,
  },
});
