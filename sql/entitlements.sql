-- Entitlement storage rollout. Run against each database only after reviewing the target.
ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS entitlements jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public."user"
SET entitlements = '[]'::jsonb
WHERE entitlements IS NULL;

ALTER TABLE public."user"
  ALTER COLUMN entitlements SET DEFAULT '[]'::jsonb,
  ALTER COLUMN entitlements SET NOT NULL;

CREATE INDEX IF NOT EXISTS user_entitlements_gin_idx
  ON public."user" USING GIN (entitlements jsonb_path_ops);
