import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarkdownText } from '@/components/ui/MarkdownText';
import type { CoachAdviceRequest, CoachAdviceStatus } from '@/lib/coach';
import type { CoachTemplateProposalStatus } from '@/lib/coachTemplate';
import { homeTheme } from '@/constants/theme';

type CoachAdviceCardProps = {
  request: CoachAdviceRequest;
  templateProposalStatus?: CoachTemplateProposalStatus | null;
  templateBusy?: boolean;
  onCreateTemplate?: () => void;
  onReviewTemplate?: () => void;
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) {
    return 'Just now';
  }

  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return date.toLocaleDateString();
}

function pendingHint(request: CoachAdviceRequest): string {
  const ageMs = Date.now() - new Date(request.createdAt).getTime();
  const stale = ageMs > 2 * 60_000;

  if (request.status === 'running') {
    return stale
      ? 'Still generating — the first response can take a minute while the coach loads.'
      : 'Generating advice from your training context…';
  }

  if (stale) {
    return 'Queued for a while — pull to refresh. Advice is processed in the background.';
  }

  return 'Queued — waiting for the coach to pick this up.';
}

function statusMeta(status: CoachAdviceStatus): {
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

function templateStatusLabel(status: CoachTemplateProposalStatus): string {
  switch (status) {
    case 'pending':
      return 'Queued — building your template draft…';
    case 'running':
      return 'Generating template from this advice…';
    case 'completed':
      return 'Template draft is ready to review.';
    case 'failed':
      return 'Template generation failed. Try again.';
  }
}

export function CoachAdviceCard({
  request,
  templateProposalStatus,
  templateBusy = false,
  onCreateTemplate,
  onReviewTemplate,
}: CoachAdviceCardProps) {
  const meta = statusMeta(request.status);
  const isInProgress = request.status === 'pending' || request.status === 'running';
  const showTemplateActions = request.status === 'completed' && Boolean(onCreateTemplate);

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
          <Text style={styles.time}>{formatRelativeTime(request.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.question}>{request.question}</Text>

      {request.status === 'completed' && request.response ? (
        <MarkdownText style={styles.response}>{request.response}</MarkdownText>
      ) : null}

      {request.status === 'failed' && request.error ? (
        <Text style={styles.error}>{request.error}</Text>
      ) : null}

      {isInProgress ? (
        <Text style={styles.pendingHint}>{pendingHint(request)}</Text>
      ) : null}

      {showTemplateActions ? (
        <View style={styles.templateSection}>
          {templateProposalStatus === 'pending' || templateProposalStatus === 'running' ? (
            <View style={styles.templateGenerating}>
              <ActivityIndicator size="small" color={homeTheme.colors.primary} />
              <Text style={styles.templateHint}>{templateStatusLabel(templateProposalStatus)}</Text>
            </View>
          ) : templateProposalStatus === 'completed' && onReviewTemplate ? (
            <Button label="Review template draft" onPress={onReviewTemplate} fullWidth />
          ) : (
            <Button
              label={templateProposalStatus === 'failed' ? 'Retry template draft' : 'Create workout template'}
              variant="outline"
              onPress={onCreateTemplate}
              loading={templateBusy}
              fullWidth
            />
          )}

          {templateProposalStatus === 'failed' ? (
            <Text style={styles.templateHint}>{templateStatusLabel('failed')}</Text>
          ) : null}
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
  response: {
    color: homeTheme.colors.cardForeground,
    fontSize: 14,
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
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeTheme.colors.border,
  },
  templateGenerating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  templateHint: {
    flex: 1,
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
});
