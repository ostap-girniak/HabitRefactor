-- ============================================
-- Oracle Chat History — Database Migration 009
-- ============================================

CREATE TABLE IF NOT EXISTS oracle_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_chats_user ON oracle_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_chats_created_at ON oracle_chats(created_at);

-- ============================================
-- RLS Policies — users can only access their own chats
-- ============================================
ALTER TABLE oracle_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oracle chats"
    ON oracle_chats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oracle chats"
    ON oracle_chats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own oracle chats"
    ON oracle_chats FOR DELETE
    USING (auth.uid() = user_id);

-- Service role bypass (for backend workers)
CREATE POLICY "Service role full access to oracle chats"
    ON oracle_chats FOR ALL
    USING (auth.role() = 'service_role');
