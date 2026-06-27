/**
 * Content Generator — Intent enforcement déterministe (2026-06-27).
 *
 * Problème résolu : la validation d'alignement d'intent (`search-intent-validator`)
 * dévie en `needs_review` (blockingFail → tier_3) les contenus qui ne remplissent
 * pas certaines exigences STRUCTURELLES, même quand le corps est par ailleurs bon.
 * Deux gardes généraient des faux positifs massifs en prod (audit 2026-06-27) :
 *
 *   - `informational` / `ai_overview` / `featured_snippet` sans ≥ 3 sources
 *     externes d'autorité — `selectExternalLinks` peut légitimement renvoyer < 3
 *     liens quand le filtre topic/vertical + rotation épuise le pool, et
 *     `appendSourcesSection` est idempotent (ne complète pas une section existante
 *     sous-remplie).
 *   - `transactional` sans CTA reconnu — les générateurs émettent des CTA vers
 *     `/audit`, `/formations`, `/interventions`, `/implementations`… que l'ancien
 *     détecteur (`reserver|appel|contact`) ne reconnaissait pas.
 *
 * Plutôt que retoucher 8 prompts (non-déterministe), on garantit un PLANCHER
 * déterministe APRÈS génération et AVANT validation d'intent :
 *   1. ≥ 3 liens externes d'autorité pour les intents « sources »
 *   2. un CTA reconnu pour l'intent `transactional`
 *
 * Fail-open : toute erreur de sélection laisse le contenu inchangé (jamais de
 * blocage de la génération). Idempotent : ne ré-injecte pas si le plancher est
 * déjà atteint.
 */

import type { SearchIntent } from "../../../../prisma/generated/client";
import { selectExternalLinks } from "@/data/external-links/helpers";

/** Host canonique — un lien interne n'est PAS une source externe d'autorité. */
const SITE_HOST = "axion-ia.com";

/** Plancher de sources externes exigé par le validateur pour ces intents. */
const MIN_EXTERNAL_SOURCES = 3;

/** Intents dont la garde dure exige ≥ 3 sources externes citables. */
const SOURCE_INTENTS: ReadonlySet<SearchIntent> = new Set<SearchIntent>([
  "informational",
  "ai_overview",
  "featured_snippet",
]);

/**
 * CTA reconnus — SSOT partagée avec le worker (`hasPrimaryCta`). Couvre les
 * vraies pages de conversion Axion-IA (pas seulement reserver/appel/contact) :
 * les générateurs Phase-8 recommandent des CTA vers /audit, /formations,
 * /interventions, /implementations, /un-a-un. On reconnaît aussi mailto:/tel:,
 * les `<button>`, et les classes/attributs cta-*.
 */
export const RECOGNIZED_CTA_RE =
  /(href=["'][^"']*\/(?:reserver|appel|contact|devis|audit-demande|rendez-vous|audit|formations|interventions|implementations|un-a-un)\b|href=["'](?:mailto:|tel:)|<button\b|class=["'][^"']*cta-(?:primary|internal)|data-cta)/i;

/** Vrai si le HTML contient un CTA actionnable reconnu. */
export function hasRecognizedCta(bodyHtml: string): boolean {
  return RECOGNIZED_CTA_RE.test(bodyHtml);
}

/** CTA de repli injecté quand l'intent transactional n'en a aucun. */
const FALLBACK_CTA_HTML =
  '\n<p class="cta-primary"><a href="/reserver">Réserver une intervention avec Axion-IA</a></p>';

/**
 * Compte les liens externes d'autorité (URL absolue http(s) hors axion-ia.com).
 * Aligné avec `countExternalLinks` du validateur d'intent.
 */
export function countExternalLinks(bodyHtml: string): number {
  let count = 0;
  const re = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) {
    try {
      const host = new URL(m[1]!).hostname.toLowerCase();
      if (host !== SITE_HOST && !host.endsWith(`.${SITE_HOST}`)) count++;
    } catch {
      // URL invalide → ignorée
    }
  }
  return count;
}

/** Échappe le HTML d'un libellé de source (titres catalogue = données vettées). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Garantit ≥ `MIN_EXTERNAL_SOURCES` liens externes dans le body : étend la
 * section `sources-axion` existante (sinon en crée une). Markup identique à
 * `appendSourcesSection` pour cohérence de rendu.
 */
function ensureMinExternalSources(
  bodyHtml: string,
  linksToAdd: ReadonlyArray<{ url: string; title: string }>,
): string {
  if (linksToAdd.length === 0) return bodyHtml;
  const items = linksToAdd
    .map(
      (l) =>
        `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.title)}</a></li>`,
    )
    .join("");
  const sectionRe = /(<section id="sources-axion">[\s\S]*?<ul>)([\s\S]*?)(<\/ul>\s*<\/section>)/i;
  if (sectionRe.test(bodyHtml)) {
    return bodyHtml.replace(sectionRe, (_m, head: string, body: string, tail: string) => {
      return `${head}${body}${items}${tail}`;
    });
  }
  return `${bodyHtml}\n<section id="sources-axion"><h2>Sources</h2><ul>${items}</ul></section>`;
}

export interface IntentEnforcementInput {
  readonly intent: SearchIntent;
  readonly bodyHtml: string;
  readonly citations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }>;
  /** IDs de liens déjà utilisés (diversification cross-article). */
  readonly excludeLinkIds?: ReadonlyArray<string>;
  /** Contexte géo optionnel pour la pertinence des sources injectées. */
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
}

