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

/**
 * Chantier templates 2026-06-21 — données VISIBLES de byline pour Manon, lues
 * depuis le SSOT `AuthorProfile` (pas de valeurs hardcodées). Sert à enrichir
 * `<AuthorByline>` (photo + rôle) sur les articles générés. Le nœud Person
 * JSON-LD riche reste émis par `getManonPersonJsonLd` (la byline est alors
 * appelée avec `emitJsonLd={false}` pour éviter un Person en double).
 *
 * PAS de LinkedIn : Manon est une persona IA, elle n'a aucun profil social
 * (doctrine v2.1, `AuthorProfile.linkedinUrl` null) → aucun `sameAs` émis.
 * Stub-safe : retourne `null` si la DB est inaccessible (build `stub.invalid`).
 */
export interface ManonBylineData {
  readonly avatarUrl: string;
  readonly bio: string;
}

export async function getManonByline(): Promise<ManonBylineData | null> {
  const author = await prisma.authorProfile
    .findUnique({ where: { slug: "manon" } })
    .catch(() => null);
  if (author?.slug !== "manon") return null;
  return {
    avatarUrl: author.photoUrl256,
    bio: author.jobTitle,
  };
}
