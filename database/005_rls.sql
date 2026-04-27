-- ============================================
-- Catalyst Forge — Database Migration 005
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- ---- Profiles ----
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ---- Habits ----
CREATE POLICY "Users can CRUD own habits"
    ON habits FOR ALL
    USING (auth.uid() = user_id);

-- ---- Triggers ----
CREATE POLICY "Users can CRUD own triggers"
    ON triggers FOR ALL
    USING (auth.uid() = user_id);

-- ---- Checkins ----
CREATE POLICY "Users can CRUD own checkins"
    ON checkins FOR ALL
    USING (auth.uid() = user_id);

-- ---- Journal Entries ----
CREATE POLICY "Users can CRUD own journal entries"
    ON journal_entries FOR ALL
    USING (auth.uid() = user_id);

-- ---- AI Analyses ----
CREATE POLICY "Users can read own analyses"
    ON ai_analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
    ON ai_analyses FOR UPDATE
    USING (auth.uid() = user_id);

-- ---- Identity Statements ----
CREATE POLICY "Users can CRUD own identity statements"
    ON identity_statements FOR ALL
    USING (auth.uid() = user_id);

-- ---- Pain Projections ----
CREATE POLICY "Users can read own pain projections"
    ON pain_projections FOR SELECT
    USING (auth.uid() = user_id);

-- ---- Reminders ----
CREATE POLICY "Users can CRUD own reminders"
    ON reminders FOR ALL
    USING (auth.uid() = user_id);

-- ---- Push Subscriptions ----
CREATE POLICY "Users can CRUD own push subscriptions"
    ON push_subscriptions FOR ALL
    USING (auth.uid() = user_id);

-- ---- User Documents ----
CREATE POLICY "Users can read own documents"
    ON user_documents FOR SELECT
    USING (auth.uid() = user_id);

-- ---- Hero Chapters ----
CREATE POLICY "Users can read own hero chapters"
    ON hero_chapters FOR SELECT
    USING (auth.uid() = user_id);

-- ---- Knowledge Base (read-only for all authenticated) ----
CREATE POLICY "Authenticated users can read knowledge base"
    ON knowledge_base FOR SELECT
    USING (auth.role() = 'authenticated');
