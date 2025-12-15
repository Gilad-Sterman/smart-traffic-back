-- Create data_chunks table for storing legal document chunks with embeddings
-- Requires pgvector extension for vector similarity search

-- Enable the pgvector extension (run this first if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the data_chunks table
CREATE TABLE IF NOT EXISTS data_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    source TEXT,
    legal_reference TEXT,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_data_chunks_category ON data_chunks(category);
CREATE INDEX IF NOT EXISTS idx_data_chunks_source ON data_chunks(source);
CREATE INDEX IF NOT EXISTS idx_data_chunks_created_at ON data_chunks(created_at);

-- Create vector similarity search index (using cosine distance)
CREATE INDEX IF NOT EXISTS idx_data_chunks_embedding_cosine 
ON data_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create vector similarity search index (using L2 distance - alternative)
CREATE INDEX IF NOT EXISTS idx_data_chunks_embedding_l2 
ON data_chunks USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE data_chunks ENABLE ROW LEVEL SECURITY;

-- Example policy: allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON data_chunks
    FOR ALL USING (auth.role() = 'authenticated');

-- Example policy: allow read access for anonymous users
CREATE POLICY "Allow read access for anonymous users" ON data_chunks
    FOR SELECT USING (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_data_chunks_updated_at 
    BEFORE UPDATE ON data_chunks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Example queries for vector similarity search:
-- 
-- Find similar chunks using cosine similarity:
-- SELECT id, title, content, 1 - (embedding <=> $1) AS similarity
-- FROM data_chunks
-- ORDER BY embedding <=> $1
-- LIMIT 5;
--
-- Find similar chunks using L2 distance:
-- SELECT id, title, content, embedding <-> $1 AS distance
-- FROM data_chunks
-- ORDER BY embedding <-> $1
-- LIMIT 5;
--
-- Where $1 is the query embedding vector
