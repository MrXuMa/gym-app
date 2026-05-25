-- Coach-generated workout template drafts (user reviews in app before saving).

CREATE TABLE public.coach_template_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  advice_id uuid NOT NULL REFERENCES public.coach_advice_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  template_draft jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  accepted_at timestamptz
);

CREATE UNIQUE INDEX coach_template_proposals_advice_id_idx
  ON public.coach_template_proposals (advice_id);

CREATE INDEX coach_template_proposals_user_created_idx
  ON public.coach_template_proposals (user_id, created_at DESC);

CREATE INDEX coach_template_proposals_pending_idx
  ON public.coach_template_proposals (created_at)
  WHERE status = 'pending';

ALTER TABLE public.coach_template_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_template_proposals_select_own ON public.coach_template_proposals
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.coach_template_proposals IS
  'Async LLM workout template drafts from coach advice; worker writes draft JSON, user saves via workout_templates.';

CREATE OR REPLACE FUNCTION public.request_coach_template_from_advice(p_advice_id uuid)
RETURNS public.coach_template_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_advice public.coach_advice_requests;
  v_row public.coach_template_proposals;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_advice
  FROM public.coach_advice_requests
  WHERE id = p_advice_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'advice not found';
  END IF;

  IF v_advice.status <> 'completed' OR v_advice.response IS NULL THEN
    RAISE EXCEPTION 'advice must be completed before creating a template';
  END IF;

  DELETE FROM public.coach_template_proposals
  WHERE advice_id = p_advice_id AND user_id = v_user_id;

  INSERT INTO public.coach_template_proposals (user_id, advice_id, status)
  VALUES (v_user_id, p_advice_id, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_coach_template_from_advice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_coach_template_from_advice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_coach_template_proposal(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.coach_template_proposals
  SET accepted_at = now()
  WHERE id = p_proposal_id
    AND user_id = v_user_id
    AND status = 'completed'
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal not found or already accepted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_coach_template_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_coach_template_proposal(uuid) TO authenticated;
