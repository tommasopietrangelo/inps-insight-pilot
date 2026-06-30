
CREATE OR REPLACE FUNCTION public.sources_missing_embeddings(limit_count int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  excerpt text,
  full_text text,
  document_number text,
  topic_tags text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.summary, s.excerpt, s.full_text, s.document_number, s.topic_tags
  FROM public.sources s
  WHERE NOT EXISTS (SELECT 1 FROM public.chunks c WHERE c.source_id = s.id)
  ORDER BY s.publication_date DESC NULLS LAST
  LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION public.sources_missing_embeddings_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.sources s
  WHERE NOT EXISTS (SELECT 1 FROM public.chunks c WHERE c.source_id = s.id);
$$;
