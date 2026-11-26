-- Run this migration in a single transaction against the dedicated cine_relay database.
CREATE TABLE public.movies (
    tmdb_id bigint PRIMARY KEY CHECK (tmdb_id > 0),
    original_title text,
    release_date date,
    genre_ids integer[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz
);

CREATE TABLE public.movie_localizations (
    tmdb_id bigint NOT NULL REFERENCES public.movies (tmdb_id) ON DELETE CASCADE,
    locale text NOT NULL CHECK (locale IN ('zh-CN', 'en-US')),
    title text NOT NULL,
    overview text,
    poster_path text,
    fetched_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    purge_after timestamptz NOT NULL,
    PRIMARY KEY (tmdb_id, locale),
    CHECK (fetched_at < expires_at AND expires_at <= purge_after)
);

CREATE INDEX movie_localizations_purge_after_idx
    ON public.movie_localizations (purge_after);

CREATE TABLE public.sync_cursors (
    stream text PRIMARY KEY,
    cursor_state jsonb NOT NULL CHECK (jsonb_typeof(cursor_state) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- No movie FK: initial and incremental syncs must be able to queue unseen IDs.
CREATE TABLE public.movie_sync_jobs (
    tmdb_id bigint NOT NULL CHECK (tmdb_id > 0),
    locale text NOT NULL CHECK (locale IN ('zh-CN', 'en-US')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    lease_token uuid,
    leased_until timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tmdb_id, locale),
    CHECK ((status = 'leased' AND lease_token IS NOT NULL AND leased_until IS NOT NULL)
        OR (status IN ('pending', 'failed') AND lease_token IS NULL AND leased_until IS NULL))
);

CREATE INDEX movie_sync_jobs_pending_idx
    ON public.movie_sync_jobs (next_attempt_at, tmdb_id, locale) WHERE status = 'pending';

CREATE INDEX movie_sync_jobs_lease_idx
    ON public.movie_sync_jobs (leased_until) WHERE status = 'leased';
