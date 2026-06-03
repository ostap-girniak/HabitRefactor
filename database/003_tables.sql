-- ============================================
-- Catalyst Forge — Database Migration 003
-- Core Tables
-- ============================================

-- ---- Profiles (extends Supabase auth.users) ----
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Warrior',
    avatar_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    locale TEXT NOT NULL DEFAULT 'uk',
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    hero_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    current_identity_statement TEXT,
    streak_best_ever INT NOT NULL DEFAULT 0,
    total_victories INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Warrior'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---- Habits ----
CREATE TABLE habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category habit_category NOT NULL,
    description TEXT,
    frequency habit_frequency NOT NULL DEFAULT 'daily',
    custom_days INT[],
    reduction_mode reduction_mode NOT NULL DEFAULT 'cold_turkey',
    gradual_target_per_day NUMERIC,
    gradual_reduction_rate NUMERIC,
    unit_name TEXT DEFAULT 'times',
    cost_per_unit NUMERIC DEFAULT 0,
    calories_per_unit NUMERIC DEFAULT 0,
    time_per_unit_minutes NUMERIC DEFAULT 0,
    alternative_behavior TEXT,
    sobriety_start_date TIMESTAMPTZ,
    current_streak_days INT DEFAULT 0,
    best_streak_days INT DEFAULT 0,
    total_relapses INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON habits(user_id) WHERE is_active = TRUE;


-- ---- Triggers ----
CREATE TABLE triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trigger_type trigger_type NOT NULL,
    description TEXT NOT NULL,
    intensity INT CHECK (intensity BETWEEN 1 AND 10),
    frequency_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_triggers_habit ON triggers(habit_id);


-- ---- Check-ins ----
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    result checkin_result NOT NULL,
    relapse_count INT DEFAULT 0,
    relapse_trigger TEXT,
    mood_before INT CHECK (mood_before BETWEEN 1 AND 10),
    mood_after INT CHECK (mood_after BETWEEN 1 AND 10),
    thoughts_before TEXT,
    time_of_day TEXT,
    location TEXT,
    was_alone BOOLEAN,
    alcohol_involved BOOLEAN DEFAULT FALSE,
    stress_level INT CHECK (stress_level BETWEEN 1 AND 10),
    sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 5),
    notes TEXT,
    ai_processed BOOLEAN NOT NULL DEFAULT FALSE,
    ai_insights JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, habit_id, date)
);

CREATE INDEX idx_checkins_user_date ON checkins(user_id, date DESC);
CREATE INDEX idx_checkins_habit_date ON checkins(habit_id, date DESC);


-- ---- Journal Entries ----
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
    entry_type journal_type NOT NULL,
    media_url TEXT,
    media_duration_seconds INT,
    media_size_bytes BIGINT,
    raw_text TEXT,
    transcript TEXT,
    transcript_confidence NUMERIC,
    detected_emotions JSONB,
    emotional_intensity INT,
    key_themes TEXT[],
    mood_rating INT CHECK (mood_rating BETWEEN 1 AND 10),
    energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
    transcription_status TEXT DEFAULT 'pending',
    analysis_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_user_date ON journal_entries(user_id, created_at DESC);


-- ---- AI Analyses ----
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
    analysis_type analysis_type NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    full_analysis TEXT NOT NULL,
    insights JSONB,
    recommendations JSONB,
    trigger_patterns JSONB,
    tomorrow_action TEXT,
    motivational_close TEXT,
    hero_chapter_number INT,
    hero_narrative TEXT,
    catalyst_letter TEXT,
    catalyst_manifesto TEXT,
    severity_score INT,
    confidence_score NUMERIC,
    is_read BOOLEAN DEFAULT FALSE,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    user_feedback TEXT,
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_user ON ai_analyses(user_id, created_at DESC);
CREATE INDEX idx_analyses_type ON ai_analyses(user_id, analysis_type);


-- ---- Identity Statements ----
CREATE TABLE identity_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_identity TEXT NOT NULL,
    new_identity TEXT NOT NULL,
    daily_affirmation TEXT NOT NULL,
    proof_points JSONB,
    belief_score INT CHECK (belief_score BETWEEN 1 AND 100) DEFAULT 10,
    last_affirmed_at TIMESTAMPTZ,
    affirmation_streak INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---- Pain Projections ----
CREATE TABLE pain_projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    projection_months INT NOT NULL,
    money_lost NUMERIC,
    time_lost_hours NUMERIC,
    calories_consumed NUMERIC,
    health_impact_description TEXT,
    life_years_impact NUMERIC,
    money_could_buy TEXT,
    time_could_do TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---- Reminders ----
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
    reminder_type reminder_type NOT NULL,
    time_of_day TIME,
    days_of_week INT[],
    is_smart BOOLEAN DEFAULT FALSE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---- Push Subscriptions ----
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---- Hero Chapters ----
CREATE TABLE hero_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    chapter_number INT NOT NULL,
    title TEXT NOT NULL,
    narrative TEXT NOT NULL,
    victories JSONB,
    battles JSONB,
    character_growth TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, chapter_number)
);
