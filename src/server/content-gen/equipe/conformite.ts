/**
 * Étape de conformité OBLIGATOIRE du circuit de l'équipe éditoriale (PR 10), derrière
 * `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut : seule la valeur exacte « true » allume).
 *
 * Elle enchaîne, sans dupliquer aucun motif :
 *  1. les barrières de code (`interdits-publication`, tous champs de surface) ;
 *  2. la garde de prix (`quality/price-gate`) ;
 *  3. le contrôle du vouvoiement (`quality/vouvoiement`) ;
 *  4. le contrôle de fidélité par modèle (`fact-check/fidelite-llm`), rendu OBLIGATOIRE ici
 *     même si `CONTENT_FIDELITY_CHECK` est éteint.
 *
 * ÉCHEC FERMÉ : une erreur, un dépassement de plafond ou un modèle indisponible rend
 * « relecture-humaine », jamais « publier ». `conformiteApresReecriture` rejoue l'étape sur le
 * texte FINAL (celui rendu par la réécriture). Éteint : aucun contrôle, aucun appel, décision
 * « inchange » (comportement d'avant). Ne lève jamais.
 */

import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import {
  decisionFideliteLlm,
  textePublic,
  type DependancesFideliteLlm,
} from "../fact-check/fidelite-llm";
import { detecterInterdits } from "@/lib/contenu/interdits-publication";
import { controlerSurfacePublication } from "../quality/barrieres-publication";
import { findNonSsotPrices } from "../quality/price-gate";
import { detecterTutoiement } from "../quality/vouvoiement";

export type DecisionConformite = "publier" | "relecture-humaine" | "inchange";

export interface ConstatConformite {
  /** `interdit:<code>`, `prix-hors-ssot`, `tutoiement`, `fidelite-llm`, `erreur-conformite`. */
  readonly code: string;
  readonly libelle: string;
}

export interface ResultatConformite {
  readonly actif: boolean;
  readonly decision: DecisionConformite;
  readonly constats: ReadonlyArray<ConstatConformite>;
  readonly coutUsd: number;
}

export interface EntreeConformite {
  readonly jobId: string;
  readonly contentType: string;
  /** Sortie du générateur (JSON libre), dans son état FINAL. */
  readonly output: unknown;
  readonly kbEntryIds?: ReadonlyArray<string> | null | undefined;
  /** Défaut : faux (le plus strict), comme les autres appelants hors worker de publication. */
  readonly financementPublicAutorise?: boolean;
  readonly env?: EnvEquipeEditoriale;
}

const messageErreur = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `bodyText` peut être périmé quand le HTML a été modifié après coup (sources, appel à l'action,
 * réécriture) : le HTML est ce qui est publié. On le fait primer pour le texte public ; l'ancien
 * `bodyText` est contrôlé en plus par les barrières de code (dans le doute, on refuse).
 */
function sortieNormalisee(output: Record<string, unknown>): Record<string, unknown> {
  const html = typeof output["bodyHtml"] === "string" ? output["bodyHtml"].trim() : "";
  return html ? { ...output, bodyText: "" } : output;
}

const inchange: ResultatConformite = {
  actif: false,
  decision: "inchange",
  constats: [],
  coutUsd: 0,
};

