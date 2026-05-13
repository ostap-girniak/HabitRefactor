-- ============================================
-- HabitRefactor — Notification History
-- Stores all sent notifications for in-app bell icon & history view.
-- Safe to run multiple times.
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  notification_type TEXT NOT NULL DEFAULT 'general',
  url TEXT DEFAULT '/dashboard',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_unread
  ON public.notification_history(user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notification_history_user_created
  ON public.notification_history(user_id, created_at DESC);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notification_history;
CREATE POLICY "Users can read own notifications"
  ON public.notification_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notification_history;
CREATE POLICY "Users can update own notifications"
  ON public.notification_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (from backend push worker)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notification_history;
CREATE POLICY "Service can insert notifications"
  ON public.notification_history FOR INSERT
  WITH CHECK (true);

-- Done.
