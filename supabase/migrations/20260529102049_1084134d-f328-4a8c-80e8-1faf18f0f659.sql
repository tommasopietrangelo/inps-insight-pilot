
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.source_type AS ENUM ('circolare', 'messaggio', 'decreto', 'pagina_servizio', 'normativa');
CREATE TYPE public.alert_frequency AS ENUM ('immediata', 'giornaliera', 'settimanale');
CREATE TYPE public.alert_priority AS ENUM ('alta', 'media', 'bassa');
CREATE TYPE public.workspace_member_role AS ENUM ('owner', 'admin', 'member');

-- ========== UTILS ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  job_title TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ========== WORKSPACES ==========
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workspace_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Security definer helper: is user a member of workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id)
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(_user_id UUID, _workspace_id UUID)
RETURNS workspace_member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id
$$;

-- ========== TOPICS ==========
CREATE TABLE public.topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.topics TO authenticated, anon;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- ========== SOURCES (corpus INPS) ==========
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  source_type source_type NOT NULL,
  document_number TEXT,
  publication_date DATE NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  excerpt TEXT,
  full_text TEXT,
  official_url TEXT NOT NULL,
  related_source_ids UUID[] DEFAULT '{}',
  fts TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('italian', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(full_text,''))
  ) STORED,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sources_fts_idx ON public.sources USING gin(fts);
CREATE INDEX sources_topic_tags_idx ON public.sources USING gin(topic_tags);
CREATE INDEX sources_pub_date_idx ON public.sources (publication_date DESC);
GRANT SELECT ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- ========== CHUNKS + EMBEDDINGS ==========
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  section_ref TEXT,
  token_count INT,
  embedding vector(3072),
  model_version TEXT NOT NULL DEFAULT 'google/gemini-embedding-001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);
CREATE INDEX chunks_source_idx ON public.chunks(source_id);
-- Note: HNSW supports max 2000 dims; for 3072 use ivfflat or store + brute-force search via match function.
-- We rely on the match_chunks function with ORDER BY <=> (sequential scan acceptable for MVP corpus size).
GRANT SELECT ON public.chunks TO authenticated;
GRANT ALL ON public.chunks TO service_role;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Semantic search function
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  match_count INT DEFAULT 8,
  filter_topics TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  content TEXT,
  section_ref TEXT,
  source_title TEXT,
  source_type source_type,
  document_number TEXT,
  publication_date DATE,
  official_url TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.source_id, c.content, c.section_ref,
         s.title, s.source_type, s.document_number, s.publication_date, s.official_url,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  JOIN public.sources s ON s.id = c.source_id
  WHERE filter_topics IS NULL OR s.topic_tags && filter_topics
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ========== ALERTS ==========
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  source_types source_type[] DEFAULT NULL,
  keyword_query TEXT,
  frequency alert_frequency NOT NULL DEFAULT 'giornaliera',
  priority alert_priority NOT NULL DEFAULT 'media',
  channels TEXT[] NOT NULL DEFAULT '{email,in_app}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL,
  read_at TIMESTAMPTZ
);
CREATE INDEX alert_deliveries_alert_idx ON public.alert_deliveries(alert_id, delivered_at DESC);
GRANT SELECT, UPDATE ON public.alert_deliveries TO authenticated;
GRANT ALL ON public.alert_deliveries TO service_role;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

-- ========== NOTES ==========
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT,
  linked_source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notes_workspace_idx ON public.notes(workspace_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- ========== SAVED SEARCHES ==========
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  results_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- ========== SEARCH LOGS ==========
CREATE TABLE public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.search_logs TO authenticated;
GRANT ALL ON public.search_logs TO service_role;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- ========== TRIGGERS ==========
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== RLS POLICIES ==========

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- workspaces
CREATE POLICY "Members view workspace" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "Authenticated create workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update workspace" ON public.workspaces FOR UPDATE TO authenticated USING (public.workspace_role(auth.uid(), id) IN ('owner','admin'));

-- workspace_members
CREATE POLICY "Members view membership" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Owners manage members" ON public.workspace_members FOR ALL TO authenticated
  USING (public.workspace_role(auth.uid(), workspace_id) IN ('owner','admin'))
  WITH CHECK (public.workspace_role(auth.uid(), workspace_id) IN ('owner','admin'));

-- topics: public read
CREATE POLICY "Anyone reads topics" ON public.topics FOR SELECT TO authenticated, anon USING (true);

-- sources: all authenticated read
CREATE POLICY "Authenticated read sources" ON public.sources FOR SELECT TO authenticated USING (true);

-- chunks: all authenticated read
CREATE POLICY "Authenticated read chunks" ON public.chunks FOR SELECT TO authenticated USING (true);

-- alerts
CREATE POLICY "Members view workspace alerts" ON public.alerts FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members create alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = created_by);
CREATE POLICY "Members update workspace alerts" ON public.alerts FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members delete workspace alerts" ON public.alerts FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- alert_deliveries
CREATE POLICY "Members view alert deliveries" ON public.alert_deliveries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND public.is_workspace_member(auth.uid(), a.workspace_id))
);
CREATE POLICY "Members mark deliveries read" ON public.alert_deliveries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND public.is_workspace_member(auth.uid(), a.workspace_id))
);

-- notes
CREATE POLICY "Members view workspace notes" ON public.notes FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members create notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = author_id);
CREATE POLICY "Authors update own notes" ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.workspace_role(auth.uid(), workspace_id) IN ('owner','admin'));
CREATE POLICY "Authors delete own notes" ON public.notes FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.workspace_role(auth.uid(), workspace_id) IN ('owner','admin'));

-- saved_searches
CREATE POLICY "Users view own saved searches" ON public.saved_searches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own saved searches" ON public.saved_searches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved searches" ON public.saved_searches FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- search_logs: insert-only
CREATE POLICY "Users insert own search logs" ON public.search_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
