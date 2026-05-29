
-- Allow anonymous read access to public INPS corpus (official public documents)
GRANT SELECT ON public.sources TO anon;
GRANT SELECT ON public.chunks TO anon;

DROP POLICY IF EXISTS "Authenticated read sources" ON public.sources;
CREATE POLICY "Anyone reads sources"
  ON public.sources FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read chunks" ON public.chunks;
CREATE POLICY "Anyone reads chunks"
  ON public.chunks FOR SELECT
  TO anon, authenticated
  USING (true);
