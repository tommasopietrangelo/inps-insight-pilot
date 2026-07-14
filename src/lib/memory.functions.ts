import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Overview / KPIs
// ============================================================
export const getMemoryOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [views, cases, practices, members] = await Promise.all([
      supabase.from("memory_source_views").select("*", { count: "exact", head: true }).eq("workspace_id", ws),
      supabase.from("memory_cases").select("*", { count: "exact", head: true }).eq("workspace_id", ws),
      supabase.from("practices").select("*", { count: "exact", head: true }).eq("workspace_id", ws),
      supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", ws),
    ]);
    // growth: views in last 30d vs prev 30d
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
    const [{ count: cur }, { count: prev }] = await Promise.all([
      supabase.from("memory_source_views").select("*", { count: "exact", head: true })
        .eq("workspace_id", ws).gte("viewed_at", d30),
      supabase.from("memory_source_views").select("*", { count: "exact", head: true })
        .eq("workspace_id", ws).gte("viewed_at", d60).lt("viewed_at", d30),
    ]);
    const growth = prev && prev > 0 ? Math.round(((cur ?? 0) - prev) / prev * 100) : (cur ?? 0) > 0 ? 100 : 0;
    return {
      totalMemorized: (views.count ?? 0) + (cases.count ?? 0) + (practices.count ?? 0),
      totalCases: cases.count ?? 0,
      totalPractices: practices.count ?? 0,
      totalViews: views.count ?? 0,
      members: members.count ?? 0,
      growth30d: growth,
    };
  });

// ============================================================
// Livello 1 · Memoria Normativa (auto da consultazioni)
// ============================================================
export const getMemoryNormativa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; limit?: number }) =>
    z.object({ workspaceId: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("memory_source_views")
      .select("source_id, viewed_at, sources!inner(id, title, source_type, document_number, publication_date)")
      .eq("workspace_id", data.workspaceId)
      .order("viewed_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const agg = new Map<string, { source: any; count: number; last: string }>();
    for (const r of rows ?? []) {
      const s: any = (r as any).sources;
      if (!s) continue;
      const prev = agg.get(s.id);
      if (prev) {
        prev.count++;
        if (r.viewed_at > prev.last) prev.last = r.viewed_at;
      } else {
        agg.set(s.id, { source: s, count: 1, last: r.viewed_at });
      }
    }
    const totalViews = rows?.length ?? 0;
    return {
      totalViews,
      totalSources: agg.size,
      top: [...agg.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, data.limit ?? 15)
        .map((x) => ({
          id: x.source.id,
          title: x.source.title,
          type: x.source.source_type,
          documentNumber: x.source.document_number,
          publicationDate: x.source.publication_date,
          count: x.count,
          lastViewedAt: x.last,
        })),
    };
  });

export const trackSourceView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; sourceId: string }) =>
    z.object({ workspaceId: z.string().uuid(), sourceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // dedupe: skip if same user viewed same source in the last 5 min
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("memory_source_views")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .eq("source_id", data.sourceId)
      .gte("viewed_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) return { ok: true, deduped: true };
    const { error } = await supabase.from("memory_source_views").insert({
      workspace_id: data.workspaceId,
      user_id: userId,
      source_id: data.sourceId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Livello 2 · Memoria Pratiche (aggregate da practices)
// ============================================================
export const getMemoryPratiche = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("practices")
      .select("id, kind, title, updated_at, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const byTitle = new Map<string, { title: string; kind: string; count: number; last: string }>();
    for (const r of rows ?? []) {
      const key = (r.title || r.kind || "senza titolo").trim().toLowerCase();
      const prev = byTitle.get(key);
      if (prev) {
        prev.count++;
        if (r.updated_at > prev.last) prev.last = r.updated_at;
      } else {
        byTitle.set(key, { title: r.title || r.kind, kind: r.kind, count: 1, last: r.updated_at });
      }
    }
    const byKind = new Map<string, number>();
    for (const r of rows ?? []) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    return {
      totalPractices: rows?.length ?? 0,
      categoriesCount: byTitle.size,
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })),
      top: [...byTitle.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((x) => ({ title: x.title, kind: x.kind, count: x.count, lastUsed: x.last })),
    };
  });

// ============================================================
// Livello 3 · Casi Particolari (CRUD)
// ============================================================
export const listMemoryCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; scope?: "mine" | "shared" | "all" }) =>
    z.object({
      workspaceId: z.string().uuid(),
      scope: z.enum(["mine", "shared", "all"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("memory_cases").select("*").eq("workspace_id", data.workspaceId);
    if (data.scope === "mine") q = q.eq("author_id", userId);
    else if (data.scope === "shared") q = q.eq("is_shared", true);
    const { data: rows, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ ...r, isMine: r.author_id === userId }));
  });

