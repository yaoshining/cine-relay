ALTER TABLE public.sync_job_runs ADD COLUMN cursor_generation uuid;
CREATE TABLE public.sync_incremental_pending (
  template_id uuid NOT NULL REFERENCES public.sync_job_templates (id),
  tmdb_id bigint NOT NULL CHECK (tmdb_id > 0),
  queued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, tmdb_id)
);
CREATE INDEX sync_incremental_pending_order_idx ON public.sync_incremental_pending (template_id,queued_at,tmdb_id);
