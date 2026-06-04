import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];

export type SourceTypeLabel = "Circolare" | "Messaggio" | "Decreto" | "Pagina servizio" | "Normativa";

export interface UISource {
  id: string; // external_id used as URL slug
  uuid: string;
  title: string;
  source_type: SourceTypeLabel;
  publication_date: string;
  document_number: string;
  topic_tags: string[];
  summary: string;
  excerpt: string;
  full_text: string;
  official_url: string;
}

const TYPE_LABEL: Record<SourceRow["source_type"], SourceTypeLabel> = {
  circolare: "Circolare",
  messaggio: "Messaggio",
  decreto: "Decreto",
  pagina_servizio: "Pagina servizio",
  normativa: "Normativa",
};

function toUI(s: SourceRow): UISource {
  return {
    id: s.external_id ?? s.id,
    uuid: s.id,
    title: s.title,
    source_type: TYPE_LABEL[s.source_type] ?? "Circolare",
    publication_date: s.publication_date,
    document_number: s.document_number ?? "",
    topic_tags: s.topic_tags ?? [],
    summary: s.summary ?? "",
    excerpt: s.excerpt ?? "",
    full_text: s.full_text ?? "",
    official_url: s.official_url,
  };
}

export function useSources(limit?: number) {
  return useQuery({
    queryKey: ["sources", limit ?? "all"],
    queryFn: async (): Promise<UISource[]> => {
      let q = supabase.from("sources").select("*").order("publication_date", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(toUI);
    },
  });
}

export function useSourceBySlug(slugOrId: string) {
  return useQuery({
    queryKey: ["source", slugOrId],
    queryFn: async (): Promise<UISource | null> => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      const filter = isUuid
        ? `id.eq.${slugOrId},external_id.eq.${slugOrId}`
        : `external_id.eq.${slugOrId}`;
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .or(filter)
        .maybeSingle();
      if (error) throw error;
      return data ? toUI(data) : null;
    },
  });
}

export function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: async (): Promise<(TopicRow & { updates_count: number })[]> => {
      const { data: topics, error } = await supabase.from("topics").select("*").order("name");
      if (error) throw error;
      // Conta gli atti pubblicati negli ultimi 60 giorni per topic (case-insensitive)
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { data: sources } = await supabase
        .from("sources")
        .select("topic_tags")
        .gte("publication_date", since);
      const counts = new Map<string, number>();
      (sources ?? []).forEach((s) =>
        (s.topic_tags ?? []).forEach((t: string) => {
          const k = (t ?? "").toLowerCase();
          if (!k) return;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }),
      );
      return (topics ?? [])
        .map((t) => ({ ...t, updates_count: counts.get(t.name.toLowerCase()) ?? 0 }))
        .sort((a, b) => b.updates_count - a.updates_count);
    },
  });
}

export function useCorpusStats() {
  return useQuery({
    queryKey: ["corpus-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("sources")
        .select("*", { count: "exact", head: true });
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { count: week } = await supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .gte("publication_date", since);
      return { total: total ?? 0, lastWeek: week ?? 0 };
    },
  });
}
