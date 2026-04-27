-- ============================================
-- Catalyst Forge — Database Migration 002
-- Custom Types (Enums)
-- ============================================

CREATE TYPE habit_category AS ENUM (
    'smoking', 'alcohol', 'food', 'social_media',
    'porn', 'swearing', 'gambling', 'drugs',
    'procrastination', 'other'
);

CREATE TYPE habit_frequency AS ENUM (
    'daily', 'weekdays', 'weekends', 'weekly', 'custom'
);

CREATE TYPE reduction_mode AS ENUM (
    'cold_turkey', 'gradual', 'controlled'
);

CREATE TYPE checkin_result AS ENUM (
    'success', 'relapse', 'partial'
);

CREATE TYPE journal_type AS ENUM (
    'video', 'audio', 'text'
);

CREATE TYPE trigger_type AS ENUM (
    'time_of_day', 'location', 'person', 'emotion',
    'thought', 'situation', 'physical_state', 'other'
);

CREATE TYPE reminder_type AS ENUM (
    'morning_checkin', 'evening_review', 'motivation',
    'danger_zone', 'streak_celebration', 'custom'
);

CREATE TYPE analysis_type AS ENUM (
    'daily_review', 'weekly_review', 'trigger_discovery',
    'pattern_alert', 'hero_chapter', 'catalyst_moment',
    'identity_reflection'
);
