-- ============================================
-- Oracle Chat Sessions — Database Migration 010
-- ============================================

-- Add session_id to group messages into conversations
ALTER TABLE oracle_chats ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_oracle_chats_session ON oracle_chats(session_id);
