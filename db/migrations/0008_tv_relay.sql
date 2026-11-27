CREATE TABLE public.tv_request_windows (
  consumer_id uuid PRIMARY KEY REFERENCES public.consumer_keys(id),
  minute timestamptz NOT NULL,
  requests integer NOT NULL CHECK (requests BETWEEN 1 AND 120)
);
-- Separate namespace from movie IDs. One fenced refresh per normalized resource.
CREATE TABLE public.tv_cache (
  resource text PRIMARY KEY,
  payload jsonb,
  expires_at timestamptz,
  purge_after timestamptz NOT NULL,
  lease uuid,
  lease_until timestamptz,
  CHECK ((lease IS NULL) = (lease_until IS NULL)),
  CHECK ((payload IS NULL) = (expires_at IS NULL))
);
CREATE INDEX tv_cache_purge ON public.tv_cache(purge_after);
CREATE TABLE public.tv_search_operations (
  consumer_id uuid NOT NULL REFERENCES public.consumer_keys(id), search_id uuid NOT NULL,
  conditions jsonb NOT NULL, shown jsonb NOT NULL DEFAULT '{}', selected text,
  created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
  PRIMARY KEY(consumer_id,search_id), CHECK ((selected IS NULL) = (confirmed_at IS NULL))
);
CREATE INDEX tv_search_recent ON public.tv_search_operations(created_at);
CREATE INDEX tv_confirm_recent ON public.tv_search_operations(confirmed_at) WHERE selected IS NOT NULL;
