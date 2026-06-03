-- ============================================
-- Catalyst Forge — Combined Migration Script
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Custom Types
DO $$ BEGIN
  CREATE TYPE habit_category AS ENUM (
    'smoking', 'alcohol', 'drugs', 'gambling', 'porn',
    'social_media', 'food', 'swearing', 'procrastination', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE habit_frequency AS ENUM ('daily', 'weekdays', 'weekends', 'weekly', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reduction_mode AS ENUM ('cold_turkey', 'gradual', 'controlled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE checkin_result AS ENUM ('success', 'relapse', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE journal_entry_type AS ENUM ('text', 'audio', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trigger_type AS ENUM ('emotion', 'situation', 'person', 'location', 'time_of_day', 'substance', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE analysis_type AS ENUM ('daily_review', 'weekly_review', 'trigger_analysis', 'pattern_detection', 'milestone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE letter_tone AS ENUM ('tough_love', 'compassionate', 'stoic', 'warrior');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Core Tables

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT 'Warrior',
  avatar_url TEXT,
  current_identity_statement TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  preferred_language TEXT DEFAULT 'uk',
  timezone TEXT DEFAULT 'Europe/Kyiv',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habits
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category habit_category NOT NULL DEFAULT 'other',
  description TEXT,
  unit_name TEXT DEFAULT 'times',
  cost_per_unit NUMERIC DEFAULT 0,
  time_per_unit_minutes INTEGER DEFAULT 0,
  calories_per_unit INTEGER DEFAULT 0,
  frequency habit_frequency DEFAULT 'daily',
  reduction_mode reduction_mode DEFAULT 'cold_turkey',
  is_active BOOLEAN DEFAULT true,
  current_streak_days INTEGER DEFAULT 0,
  best_streak_days INTEGER DEFAULT 0,
  total_relapses INTEGER DEFAULT 0,
  sobriety_start_date TIMESTAMPTZ DEFAULT NOW(),
  alternative_behavior TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers
CREATE TABLE IF NOT EXISTS triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type trigger_type DEFAULT 'other',
  intensity INTEGER DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10),
  coping_strategy TEXT,
  frequency_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  result checkin_result NOT NULL,
  relapse_count INTEGER DEFAULT 0,
  relapse_trigger TEXT,
  mood_before INTEGER CHECK (mood_before BETWEEN 1 AND 10),
  mood_after INTEGER CHECK (mood_after BETWEEN 1 AND 10),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  time_of_day TEXT,
  context_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_id, date)
);

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type journal_entry_type NOT NULL DEFAULT 'text',
  raw_text TEXT,
  transcript TEXT,
  media_url TEXT,
  media_duration_seconds INTEGER,
  detected_emotions JSONB DEFAULT '{}',
  key_themes TEXT[] DEFAULT '{}',
  transcription_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Analyses
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type analysis_type NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  full_analysis JSONB NOT NULL DEFAULT '{}',
  severity_score INTEGER DEFAULT 5 CHECK (severity_score BETWEEN 1 AND 10),
  feedback_score INTEGER,
  feedback_text TEXT,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Identity Statements
CREATE TABLE IF NOT EXISTS identity_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_identity TEXT NOT NULL,
  new_identity TEXT NOT NULL,
  daily_affirmation TEXT NOT NULL,
  belief_score INTEGER DEFAULT 10 CHECK (belief_score BETWEEN 0 AND 100),
  affirmation_streak INTEGER DEFAULT 0,
  proof_points JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_affirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hero Mode Chapters
CREATE TABLE IF NOT EXISTS hero_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  victories INTEGER DEFAULT 0,
  battles INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalyst Letters
CREATE TABLE IF NOT EXISTS catalyst_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tone letter_tone NOT NULL DEFAULT 'tough_love',
  content TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  days TEXT[] DEFAULT '{monday,tuesday,wednesday,thursday,friday,saturday,sunday}',
  message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RAG Tables

-- Knowledge Base (pre-loaded wisdom)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Documents (embeddings from user's own data)
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON knowledge_base USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_user_documents_embedding
  ON user_documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);

-- 5. Row Level Security

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalyst_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles', 'habits', 'triggers', 'checkins', 'journal_entries',
    'ai_analyses', 'identity_statements', 'hero_chapters', 'catalyst_letters',
    'push_subscriptions', 'reminders', 'user_documents'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'users_own_data_select_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'users_own_data_insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'users_own_data_update_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'users_own_data_delete_' || tbl, tbl);
    
    IF tbl = 'profiles' THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (id = auth.uid())', 'users_own_data_select_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (id = auth.uid())', 'users_own_data_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (id = auth.uid())', 'users_own_data_update_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (id = auth.uid())', 'users_own_data_delete_' || tbl, tbl);
    ELSE
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (user_id = auth.uid())', 'users_own_data_select_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (user_id = auth.uid())', 'users_own_data_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (user_id = auth.uid())', 'users_own_data_update_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (user_id = auth.uid())', 'users_own_data_delete_' || tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- Knowledge base is readable by everyone (no user_id)
DROP POLICY IF EXISTS knowledge_base_read ON knowledge_base;
CREATE POLICY knowledge_base_read ON knowledge_base FOR SELECT USING (true);

-- 6. Functions

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Warrior')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['profiles', 'habits', 'journal_entries', 'identity_statements']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END $$;

-- Update streak on checkin
CREATE OR REPLACE FUNCTION handle_checkin_streak()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result = 'success' THEN
    UPDATE habits SET
      current_streak_days = current_streak_days + 1,
      best_streak_days = GREATEST(best_streak_days, current_streak_days + 1),
      updated_at = NOW()
    WHERE id = NEW.habit_id;
  ELSIF NEW.result = 'relapse' THEN
    UPDATE habits SET
      current_streak_days = 0,
      total_relapses = total_relapses + COALESCE(NEW.relapse_count, 1),
      sobriety_start_date = NOW(),
      updated_at = NOW()
    WHERE id = NEW.habit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_checkin_created ON checkins;
CREATE TRIGGER on_checkin_created
  AFTER INSERT ON checkins
  FOR EACH ROW EXECUTE FUNCTION handle_checkin_streak();

-- RAG similarity search
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(768),
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (id UUID, source TEXT, title TEXT, content TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id, kb.source, kb.title, kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_user_documents(
  p_user_id UUID,
  query_embedding vector(768),
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (id UUID, source_type TEXT, content TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ud.id, ud.source_type, ud.content,
    1 - (ud.embedding <=> query_embedding) AS similarity
  FROM user_documents ud
  WHERE ud.user_id = p_user_id
    AND 1 - (ud.embedding <=> query_embedding) > match_threshold
  ORDER BY ud.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Dashboard stats
CREATE OR REPLACE FUNCTION get_habit_stats(p_user_id UUID, p_habit_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_checkins', COUNT(*),
    'success_count', COUNT(*) FILTER (WHERE c.result = 'success'),
    'relapse_count', COUNT(*) FILTER (WHERE c.result = 'relapse'),
    'partial_count', COUNT(*) FILTER (WHERE c.result = 'partial'),
    'avg_mood', ROUND(AVG(c.mood_before)::numeric, 1),
    'avg_stress', ROUND(AVG(c.stress_level)::numeric, 1),
    'success_rate', CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE c.result = 'success')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0 END
  ) INTO result
  FROM checkins c
  WHERE c.user_id = p_user_id AND c.habit_id = p_habit_id;
  RETURN result;
END;
$$;

-- ============================================
-- Migration complete!
-- ============================================
