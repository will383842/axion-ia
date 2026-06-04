// Inventaire des sources RAG à ingérer (T-05, doc 05 §9).
//
// MVP : KbFacts sectoriels (380+ faits sourcés) + villes-facts (≈180) + FAQ
// (via listFaqs, indexables). Les pages d'offre (`service_page`) + KnowledgeEntry
// publiées sont ajoutées en T-40 (avec dédoublonnage vs kb_fact). Les ≈2157
// PAGES villes templatées (doorway) ne sont JAMAIS ingérées — seul villes-facts.ts.
//
// Règles : résoudre les tokens {{price:…}} AVANT stockage (pas de token brut) ;
// exclure confidentiality ∈ {confidential, secret} ; dédoublonner par (type, ref).

import type { KbConfidentiality } from "../../../../prisma/generated/client";
import { isExternalApiAllowed } from "@/content/knowledge/confidentialities";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import { listFaqs, isFaqItemIndexable, type FaqItem } from "@/lib/knowledge/readers";
import { KB_AUDITS } from "@/server/content-gen/kb/audits";
import { KB_INTERVENTIONS_FORMATIONS } from "@/server/content-gen/kb/interventions-formations";
import { KB_UN_A_UN } from "@/server/content-gen/kb/un-a-un";
import { KB_IMPLEMENTATIONS } from "@/server/content-gen/kb/implementations";
import { KB_SITES_WEB_AUGMENTES } from "@/server/content-gen/kb/sites-web-augmentes";
import { KB_VILLES_ALL } from "@/server/content-gen/kb/villes-facts";
import type { KbFact } from "@/server/content-gen/kb/audits";

export type IngestSourceType = "kb_fact" | "faq" | "knowledge_entry" | "service_page";

export interface IngestSource {
  readonly sourceType: IngestSourceType;
  readonly sourceRef: string;
  readonly categorie: string;
  readonly contenu: string;
  readonly contexte: string;
  readonly confidentiality: KbConfidentiality;
}

const ALL_KB_FACTS: ReadonlyArray<KbFact> = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
  ...KB_VILLES_ALL,
];

/** Sources statiques (KbFacts) — pures, sans DB. Tokens prix résolus. */
export function gatherKbFactSources(facts: ReadonlyArray<KbFact> = ALL_KB_FACTS): IngestSource[] {
  return facts.map((f) => ({
    sourceType: "kb_fact" as const,
    sourceRef: f.id,
    categorie: f.verticales[0] ?? "general",
    contenu: resolvePriceTokens(f.text, "fr"),
    contexte: `Fait sectoriel (${f.verticales.join("/")}) — source : ${f.source}`,
    confidentiality: "public" as KbConfidentiality,
  }));
}

/** Sources FAQ (pures à partir d'une liste de FaqItem). Tokens prix résolus. */
export function gatherFaqSources(faqs: ReadonlyArray<FaqItem>): IngestSource[] {
  return faqs.filter(isFaqItemIndexable).map((q) => ({
    sourceType: "faq" as const,
    sourceRef: q.slug,
    categorie: "faq",
    contenu: `${q.questionFr}\n\n${resolvePriceTokens(q.answerFr, "fr")}`,
    contexte: `FAQ — ${q.questionFr}`,
    confidentiality: "public" as KbConfidentiality,
  }));
}

/** Exclut les sources confidentielles + dédoublonne par (type, ref). */
export function normalizeSources(sources: ReadonlyArray<IngestSource>): IngestSource[] {
  const seen = new Set<string>();
  const out: IngestSource[] = [];
  for (const s of sources) {
    if (!isExternalApiAllowed(s.confidentiality)) continue; // refus confidential/secret
    if (!s.contenu.trim()) continue;
    const key = `${s.sourceType}::${s.sourceRef}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Rassemble toutes les sources à ingérer (KbFacts + FAQ). Async (listFaqs → DB).
 * `faqs` injectable pour les tests.
 */
export async function gatherSources(faqs?: ReadonlyArray<FaqItem>): Promise<IngestSource[]> {
  const faqItems = faqs ?? (await listFaqs());
  return normalizeSources([...gatherKbFactSources(), ...gatherFaqSources(faqItems)]);
}