export interface IntentEnforcementResult {
  readonly changed: boolean;
  readonly bodyHtml: string;
  readonly citations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }>;
  readonly sourcesInjected: number;
  readonly ctaInjected: boolean;
}

/**
 * Applique le plancher déterministe (sources + CTA) selon l'intent.
 *
 * Fail-open total : si la sélection de liens échoue, on garde le contenu tel
 * quel (le contenu restera en needs_review, comportement actuel — jamais pire).
 */
export function enforceIntentRequirements(input: IntentEnforcementInput): IntentEnforcementResult {
  let bodyHtml = input.bodyHtml;
  let citations = input.citations;
  let sourcesInjected = 0;
  let ctaInjected = false;

  // 1. Plancher de sources externes (intents AEO/informationnels).
  if (SOURCE_INTENTS.has(input.intent)) {
    const present = countExternalLinks(bodyHtml);
    if (present < MIN_EXTERNAL_SOURCES) {
      const needed = MIN_EXTERNAL_SOURCES - present;
      try {
        // Sélection RELÂCHÉE (sans topic/vertical) pour GARANTIR le plancher sur
        // le catalogue national haute-autorité (~2400 liens). +2 de marge pour la
        // diversification par organisation.
        const picked = selectExternalLinks({
          count: needed + 2,
          minAuthority: 3,
          language: "fr",
          rotationMode: "round_robin",
          excludeIds: [...(input.excludeLinkIds ?? [])],
          ...(input.anchorVilleSlug ? { cityId: input.anchorVilleSlug } : {}),
          ...(input.anchorRegionSlug ? { regionSlug: input.anchorRegionSlug } : {}),
        });
        const toAdd = picked.slice(0, needed).map((l) => ({ url: l.url, title: l.title }));
        if (toAdd.length > 0) {
          bodyHtml = ensureMinExternalSources(bodyHtml, toAdd);
          sourcesInjected = toAdd.length;
          // Refléter dans citations (le validateur prend le max(citations, liens)).
          const existingUrls = new Set(citations.map((c) => c.url));
          const merged = [...citations];
          for (const l of toAdd) if (!existingUrls.has(l.url)) merged.push(l);
          citations = merged;
        }
      } catch {
        // fail-open : pas de sources dispo → on n'altère rien.
      }
    }
  }

  // 2. CTA reconnu (intent transactional).
  if (input.intent === "transactional" && !hasRecognizedCta(bodyHtml)) {
    bodyHtml = `${bodyHtml}${FALLBACK_CTA_HTML}`;
    ctaInjected = true;
  }

  return {
    changed: sourcesInjected > 0 || ctaInjected,
    bodyHtml,
    citations,
    sourcesInjected,
    ctaInjected,
  };
}
