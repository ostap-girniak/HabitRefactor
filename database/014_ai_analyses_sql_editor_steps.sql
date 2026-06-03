-- ============================================
-- HabitRefactor - AI Analyses SQL Editor Steps
-- Use this if Supabase SQL Editor times out while running 013.
--
-- IMPORTANT:
-- Run ONE block at a time, not the whole file at once.
-- ============================================


-- BLOCK 1: Check current shape.
-- If full_analysis is already text, skip BLOCK 4.
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_analyses'
  AND column_name IN (
    'type',
    'analysis_type',
    'full_analysis',
    'insights',
    'recommendations',
    'trigger_patterns',
    'tomorrow_action',
    'motivational_close',
    'confidence_score',
    'is_read',
    'is_bookmarked',
    'user_feedback'
  )
ORDER BY ordinal_position;


-- BLOCK 2: Add missing columns.
ALTER TABLE IF EXISTS public.ai_analyses
  ADD COLUMN IF NOT EXISTS analysis_type public.analysis_type,
  ADD COLUMN IF NOT EXISTS insights JSONB,
  ADD COLUMN IF NOT EXISTS recommendations JSONB,
  ADD COLUMN IF NOT EXISTS trigger_patterns JSONB,
  ADD COLUMN IF NOT EXISTS tomorrow_action TEXT,
  ADD COLUMN IF NOT EXISTS motivational_close TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_feedback TEXT;


-- BLOCK 3A: Copy legacy type values only when they exist in the enum.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_analyses'
      AND column_name = 'type'
  ) THEN
    UPDATE public.ai_analyses AS analyses
    SET analysis_type = analyses."type"::text::public.analysis_type
    WHERE analyses.analysis_type IS NULL
      AND analyses."type" IS NOT NULL
      AND analyses."type"::text IN (
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = 'public.analysis_type'::regtype
      );
  END IF;
END $$;


-- BLOCK 3B: Fill anything still empty with daily_review.
UPDATE public.ai_analyses
SET analysis_type = 'daily_review'::public.analysis_type
WHERE analysis_type IS NULL;


-- BLOCK 3C: Make analysis_type required.
ALTER TABLE IF EXISTS public.ai_analyses
  ALTER COLUMN analysis_type SET NOT NULL;


-- BLOCK 4: Run this ONLY if BLOCK 1 showed full_analysis data_type = jsonb.
ALTER TABLE public.ai_analyses
  ALTER COLUMN full_analysis DROP DEFAULT;

ALTER TABLE public.ai_analyses
  ALTER COLUMN full_analysis TYPE TEXT
  USING CASE
    WHEN full_analysis IS NULL THEN ''
    WHEN jsonb_typeof(full_analysis) = 'string' THEN full_analysis #>> '{}'
    ELSE full_analysis::text
  END;

ALTER TABLE public.ai_analyses
  ALTER COLUMN full_analysis SET DEFAULT '';


-- BLOCK 5: Add indexes last.
-- If this times out in SQL Editor, skip it temporarily. The app can work without
-- these indexes, but history/insights queries can be slower.
CREATE INDEX IF NOT EXISTS idx_analyses_user
  ON public.ai_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_type
  ON public.ai_analyses(user_id, analysis_type);

