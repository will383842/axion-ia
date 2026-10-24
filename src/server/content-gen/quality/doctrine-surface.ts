/**
 * Content Generator — doctrine sur TOUTE la surface d'une sortie.
 *
 * Avant l'audit du 24/10/2026, seul le corps (`bodyText`) était contrôlé, et
 * seul le SIREN bloquait. Ici on construit la liste des champs publiés (titre,
 * méta, slug, réponse directe, FAQ, point clé, avis d'expert, tags, attributs
 * alt/title, corps) et on décide quelles fautes sont « dures » (relecture
 * humaine obligatoire).
 *
 * Fonctions pures : aucune base, aucun Next.
 */

import type { GeneratorOutput } from "../generators/types";
import type { InterditSurface } from "@/lib/contenu/interdits-publication";
import type { DoctrineCheckResult } from "./doctrine-check";

export type SortiePourSurface = Pick<
  GeneratorOutput,
  | "title"
  | "metaTitle"
  | "metaDescription"
  | "slug"
  | "directAnswer"
  | "bodyHtml"
  | "bodyText"
  | "faq"
  | "keyTakeaway"
  | "expertQuote"
  | "tags"
>;

/** Valeurs des attributs alt="…" et title="…" (guillemets doubles ou simples). */
function attributsDepuisHtml(html: string): string {
  const valeurs: string[] = [];
  const re = /\b(?:alt|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const m of (html ?? "").matchAll(re)) {
    const v = m[1] ?? m[2] ?? "";
    if (v.trim()) valeurs.push(v);
  }
  // Le point sépare les valeurs : les motifs `[^.!?]{0,n}` ne les enjambent pas.
  return valeurs.join(" . ");
}

/**
 * Construit les champs à contrôler. Les clés servent de nom de champ dans les
 * fautes et les journaux. La FAQ est éclatée par question et par réponse pour
 * désigner précisément le champ fautif (`faq[3].reponse`).
 */
export function surfaceDepuisSortie(output: SortiePourSurface): Record<string, string | undefined> {
  const champs: Record<string, string | undefined> = {
    titre: output.title,
    metaTitre: output.metaTitle,
    metaDescription: output.metaDescription,
    // Le slug est écrit avec des tirets : on les remplace par des espaces pour
    // que les motifs de plusieurs mots (« formations gratuites ») le voient.
    slug: (output.slug ?? "").replace(/-/g, " "),
    reponseDirecte: output.directAnswer,
    pointCle: output.keyTakeaway,
    avisExpert: output.expertQuote?.text,
    tags: (output.tags ?? []).join(" . "),
    attributs: attributsDepuisHtml(output.bodyHtml),
    corps: output.bodyText,
  };
  (output.faq ?? []).forEach((item, i) => {
    champs[`faq[${i}].question`] = item.question;
    champs[`faq[${i}].reponse`] = item.answer;
  });
  return champs;
}

export interface FauteDure {
  /** SIREN/SIRET/RCS, code d'interdit, `prix-non-SSOT:…` ou phrase de la base. */
  readonly code: string;
  readonly champ?: string;
  readonly extrait?: string;
}

export interface OptionsFautesDures {
  /** `hard_fault_gate.retainNonSsotPrice` : les prix hors grille deviennent durs. */
  readonly retainNonSsotPrice?: boolean;
  /**
   * Les phrases de la base `BannedPhrase` en `severity="block"` deviennent
   * dures. Désactivé par défaut : le contenu de la table n'est pas connu en
   * production (requête R9 du plan à lire avant d'activer).
   */
  readonly retainBannedPhraseBlock?: boolean;
}

/**
 * Liste les fautes dures : toute violation de surface, le SIREN, et (selon la
 * config) les prix hors grille et les phrases de la base en `block`.
 */
export function fautesDures(
  doctrine: Pick<DoctrineCheckResult, "blockingViolations">,
  violationsSurface: ReadonlyArray<InterditSurface>,
  opts: OptionsFautesDures = {},
): FauteDure[] {
  const fautes: FauteDure[] = [];
  for (const v of doctrine.blockingViolations) {
    if (v.pattern === "SIREN/SIRET/RCS") {
      fautes.push({ code: v.pattern });
    } else if (opts.retainNonSsotPrice === true && v.pattern.startsWith("prix-non-SSOT:")) {
      fautes.push({ code: v.pattern });
    } else if (opts.retainBannedPhraseBlock === true && v.origine === "phrase-base") {
      fautes.push({ code: v.pattern });
    }
  }
  for (const s of violationsSurface) {
    fautes.push({ code: s.code, champ: s.champ, extrait: s.extrait });
  }
  return fautes;
}
