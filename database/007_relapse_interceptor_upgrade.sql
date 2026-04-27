-- ============================================
-- HabitRefactor — Relapse Interceptor DB Upgrade
-- Makes legacy `migration.sql` schema compatible
-- with smart danger-zone push notifications.
-- Safe to run multiple times.
-- ============================================

-- 1) Ensure type exists
DO $$ BEGIN
  CREATE TYPE reminder_type AS ENUM (
    'morning_checkin', 'evening_review', 'motivation',
    'danger_zone', 'streak_celebration', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) push_subscriptions: add new columns while preserving legacy `keys` JSONB
ALTER TABLE IF EXISTS public.push_subscriptions
  ADD COLUMN IF NOT EXISTS p256dh_key TEXT,
  ADD COLUMN IF NOT EXISTS auth_key TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill from legacy JSONB: keys -> {p256dh, auth}
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'keys'
  ) THEN
    UPDATE public.push_subscriptions
    SET
      p256dh_key = COALESCE(p256dh_key, keys->>'p256dh'),
      auth_key = COALESCE(auth_key, keys->>'auth')
    WHERE (p256dh_key IS NULL OR auth_key IS NULL)
      AND keys IS NOT NULL;
  END IF;
END $$;

-- 3) reminders: add smart reminder columns + map legacy columns (time/days/is_active)
ALTER TABLE IF EXISTS public.reminders
  ADD COLUMN IF NOT EXISTS reminder_type reminder_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS time_of_day TIME,
  ADD COLUMN IF NOT EXISTS days_of_week INT[],
  ADD COLUMN IF NOT EXISTS is_smart BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Reminder',
  ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- Map legacy columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reminders' AND column_name='time'
  ) THEN
    UPDATE public.reminders
    SET time_of_day = COALESCE(time_of_day, "time");
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reminders' AND column_name='is_active'
  ) THEN
    UPDATE public.reminders
    SET is_enabled = COALESCE(is_enabled, is_active);
  END IF;
END $$;

-- 4) RLS: ensure enabled + a minimal policy exists
ALTER TABLE IF EXISTS public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own reminders" ON public.reminders;
CREATE POLICY "Users can CRUD own reminders"
  ON public.reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can CRUD own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Done.

