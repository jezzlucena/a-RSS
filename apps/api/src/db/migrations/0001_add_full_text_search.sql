-- Add full-text search capability to articles table

-- Drop the old searchVector text column if it exists
ALTER TABLE articles DROP COLUMN IF EXISTS search_vector;

-- Add tsvector column for full-text search (IF NOT EXISTS requires PostgreSQL 9.6+)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_tsvector tsvector;

-- Populate the search vector for existing articles
-- Weights: A (highest) = title, B = summary, C (lowest) = content
UPDATE articles SET search_tsvector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C');

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_articles_search_tsvector ON articles USING gin(search_tsvector);

-- Create function to update search vector on insert/update
CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsvector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search vector
DROP TRIGGER IF EXISTS articles_search_vector_trigger ON articles;
CREATE TRIGGER articles_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, summary, content ON articles
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_vector_update();

-- Optional: Add trigram extension for fuzzy search fallback
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on title for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING gin(title gin_trgm_ops);
