/**
 * Branchement du fact-check par Claude (PR 5). Drapeau dédié `CONTENT_GEN_FACTCHECK_CLAUDE`,
 * ÉTEINT par défaut : exactement « true » allume, toute autre valeur = éteint (comportement
 * d'avant : correction OpenAI + vérification Perplexity après publication, inchangées).
 *
 * Allumé, il faut AUSSI l'interrupteur général `CONTENT_GEN_BLOG_CLAUDE` = « true » et un type
 * dans `CONTENT_GEN_CLAUDE_TYPES` : sinon éteint. Règle de Will : affirmation non vérifiée,
 * erreur, plafond atteint ou recherche indisponible = article NON publié (barrière de
 * relecture `fact-check-claude`), jamais de repli silencieux sur OpenAI ou Perplexity.
 */

import type { BarriereRelecture } from "../quality/barrieres-publication";
import { extractClaims } from "./claims-extractor";
import { verifierAffirmationsAvecClaude, type ResultatFactCheck } from "../clients/claude-search";
import { equipeEditorialeActive, type EnvEquipeEditoriale } from "./equipe-editoriale-drapeau";
import {
  verifierTexteFinal,
  type DossierPreuves,
  type ResultatVerificationFinale,
} from "./verificateur-deux-phases";

export {
  factCheckClaudeActif,
  factCheckClaudePasse,
  MARQUEUR_FACT_CHECK_CLAUDE,
  type EnvFactCheck,
} from "./fact-check-claude-drapeau";

export interface DecisionFactCheckClaude {
  readonly barriere: BarriereRelecture | null;
  /** Sources (URL) trouvées : à garder avec l'article. */
  readonly sources: ReadonlyArray<{ url: string; title: string }>;
  readonly affirmations: number;
  readonly coutUsd: number;
  readonly recherches: number;
  /** Phrases marquées À RETIRER (vérificateur en deux phases seulement ; absent sinon). */
  readonly phrasesARetirer?: ReadonlyArray<string>;
}

/** Options du vérificateur en deux phases (`CONTENT_EQUIPE_EDITORIALE`). */
export interface OptionsDeuxPhases {
  readonly env?: EnvEquipeEditoriale;
  /** Dossier de la phase A, constitué avant la rédaction. */
  readonly dossier?: DossierPreuves;
  readonly verifierFinal?: typeof verifierTexteFinal;
}

type Verifier = typeof verifierAffirmationsAvecClaude;

/** Ne lève jamais : toute erreur devient une barrière « non vérifié » (fail-closed). */
export async function decisionFactCheckClaude(
  args: {
    readonly jobId: string;
    readonly contentType: string;
    readonly texte: string;
  },
  verifier: Verifier = verifierAffirmationsAvecClaude,
  options: OptionsDeuxPhases = {},
): Promise<DecisionFactCheckClaude> {
  // Phrases dédoublonnées : un même énoncé revient une fois par motif détecté et serait payé N fois.
  const affirmations = [...new Set(extractClaims(args.texte).map((c) => c.sentence))];
  if (affirmations.length === 0) {
    return { barriere: null, sources: [], affirmations: 0, coutUsd: 0, recherches: 0 };
  }
  if (equipeEditorialeActive(options.env)) {
    return decisionDeuxPhases(args, affirmations, options);
  }
  let resultat: ResultatFactCheck;
  try {
    resultat = await verifier({
      jobId: args.jobId,
      contentType: args.contentType,
      affirmations,
    });
  } catch (err) {
    return {
      barriere: {
        code: "fact-check-claude",
        libelle: `Fact-check par Claude indisponible : article NON vérifié, relecture humaine requise (${err instanceof Error ? err.message : String(err)})`,
        detail: { erreur: true, affirmations: affirmations.length },
      },
      sources: [],
      affirmations: affirmations.length,
      coutUsd: 0,
      recherches: 0,
    };
  }
  const refutees = resultat.verdicts.filter((v) => v.statut === "refutee");
  const nonVerifiees = resultat.verdicts.filter((v) => v.statut === "non-verifiee");
  // Défense : moins de verdicts que d'affirmations = les manquantes sont NON vérifiées.
  const manquantes = Math.max(0, affirmations.length - resultat.verdicts.length);
  const base = {
    sources: resultat.sources,
    affirmations: affirmations.length,
    coutUsd: resultat.coutUsd,
    recherches: resultat.recherches,
  };
  if (refutees.length === 0 && nonVerifiees.length === 0 && manquantes === 0) {
    return { ...base, barriere: null };
  }
  return {
    ...base,
    barriere: {
      code: "fact-check-claude",
      libelle: `Fact-check par Claude : ${refutees.length} affirmation(s) contredite(s), ${nonVerifiees.length + manquantes} non vérifiée(s) — article NON publié, relecture humaine`,
      detail: {
        contredites: refutees.length,
        non_verifiees: nonVerifiees.length + manquantes,
        constats: [...refutees, ...nonVerifiees].slice(0, 20).map((v) => ({
          statut: v.statut,
          affirmation: v.affirmation,
          note: v.note,
          sources: v.sources,
        })),
      },
    },
  };
}

const DOSSIER_VIDE: DossierPreuves = {
  preuves: [],
  refusees: 0,
  recherches: 0,
  coutUsd: 0,
  sources: [],
};

/** Phase B : ne lève jamais ; erreur = barrière « non vérifié » (fail-closed). */
async function decisionDeuxPhases(
  args: { readonly jobId: string; readonly contentType: string },
  phrases: ReadonlyArray<string>,
  options: OptionsDeuxPhases,
): Promise<DecisionFactCheckClaude> {
  const dossier = options.dossier ?? DOSSIER_VIDE;
  const verifierFinal = options.verifierFinal ?? verifierTexteFinal;
  let r: ResultatVerificationFinale;
  try {
    r = await verifierFinal({
      jobId: args.jobId,
      contentType: args.contentType,
      phrases,
      dossier,
    });
  } catch (err) {
    return {
      barriere: {
        code: "fact-check-claude",
        libelle: `Vérification finale par Claude indisponible : article NON vérifié, relecture humaine requise (${err instanceof Error ? err.message : String(err)})`,
        detail: { erreur: true, affirmations: phrases.length },
      },
      sources: dossier.sources,
      affirmations: phrases.length,
      coutUsd: dossier.coutUsd,
      recherches: dossier.recherches,
    };
  }
  const base = {
    sources: r.sources,
    affirmations: phrases.length,
    coutUsd: r.coutUsd + dossier.coutUsd,
    recherches: r.recherches + dossier.recherches,
  };
  if (r.aRetirer.length === 0) return { ...base, barriere: null, phrasesARetirer: [] };
  return {
    ...base,
    phrasesARetirer: r.aRetirer,
    barriere: {
      code: "fact-check-claude",
      libelle: `Vérification finale par Claude : ${r.aRetirer.length} phrase(s) non confirmée(s), à retirer — article NON publié, relecture humaine`,
      detail: {
        a_retirer: r.aRetirer.length,
        constats: r.phrases
          .filter((p) => p.statut === "a_retirer")
          .slice(0, 20)
          .map((p) => ({ phrase: p.phrase, note: p.note })),
      },
    },
  };
}
