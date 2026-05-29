import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- helpers ----------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMain(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  if (main) return main[0];
  const article = html.match(/<article[\s\S]*?<\/article>/i);
  if (article) return article[0];
  const idContent = html.match(/<div[^>]+id=["'](?:content|main-content|contenuto|main)["'][\s\S]*?<\/div>/i);
  if (idContent) return idContent[0];
  return html;
}

function pickMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function pickTitle(html: string): string | null {
  const og = pickMeta(html, "og:title");
  if (og) return og;
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? stripHtml(t[1]) : null;
}

function detectType(
  url: string,
  title: string,
): "circolare" | "messaggio" | "decreto" | "normativa" | "pagina_servizio" {
  const t = `${url} ${title}`.toLowerCase();
  if (t.includes("circolare")) return "circolare";
  if (t.includes("messaggio")) return "messaggio";
  if (t.includes("decreto")) return "decreto";
  if (t.includes("legge") || t.includes("normativa")) return "normativa";
  return "pagina_servizio";
}

function detectNumber(title: string): string | null {
  // "Circolare n. 14 del 30 gennaio 2026" / "Messaggio numero 1987"
  const m = title.match(/n[\.°]?\s*(\d{1,5}(?:\/\d{2,4})?)/i) ||
    title.match(/numero\s+(\d{1,5}(?:\/\d{2,4})?)/i);
  return m ? m[1] : null;
}

function detectDate(html: string, title: string): string {
  // Try og:article:published_time or similar
  const meta = pickMeta(html, "article:published_time") ||
    pickMeta(html, "og:updated_time") ||
    pickMeta(html, "DC.date");
  if (meta) {
    const d = new Date(meta);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // "del 30 gennaio 2026"
  const months: Record<string, string> = {
    gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
    maggio: "05", giugno: "06", luglio: "07", agosto: "08",
    settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  };
  const m = title.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
  if (m) {
    const day = m[1].padStart(2, "0");
    const mm = months[m[2].toLowerCase()];
    return `${m[3]}-${mm}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function guessTopicTags(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  const map: Record<string, string[]> = {
    ADI: ["adi", "assegno di inclusione"],
    NASpI: ["naspi"],
    "Assegno Unico": ["assegno unico", "auu"],
    ISEE: ["isee", "dsu"],
    Pensioni: ["pensione", "pensioni", "quota 10"],
    SFL: ["supporto formazione", "sfl"],
    Contribuzione: ["contribut", "aliquota"],
  };
  for (const [tag, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) tags.push(tag);
  }
  return tags;
}

// ---------- Import single URL ----------

const ImportInput = z.object({
  url: z.string().url().refine((u) => u.includes("inps.it") || u.includes("gazzettaufficiale.it"), {
    message: "Solo URL inps.it o gazzettaufficiale.it",
  }),
  topic_tags: z.array(z.string()).optional(),
});

export const importFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImportInput.parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; INPSCopilot/1.0; +https://inps-insight-pilot.lovable.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`Fetch fallito: ${res.status} ${res.statusText}`);
    const html = await res.text();

    const title = pickTitle(html) ?? "Documento INPS";
    const description = pickMeta(html, "og:description") ?? pickMeta(html, "description") ?? "";
    const mainHtml = extractMain(html);
    const fullText = stripHtml(mainHtml).slice(0, 30000);
    if (fullText.length < 400) {
      throw new Error(
        "Pagina troppo povera di contenuto (probabilmente renderizzata via JavaScript). Usa l'opzione \"Importa da testo incollato\" copiando il testo dal PDF ufficiale.",
      );
    }
    const sourceType = detectType(data.url, title);
    const number = detectNumber(title);
    const date = detectDate(html, title);
    const topics = data.topic_tags && data.topic_tags.length > 0
      ? data.topic_tags
      : guessTopicTags(`${title} ${description} ${fullText}`);

    const external_id = `inps-${(number ?? Buffer.from(data.url).toString("base64url").slice(0, 12))}-${date}`;

    const { data: upserted, error } = await supabaseAdmin
      .from("sources")
      .upsert(
        {
          external_id,
          title,
          source_type: sourceType,
          document_number: number,
          publication_date: date,
          topic_tags: topics,
          summary: description.slice(0, 500),
          excerpt: fullText.slice(0, 800),
          full_text: fullText,
          official_url: data.url,
        },
        { onConflict: "external_id" },
      )
      .select("id, title, external_id")
      .single();
    if (error) throw new Error(error.message);

    return {
      ok: true,
      source: upserted,
      detected: { sourceType, number, date, topics },
    };
  });

// ---------- Best-effort INPS RSS pull ----------

const RSS_FEEDS = [
  // Best-effort: questi URL possono cambiare. Aggiorniamo se 404.
  "https://www.inps.it/RSSFeed.aspx?iIDLink=2",
  "https://www.inps.it/it/it/inps-comunica/atti.rss.xml",
];

function parseRssItems(xml: string): { url: string; title: string }[] {
  const items: { url: string; title: string }[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/);
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    if (link && title) {
      items.push({ url: link[1].trim(), title: stripHtml(title[1]).slice(0, 300) });
    }
  }
  return items;
}

export const importInpsLatest = createServerFn({ method: "POST" })
  .handler(async () => {
    const tried: { feed: string; count: number; ok: boolean; err?: string }[] = [];
    let allItems: { url: string; title: string }[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const r = await fetch(feed, {
          headers: { "User-Agent": "Mozilla/5.0 INPSCopilot/1.0" },
        });
        if (!r.ok) {
          tried.push({ feed, count: 0, ok: false, err: `${r.status}` });
          continue;
        }
        const xml = await r.text();
        const items = parseRssItems(xml);
        tried.push({ feed, count: items.length, ok: true });
        allItems = allItems.concat(items);
      } catch (e) {
        tried.push({ feed, count: 0, ok: false, err: (e as Error).message });
      }
    }

    if (allItems.length === 0) {
      return {
        ok: false,
        message:
          "Nessun feed RSS INPS raggiungibile. Usa l'import da URL singolo finché non identifichiamo il feed corretto.",
        tried,
        imported: 0,
      };
    }

    // De-dup by url
    const seen = new Set<string>();
    const unique = allItems.filter((i) => (seen.has(i.url) ? false : seen.add(i.url)));

    let imported = 0;
    const errors: string[] = [];
    for (const it of unique.slice(0, 20)) {
      try {
        await importFromUrl({ data: { url: it.url } });
        imported++;
      } catch (e) {
        errors.push(`${it.url}: ${(e as Error).message}`);
      }
    }
    return { ok: true, imported, found: unique.length, tried, errors: errors.slice(0, 5) };
  });

// ---------- Import from pasted text ----------

const TextInput = z.object({
  title: z.string().min(3).max(500),
  text: z.string().min(200).max(60000),
  official_url: z.string().url(),
  source_type: z.enum(["circolare", "messaggio", "decreto", "normativa", "pagina_servizio"]).optional(),
  document_number: z.string().max(50).optional(),
  publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  topic_tags: z.array(z.string()).optional(),
});

export const importFromText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TextInput.parse(data))
  .handler(async ({ data }) => {
    const date = data.publication_date ?? new Date().toISOString().slice(0, 10);
    const sourceType = data.source_type ?? detectType(data.official_url, data.title);
    const number = data.document_number ?? detectNumber(data.title);
    const topics = data.topic_tags && data.topic_tags.length > 0
      ? data.topic_tags
      : guessTopicTags(`${data.title} ${data.text.slice(0, 2000)}`);

    const external_id = `manual-${(number ?? Buffer.from(data.official_url).toString("base64url").slice(0, 12))}-${date}`;

    const { data: upserted, error } = await supabaseAdmin
      .from("sources")
      .upsert(
        {
          external_id,
          title: data.title,
          source_type: sourceType,
          document_number: number,
          publication_date: date,
          topic_tags: topics,
          summary: data.text.slice(0, 500),
          excerpt: data.text.slice(0, 800),
          full_text: data.text,
          official_url: data.official_url,
        },
        { onConflict: "external_id" },
      )
      .select("id, title, external_id")
      .single();
    if (error) throw new Error(error.message);

    // Also clear any stale chunk so re-indexing picks it up
    await supabaseAdmin.from("chunks").delete().eq("source_id", upserted.id);

    return { ok: true, source: upserted, detected: { sourceType, number, date, topics } };
  });
