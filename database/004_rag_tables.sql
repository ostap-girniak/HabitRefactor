-- ============================================
-- Catalyst Forge — Database Migration 004
-- RAG / Vector Tables
-- ============================================

-- ---- Knowledge Base (pre-loaded wisdom) ----
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_author TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    categories TEXT[],
    habits_relevant_to habit_category[],
    embedding VECTOR(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_embedding ON knowledge_base
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_kb_categories ON knowledge_base USING GIN (categories);


-- ---- User Documents (personalized RAG) ----
CREATE TABLE user_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_docs_user ON user_documents(user_id);
CREATE INDEX idx_user_docs_embedding ON user_documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
