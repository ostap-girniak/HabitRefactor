-- ============================================
-- Catalyst Forge — Database Migration 006
-- Database Functions (RPC)
-- ============================================

-- ---- Similarity search on knowledge base ----
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding VECTOR(768),
    match_count INT DEFAULT 5,
    filter_categories TEXT[] DEFAULT NULL,
    filter_habits habit_category[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    source_title TEXT,
    source_author TEXT,
    title TEXT,
    content TEXT,
    categories TEXT[],
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.source_title,
        kb.source_author,
        kb.title,
        kb.content,
        kb.categories,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE
        (filter_categories IS NULL OR kb.categories && filter_categories)
        AND (filter_habits IS NULL OR kb.habits_relevant_to && filter_habits)
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ---- Similarity search on user documents ----
CREATE OR REPLACE FUNCTION match_user_documents(
    p_user_id UUID,
    query_embedding VECTOR(768),
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    source_type TEXT,
    source_id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ud.id,
        ud.source_type,
        ud.source_id,
        ud.content,
        ud.created_at,
        1 - (ud.embedding <=> query_embedding) AS similarity
    FROM user_documents ud
    WHERE ud.user_id = p_user_id
    ORDER BY ud.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ---- Get streak statistics for a habit ----
CREATE OR REPLACE FUNCTION get_habit_stats(
    p_habit_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_checkins', COUNT(*),
        'successful_days', COUNT(*) FILTER (WHERE result = 'success'),
        'relapse_days', COUNT(*) FILTER (WHERE result = 'relapse'),
        'partial_days', COUNT(*) FILTER (WHERE result = 'partial'),
        'avg_mood_before', ROUND(AVG(mood_before)::numeric, 1),
        'avg_mood_after', ROUND(AVG(mood_after)::numeric, 1),
        'avg_stress', ROUND(AVG(stress_level)::numeric, 1),
        'most_common_time', MODE() WITHIN GROUP (ORDER BY time_of_day),
        'alone_percentage', ROUND(
            100.0 * COUNT(*) FILTER (WHERE was_alone = true) / NULLIF(COUNT(*), 0), 1
        ),
        'alcohol_correlation', ROUND(
            100.0 * COUNT(*) FILTER (WHERE alcohol_involved = true AND result = 'relapse')
            / NULLIF(COUNT(*) FILTER (WHERE result = 'relapse'), 0), 1
        )
    ) INTO result
    FROM checkins
    WHERE habit_id = p_habit_id AND user_id = p_user_id;

    RETURN result;
END;
$$;


-- ---- Calculate savings for a habit ----
CREATE OR REPLACE FUNCTION calculate_savings(
    p_habit_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    habit_record RECORD;
    days_clean INT;
    result JSONB;
BEGIN
    SELECT * INTO habit_record FROM habits
    WHERE id = p_habit_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    days_clean := habit_record.current_streak_days;

    result := jsonb_build_object(
        'days_clean', days_clean,
        'money_saved', ROUND((days_clean * habit_record.cost_per_unit)::numeric, 2),
        'time_saved_hours', ROUND((days_clean * habit_record.time_per_unit_minutes / 60.0)::numeric, 1),
        'calories_avoided', ROUND((days_clean * habit_record.calories_per_unit)::numeric, 0),
        'unit_name', habit_record.unit_name,
        'best_streak', habit_record.best_streak_days,
        'total_relapses', habit_record.total_relapses
    );

    RETURN result;
END;
$$;


-- ---- Update streak on checkin ----
CREATE OR REPLACE FUNCTION update_streak_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.result = 'success' THEN
        UPDATE habits
        SET
            current_streak_days = current_streak_days + 1,
            best_streak_days = GREATEST(best_streak_days, current_streak_days + 1),
            updated_at = NOW()
        WHERE id = NEW.habit_id;
    ELSIF NEW.result = 'relapse' THEN
        UPDATE habits
        SET
            current_streak_days = 0,
            total_relapses = total_relapses + 1,
            sobriety_start_date = NOW(),
            updated_at = NOW()
        WHERE id = NEW.habit_id;
    END IF;

    -- Update profile best streak
    UPDATE profiles
    SET
        streak_best_ever = GREATEST(
            streak_best_ever,
            (SELECT best_streak_days FROM habits WHERE id = NEW.habit_id)
        ),
        total_victories = total_victories + (CASE WHEN NEW.result = 'success' THEN 1 ELSE 0 END),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_checkin_created
    AFTER INSERT ON checkins
    FOR EACH ROW EXECUTE FUNCTION update_streak_on_checkin();


-- ---- Auto-update updated_at timestamp ----
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_habits_timestamp
    BEFORE UPDATE ON habits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_identity_timestamp
    BEFORE UPDATE ON identity_statements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
