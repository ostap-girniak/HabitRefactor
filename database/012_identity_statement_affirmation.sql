-- ============================================
-- HabitRefactor - Identity Statement Upgrade
-- Makes legacy `migration.sql` identity schema compatible
-- with daily affirmations and JSON proof points.
-- Safe to run multiple times.
-- ============================================

ALTER TABLE IF EXISTS public.identity_statements
  ADD COLUMN IF NOT EXISTS daily_affirmation TEXT;

UPDATE public.identity_statements
SET daily_affirmation = 'I am ' || new_identity
WHERE daily_affirmation IS NULL OR btrim(daily_affirmation) = '';

ALTER TABLE IF EXISTS public.identity_statements
  ALTER COLUMN daily_affirmation SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'identity_statements'
      AND column_name = 'proof_points'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE public.identity_statements
      ALTER COLUMN proof_points DROP DEFAULT;

    ALTER TABLE public.identity_statements
      ALTER COLUMN proof_points TYPE JSONB
      USING CASE
        WHEN proof_points IS NULL THEN '[]'::jsonb
        ELSE to_jsonb(proof_points)
      END;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.identity_statements
  ALTER COLUMN proof_points SET DEFAULT '[]'::jsonb;

UPDATE public.identity_statements
SET proof_points = '[]'::jsonb
WHERE proof_points IS NULL;

-- Done.
