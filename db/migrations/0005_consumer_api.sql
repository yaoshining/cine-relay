CREATE TABLE public.consumer_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE public.movie_refresh_leases (
  tmdb_id bigint NOT NULL CHECK (tmdb_id > 0),
  locale text NOT NULL CHECK (locale IN ('zh-CN','en-US')),
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tmdb_id, locale)
);
CREATE INDEX movie_refresh_leases_expiry_idx ON public.movie_refresh_leases(expires_at);

CREATE TABLE public.tmdb_request_gate (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  lease_token uuid,
  lease_until timestamptz,
  hour_start timestamptz NOT NULL DEFAULT date_trunc('hour', now(), 'UTC'),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  cooldown_until timestamptz,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
INSERT INTO public.tmdb_request_gate DEFAULT VALUES;
