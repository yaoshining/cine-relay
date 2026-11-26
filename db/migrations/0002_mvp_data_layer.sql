-- Apply once, in a single transaction after 0001_initial.sql.
ALTER TABLE public.movies
    ADD COLUMN original_language text,
    ADD COLUMN runtime_minutes integer,
    ADD CONSTRAINT movies_original_language_check CHECK (original_language ~ '^[a-z]{2}$'),
    ADD CONSTRAINT movies_runtime_minutes_check CHECK (runtime_minutes > 0);

CREATE TABLE public.sync_job_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> ''),
    mode text NOT NULL CHECK (mode IN ('backfill', 'incremental')),
    config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sync_job_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.sync_job_templates (id),
    trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'sample', 'scheduled')),
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'dispatch_failed', 'running', 'completed', 'partial_failed', 'failed')),
    config_snapshot jsonb NOT NULL CHECK (jsonb_typeof(config_snapshot) = 'object'),
    scheduled_at timestamptz,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_job_runs_template_check CHECK (trigger_type = 'sample' OR template_id IS NOT NULL),
    CONSTRAINT sync_job_runs_schedule_check CHECK ((trigger_type = 'scheduled') = (scheduled_at IS NOT NULL)),
    CONSTRAINT sync_job_runs_template_schedule_key UNIQUE (template_id, scheduled_at)
);

CREATE TABLE public.admin_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_github_id text NOT NULL CHECK (actor_github_id ~ '^[1-9][0-9]*$'),
    action text NOT NULL CHECK (btrim(action) <> ''),
    target_type text NOT NULL CHECK (btrim(target_type) <> ''),
    target_id text,
    outcome text NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'denied')),
    created_at timestamptz NOT NULL DEFAULT now()
);
