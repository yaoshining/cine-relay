CREATE TABLE public.tmdb_credentials (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  encrypted_token text NOT NULL CHECK (btrim(encrypted_token) <> ''),
  enabled boolean NOT NULL DEFAULT true,
  last_error text CHECK (last_error IN ('unauthorized','rate_limited','not_found','timeout','upstream_error','invalid_response','credential_unreadable')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