/** Les balises sont retirées (un prix peut être balisé : `<strong>3 500</strong> €`) et les montants s'écrivent aussi « 3&nbsp;500&nbsp;&euro; » : on décode avant la garde de prix. */
function decoderEntites(t: string): string {
  return t
    .replace(/&(?:nbsp|nonbreakingspace|thinsp|ensp|emsp);/gi, " ")
    .replace(/&#(?:0*(?:160|8239|8201|8194|8195)|x0*(?:a0|202f|2009));/gi, " ")
    .replace(/&(?:euro|#0*8364|#x0*20ac);/gi, "€")
    .replace(/[\u00a0\u202f\u2009]/g, " ");
}

function barrieresDeCode(
  entree: EntreeConformite,
  original: Record<string, unknown>,
): ConstatConformite[] {
  const constats: ConstatConformite[] = [];
  const opts = {
    actualite: entree.contentType === "blog_from_rss",
    financementPublicAutorise: entree.financementPublicAutorise ?? false,
  };
  const ancienCorps = typeof original["bodyText"] === "string" ? original["bodyText"] : "";
  // Texte public SANS le corps (titre, méta, FAQ…), puis le HTML BRUT : les détecteurs de
  // tutoiement (citations, code) et de prix barré lisent eux-mêmes les balises.
  const html = typeof original["bodyHtml"] === "string" ? original["bodyHtml"] : "";
  const texte = [textePublic({ ...original, bodyText: "", bodyHtml: "" }), html, ancienCorps].join(
    "\n",
  );
  const vus = new Set<string>();
  for (const v of controlerSurfacePublication(original, opts)) {
    vus.add(v.code);
    constats.push({
      code: `interdit:${v.code}`,
      libelle: `Interdit de publication « ${v.code} » dans « ${v.champ} » : ${v.extrait}`,
    });
  }
  // La surface ne lit que `bodyText` : on rejoue les mêmes motifs sur le texte public complet
  // (corps HTML compris), pour les codes pas déjà signalés.
  for (const d of detecterInterdits(texte, opts)) {
    if (vus.has(d.code)) continue;
    constats.push({
      code: `interdit:${d.code}`,
      libelle: `Interdit de publication « ${d.code} » dans le texte public : ${d.extrait}`,
    });
  }
  for (const p of findNonSsotPrices(decoderEntites(texte.replace(/<[^>]*>/g, " ")))) {
    constats.push({
      code: "prix-hors-ssot",
      libelle: `Montant hors source unique des tarifs : ${p.amount}`,
    });
  }
  const t = detecterTutoiement(texte);
  if (t.tutoie) {
    constats.push({
      code: "tutoiement",
      libelle: `Tutoiement (${t.occurrences} occurrences) : ${t.extrait}`,
    });
  }
  return constats;
}

/** Contrôle le texte tel qu'il est. Pour le texte final après réécriture, voir ci-dessous. */
export async function controlerConformite(
  entree: EntreeConformite,
  deps: DependancesFideliteLlm,
): Promise<ResultatConformite> {
  if (!equipeEditorialeActive(entree.env ?? process.env)) return inchange;
  const constats: ConstatConformite[] = [];
  let coutUsd = 0;
  let vide = false;
  try {
    vide = !estObjet(entree.output) || textePublic(entree.output).trim() === "";
  } catch {
    vide = true;
  }
  if (vide) {
    return {
      actif: true,
      decision: "relecture-humaine",
      constats: [
        {
          code: "erreur-conformite",
          libelle: "Sortie vide ou illisible : texte final NON vérifié, relecture humaine",
        },
      ],
      coutUsd: 0,
    };
  }
  let normalisee: Record<string, unknown> = {};
  let barrieresEnErreur = false;
  try {
    normalisee = sortieNormalisee(entree.output as Record<string, unknown>);
    constats.push(...barrieresDeCode(entree, entree.output as Record<string, unknown>));
  } catch (e) {
    barrieresEnErreur = true;
    constats.push({
      code: "erreur-conformite",
      libelle: `Barrières de code en erreur (${messageErreur(e)}) : texte NON vérifié`,
    });
  }
  // Pas d'appel payant au juge si le texte n'a pas pu être préparé : relecture humaine d'office.
  if (barrieresEnErreur) {
    return { actif: true, decision: "relecture-humaine", constats, coutUsd };
  }
  // Fidélité par modèle : obligatoire ici (`actif: true`), ne lève jamais.
  try {
    const f = await decisionFideliteLlm(
      {
        actif: true,
        jobId: entree.jobId,
        contentType: entree.contentType,
        output: normalisee,
        kbEntryIds: entree.kbEntryIds,
      },
      deps,
    );
    coutUsd = f.coutUsd;
    if (f.barriere) constats.push({ code: "fidelite-llm", libelle: f.barriere.libelle });
  } catch (e) {
    constats.push({
      code: "erreur-conformite",
      libelle: `Contrôle de fidélité en erreur (${messageErreur(e)}) : texte NON vérifié`,
    });
  }
  return {
    actif: true,
    decision: constats.length === 0 ? "publier" : "relecture-humaine",
    constats,
    coutUsd,
  };
}

/**
 * Rejoue l'étape sur le texte FINAL : applique d'abord la réécriture (si fournie), puis contrôle
 * son résultat — jamais l'original. Réécriture en échec → relecture humaine.
 */
export async function conformiteApresReecriture(
  entree: EntreeConformite & { readonly reecrire?: (output: unknown) => Promise<unknown> },
  deps: DependancesFideliteLlm,
): Promise<ResultatConformite> {
  if (!equipeEditorialeActive(entree.env ?? process.env)) return inchange;
  let final = entree.output;
  if (entree.reecrire) {
    try {
      final = await entree.reecrire(entree.output);
    } catch (e) {
      return {
        actif: true,
        decision: "relecture-humaine",
        constats: [
          {
            code: "erreur-conformite",
            libelle: `Réécriture en erreur (${messageErreur(e)}) : texte final NON vérifié`,
          },
        ],
        coutUsd: 0,
      };
    }
  }
  return controlerConformite({ ...entree, output: final }, deps);
}