export const createMemoryCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workspaceId: string;
    title: string;
    category?: string | null;
    sourceId?: string | null;
    sourceRef?: string | null;
    situation: string;
    solution: string;
    tags?: string[];
    isShared?: boolean;
  }) =>
    z.object({
      workspaceId: z.string().uuid(),
      title: z.string().min(1).max(200),
      category: z.string().max(80).nullable().optional(),
      sourceId: z.string().uuid().nullable().optional(),
      sourceRef: z.string().max(200).nullable().optional(),
      situation: z.string().min(1).max(4000),
      solution: z.string().min(1).max(4000),
      tags: z.array(z.string().min(1).max(40)).max(15).optional(),
      isShared: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("memory_cases")
      .insert({
        workspace_id: data.workspaceId,
        author_id: userId,
        title: data.title,
        category: data.category ?? null,
        source_id: data.sourceId ?? null,
        source_ref: data.sourceRef ?? null,
        situation: data.situation,
        solution: data.solution,
        tags: data.tags ?? [],
        is_shared: data.isShared ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMemoryCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    title?: string;
    category?: string | null;
    situation?: string;
    solution?: string;
    tags?: string[];
    isShared?: boolean;
  }) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      category: z.string().max(80).nullable().optional(),
      situation: z.string().min(1).max(4000).optional(),
      solution: z.string().min(1).max(4000).optional(),
      tags: z.array(z.string().min(1).max(40)).max(15).optional(),
      isShared: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.category !== undefined) patch.category = data.category;
    if (data.situation !== undefined) patch.situation = data.situation;
    if (data.solution !== undefined) patch.solution = data.solution;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.isShared !== undefined) patch.is_shared = data.isShared;
    const { data: row, error } = await supabase
      .from("memory_cases")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMemoryCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("memory_cases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const incrementCaseReuse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cur } = await supabase.from("memory_cases").select("reuses").eq("id", data.id).single();
    const next = (cur?.reuses ?? 0) + 1;
    const { error } = await supabase.from("memory_cases").update({ reuses: next }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { reuses: next };
  });

// ============================================================
// Livello 4 · Operatore (preferenze personali)
// ============================================================
export const getOperatorPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("memory_operator_prefs")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    return row ?? {
      user_id: userId,
      workspace_id: data.workspaceId,
      response_style: "sintetico",
      detail_level: "medio",
      preferred_sources: [],
      preferred_topics: [],
      notes: null,
    };
  });

export const updateOperatorPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workspaceId: string;
    responseStyle?: string;
    detailLevel?: string;
    preferredSources?: string[];
    preferredTopics?: string[];
    notes?: string | null;
  }) =>
    z.object({
      workspaceId: z.string().uuid(),
      responseStyle: z.enum(["sintetico", "esteso", "bullet", "narrativo"]).optional(),
      detailLevel: z.enum(["basso", "medio", "alto"]).optional(),
      preferredSources: z.array(z.string().min(1).max(80)).max(20).optional(),
      preferredTopics: z.array(z.string().min(1).max(80)).max(20).optional(),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      user_id: userId,
      workspace_id: data.workspaceId,
    };
    if (data.responseStyle !== undefined) payload.response_style = data.responseStyle;
    if (data.detailLevel !== undefined) payload.detail_level = data.detailLevel;
    if (data.preferredSources !== undefined) payload.preferred_sources = data.preferredSources;
    if (data.preferredTopics !== undefined) payload.preferred_topics = data.preferredTopics;
    if (data.notes !== undefined) payload.notes = data.notes;
    const { data: row, error } = await supabase
      .from("memory_operator_prefs")
      .upsert(payload, { onConflict: "user_id,workspace_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============================================================
// Livello 5 · Memoria Collettiva Studio (casi condivisi + team)
// ============================================================
export const getMemoryStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [sharedCases, members] = await Promise.all([
      supabase
        .from("memory_cases")
        .select("id, title, category, tags, reuses, author_id, updated_at, situation, solution")
        .eq("workspace_id", ws)
        .eq("is_shared", true)
        .order("reuses", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase.from("workspace_members").select("user_id").eq("workspace_id", ws),
    ]);
    if (sharedCases.error) throw new Error(sharedCases.error.message);
    const contributors = new Set((sharedCases.data ?? []).map((c) => c.author_id));
    const totalReuses = (sharedCases.data ?? []).reduce((s, c) => s + (c.reuses ?? 0), 0);
    // fetch author display names
    const authorIds = [...contributors];
    let authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);
      authorMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name || "Operatore"]));
    }
    return {
      teamSize: members.data?.length ?? 0,
      contributors: contributors.size,
      sharedCount: sharedCases.data?.length ?? 0,
      totalReuses,
      cases: (sharedCases.data ?? []).map((c) => ({
        ...c,
        authorName: authorMap[c.author_id] ?? "Operatore",
      })),
    };
  });
