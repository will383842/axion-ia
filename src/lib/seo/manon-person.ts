/**
 * VIS-05 (audit visibilité 2026-06-05) — Nœud Person « Manon » (E-E-A-T).
 *
 * Les factories content-gen (`buildArticleJsonLd`, `buildNewsArticleJsonLd`,
 * `buildQAPageJsonLd`, `buildHowToJsonLd`) posent un `author`/`creator` en
 * `@id` nu (`…/equipe/manon#person`). Sans co-émission du nœud Person sur la
 * même page, cet `@id` est ORPHELIN → warning Google Rich Results
 * (« Missing field name in author ») + perte du signal E-E-A-T.
 *
 * Ce helper centralise le fetch + build (déjà fait à la main sur
 * `/connaissances/[slug]`), pour le réutiliser sur actualites/faq/guides/
 * centre-aide. Stub-safe : retourne null si la DB est inaccessible (build
 * `stub.invalid`) → l'ISR runtime réhydrate le nœud.
 */

import { prisma } from "@/lib/prisma";
import { buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";

export async function getManonPersonJsonLd(): Promise<Record<string, unknown> | null> {
  const author = await prisma.authorProfile
    .findUnique({ where: { slug: "manon" } })
    .catch(() => null);
  return author?.slug === "manon" ? buildPersonManonJsonLd(author) : null;
}
