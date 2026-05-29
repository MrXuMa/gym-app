import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
  clearCoachMemory,
  createCoachAdviceRequest,
  getCoachAdviceRequest,
  getLatestCoachAdviceRequest,
  isCoachAdviceTerminal,
  isCoachConfigured,
  recordCoachAdviceInContext,
  type CoachAdviceRequest,
} from '@/lib/coach';

const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_FAILURES = 3;

export type UseCoachResult = {
  request: CoachAdviceRequest | null;
  loading: boolean;
  refreshing: boolean;
  submitting: boolean;
  clearingMemory: boolean;
  isConfigured: boolean;
  connectionError: string | null;
  refresh: () => Promise<void>;
  requestAdvice: (question: string, wantsTemplate?: boolean) => Promise<CoachAdviceRequest | null>;
  clearMemory: () => Promise<void>;
};

export function useCoach(): UseCoachResult {
  const isConfigured = isCoachConfigured();
  const [request, setRequest] = useState<CoachAdviceRequest | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailuresRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const fetchLatest = useCallback(async () => {
    if (!isConfigured) {
      setRequest(null);
      setConnectionError(null);
      return;
    }

    const data = await getLatestCoachAdviceRequest();
    setRequest(data);
    setConnectionError(null);
    pollFailuresRef.current = 0;

    if (data?.status === 'completed' && !data.contextRecorded) {
      await recordCoachAdviceInContext(data.id);
      setRequest({ ...data, contextRecorded: true });
    }
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
          setConnectionError('Could not load coach advice.');
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

  const requestAdvice = useCallback(
    async (question: string, wantsTemplate = false): Promise<CoachAdviceRequest | null> => {
      setSubmitting(true);

      try {
        const created = await createCoachAdviceRequest({ question, wantsTemplate });
        setRequest(created);
        setConnectionError(null);
        pollFailuresRef.current = 0;
        return created;
      } catch (error) {
        if (error instanceof CoachServiceUnavailableError) {
          setConnectionError(error.message);
        } else if (error instanceof CoachUnauthorizedError) {
          setConnectionError(error.message);
        }
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const clearMemory = useCallback(async () => {
    setClearingMemory(true);

    try {
      await clearCoachMemory();
      setConnectionError(null);
    } catch (error) {
      if (error instanceof CoachServiceUnavailableError) {
        setConnectionError(error.message);
      } else if (error instanceof CoachUnauthorizedError) {
        setConnectionError(error.message);
      }
      throw error;
    } finally {
      setClearingMemory(false);
    }
  }, []);

  const shouldPoll =
    isConfigured &&
    request !== null &&
    !isCoachAdviceTerminal(request.status) &&
    !connectionError;

  useEffect(() => {
    if (!shouldPoll || !request) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const requestId = request.id;

    async function poll() {
      try {
        const updated = await getCoachAdviceRequest(requestId);
        setRequest(updated);
        pollFailuresRef.current = 0;

        if (updated.status === 'completed' && !updated.contextRecorded) {
          await recordCoachAdviceInContext(updated.id);
          setRequest((current) =>
            current?.id === updated.id ? { ...updated, contextRecorded: true } : current,
          );
        }
      } catch {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          setConnectionError(
            'Could not refresh advice status. Check your connection and pull to refresh.',
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
  }, [shouldPoll, request?.id, request?.status, connectionError]);

  return {
    request,
    loading,
    refreshing,
    submitting,
    clearingMemory,
    isConfigured,
    connectionError,
    refresh,
    requestAdvice,
    clearMemory,
  };
}
