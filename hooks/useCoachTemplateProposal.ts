import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
} from '@/lib/coach';
import {
  getCoachTemplateProposal,
  getCoachTemplateProposalForAdvice,
  isCoachTemplateProposalTerminal,
  requestCoachTemplateFromAdvice,
  type CoachTemplateProposal,
} from '@/lib/coachTemplate';

const POLL_INTERVAL_MS = 4_000;

export type UseCoachTemplateProposalResult = {
  proposal: CoachTemplateProposal | null;
  generating: boolean;
  error: string | null;
  requestTemplate: (adviceId: string) => Promise<CoachTemplateProposal | null>;
  refreshForAdvice: (adviceId: string) => Promise<void>;
  clearError: () => void;
};

export function useCoachTemplateProposal(): UseCoachTemplateProposalResult {
  const [proposal, setProposal] = useState<CoachTemplateProposal | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshForAdvice = useCallback(async (adviceId: string) => {
    try {
      const latest = await getCoachTemplateProposalForAdvice(adviceId);
      setProposal(latest);
      setError(null);
    } catch (err) {
      if (err instanceof CoachServiceUnavailableError || err instanceof CoachUnauthorizedError) {
        setError(err.message);
      } else {
        setError('Could not load template status.');
      }
    }
  }, []);

  const requestTemplate = useCallback(async (adviceId: string) => {
    setGenerating(true);
    setError(null);

    try {
      const created = await requestCoachTemplateFromAdvice(adviceId);
      setProposal(created);
      return created;
    } catch (err) {
      if (err instanceof CoachServiceUnavailableError || err instanceof CoachUnauthorizedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Could not request template.');
      }
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const shouldPoll =
    proposal !== null && !isCoachTemplateProposalTerminal(proposal.status) && !error;

  useEffect(() => {
    if (!shouldPoll || !proposal) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const proposalId = proposal.id;

    async function poll() {
      try {
        const updated = await getCoachTemplateProposal(proposalId);
        setProposal(updated);
      } catch {
        setError('Could not refresh template status. Pull to refresh and try again.');
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
  }, [shouldPoll, proposal?.id, proposal?.status, error]);

  return {
    proposal,
    generating,
    error,
    requestTemplate,
    refreshForAdvice,
    clearError,
  };
}
