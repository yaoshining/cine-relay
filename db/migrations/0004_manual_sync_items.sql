-- Apply after 0003, in a single transaction. No legacy queue or cursor is changed.
ALTER TABLE public.sync_job_runs
    ADD COLUMN retry_of uuid REFERENCES public.sync_job_runs (id),
    ADD CONSTRAINT sync_job_runs_retry_of_key UNIQUE (retry_of),
    ADD CONSTRAINT sync_job_runs_retry_of_check CHECK (
        retry_of IS NULL OR (retry_of <> id AND trigger_type = 'manual')
    );

CREATE TABLE public.sync_run_items (
    run_id uuid NOT NULL REFERENCES public.sync_job_runs (id),
    tmdb_id bigint NOT NULL CHECK (tmdb_id > 0),
    position integer NOT NULL CHECK (position >= 1),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'fetched', 'stored', 'unchanged', 'removed', 'failed', 'deferred')),
    fetched_at timestamptz,
    error_code text,
    PRIMARY KEY (run_id, tmdb_id),
    UNIQUE (run_id, position),
    CHECK ((fetched_at IS NOT NULL) = (status IN ('fetched', 'stored', 'unchanged', 'removed'))),
    CHECK ((error_code IS NOT NULL) = (status IN ('failed', 'deferred')))
);
