
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 8,
  filter_topics text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  chunk_id uuid, source_id uuid, content text, section_ref text,
  source_title text, source_type source_type, document_number text,
  publication_date date, official_url text, similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.source_id, c.content, c.section_ref,
         s.title, s.source_type, s.document_number, s.publication_date, s.official_url,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.chunks c
  JOIN public.sources s ON s.id = c.source_id
  WHERE filter_topics IS NULL OR s.topic_tags && filter_topics
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$function$;
