import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
  createCoachTemplateJob,
  getCoachTemplateJob,
  getLatestCoachTemplateJob,
  isCoachConfigured,
  isCoachJobTerminal,
  type CoachTemplateJob,
} from '@/lib/coach';
import { getErrorMessage } from '@/lib/userFacingError';

const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_FAILURES = 3;

export type UseCoachResult = {
  job: CoachTemplateJob | null;
  loading: boolean;
  refreshing: boolean;
  submitting: boolean;
  isConfigured: boolean;
  connectionError: string | null;
  refresh: () => Promise<void>;
  requestWorkout: (prompt: string) => Promise<CoachTemplateJob | null>;
};

export function useCoach(): UseCoachResult {
  const isConfigured = isCoachConfigured();
  const [job, setJob] = useState<CoachTemplateJob | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailuresRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const fetchLatest = useCallback(async () => {
    if (!isConfigured) {
      setJob(null);
      setConnectionError(null);
      return;
    }

    const data = await getLatestCoachTemplateJob();
    setJob(data);
    setConnectionError(null);
    pollFailuresRef.current = 0;
  }, [isConfigured]);

  const load = useCallback(
    async (options: { pullToRefresh?: boolean } = {}) => {
      if (!isConfigured) {
        setLoading(false);
        return;
      }

      if (options.pullToRefresh) {
        setRefreshing(true);
      } else if (!hasLoadedRef.current) {
        setLoading(true);
      }

      try {
        await fetchLatest();
        hasLoadedRef.current = true;
      } catch (error) {
        if (error instanceof CoachServiceUnavailableError) {
          setConnectionError(error.message);
        } else if (error instanceof CoachUnauthorizedError) {
          setConnectionError(error.message);
        } else {
          setConnectionError(getErrorMessage(error, 'Could not load workout status.'));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchLatest, isConfigured],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load({ pullToRefresh: true });
  }, [load]);

  const requestWorkout = useCallback(async (prompt: string): Promise<CoachTemplateJob | null> => {
    setSubmitting(true);

    try {
      const created = await createCoachTemplateJob(prompt);
      setJob(created);
      setConnectionError(null);
      pollFailuresRef.current = 0;
      return created;
    } catch (error) {
      if (error instanceof CoachServiceUnavailableError) {
        setConnectionError(error.message);
      } else if (error instanceof CoachUnauthorizedError) {
        setConnectionError(error.message);
      } else {
        setConnectionError(getErrorMessage(error, 'Could not request workout.'));
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const shouldPoll =
    isConfigured && job !== null && !isCoachJobTerminal(job.status) && !connectionError;

  useEffect(() => {
    if (!shouldPoll || !job) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const jobId = job.id;

    async function poll() {
      try {
        const updated = await getCoachTemplateJob(jobId);
        setJob(updated);
        pollFailuresRef.current = 0;
      } catch {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          setConnectionError(
            'Could not refresh workout status. Check your connection and pull to refresh.',
          );
        }
      }
    }

    void poll();
    pollTimerRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPoll, job?.id, job?.status, connectionError]);

  return {
    job,
    loading,
    refreshing,
    submitting,
    isConfigured,
    connectionError,
    refresh,
    requestWorkout,
  };
}
