-- Apply after 0002; legacy data and pending jobs are untouched.
ALTER TABLE public.sync_job_runs
    ADD COLUMN result_summary jsonb,
    ADD CONSTRAINT sync_job_runs_result_summary_check CHECK (jsonb_typeof(result_summary) = 'object');

CREATE INDEX sync_job_runs_recent_idx ON public.sync_job_runs (created_at DESC, id DESC);
