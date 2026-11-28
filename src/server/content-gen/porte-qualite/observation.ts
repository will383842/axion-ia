/**
 * Porte qualité : branchement EN OBSERVATION (Q7, conception § 3 règle 5, § 10.1, § 15).
 *
 * La porte NOTE le contenu que le générateur vient de produire et écrit son verdict dans
 * `content_quality_verdicts` (mode « ombre »). Elle ne décide de rien : aucun statut de
 * job, aucune file de revue, aucune publication n'en dépend, et aucune erreur n'en sort
 * (la fonction ne lève jamais). Interrupteur `CONTENT_PORTE_OBSERVATION`, ÉTEINT par
 * défaut, « true » exact. Le drapeau du point final (`CONTENT_PORTE_QUALITE`, PR Q10) est
 * un autre drapeau : il n'est ni lu ni posé ici.
 *
 * Entrées/sorties injectées (`DepsObservation`) : ce module ne touche aucune base.
 * Sources non branchées en observation (liens, page propriétaire) : « indisponible », donc
 * critère « non évalué » (échec fermé, § 3 règle 2) ; c'est visible à l'écran, pas caché.
 */

import { evaluerPorte } from "./porte";
import { REGLAGES_PAR_DEFAUT, ReglagesPorteSchema, type ReglagesPorte } from "./reglages";
import type { ContenuPorte, ContextePorte, VerdictPorte } from "./types";

export const DRAPEAU_OBSERVATION = "CONTENT_PORTE_OBSERVATION";
/** Clé unique `ContentGenConfig` des réglages (§ 12.1). */
export const CLE_CONFIG_PORTE = "porte_qualite";

export function observationActive(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[DRAPEAU_OBSERVATION] === "true";
}

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Sortie du générateur (`ContentGenJob.outputJsonRaw`) → contenu à noter. `null` = inexploitable. */
export function contenuDepuisSortie(
  contentType: string,
  sortie: unknown,
  maintenant: Date = new Date(0),
): ContenuPorte | null {
  if (typeof sortie !== "object" || sortie === null || Array.isArray(sortie)) return null;
  const s = sortie as Record<string, unknown>;
  const corpsHtml = texte(s.bodyHtml);
  if (!corpsHtml) return null;
  return {
    contentType,
    titre: texte(s.title) ?? "",
    metaDescription: texte(s.metaDescription),
    corpsHtml,
    directAnswer: texte(s.directAnswer),
    keyTakeaway: texte(s.keyTakeaway),
    champsSupplementaires: champsSupplementaires(s),
    // Auteur et date sont fixés à la publication (organisation du site, jour de publication) :
    // l'observation les rejoue tels que la publication les posera, sans quoi B14 échouerait
    // à tort sur 100 % des contenus.
    auteur: { nom: "Axion-IA", type: "Organization", reel: true },
    datePublished: maintenant.toISOString().slice(0, 10),
    dateModified: null,
  };
}

/** Toute la surface de texte du générateur, pour la doctrine (B01) : FAQ, citation, balises, image. */
function champsSupplementaires(s: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const poser = (k: string, v: unknown) => {
    const t = texte(v);
    if (t) out[k] = t;
  };
  poser("metaTitle", s.metaTitle);
  poser("slug", s.slug);
  poser("heroImageAlt", s.heroImageAlt);
  if (Array.isArray(s.faq)) {
    const f = s.faq
      .map((q) => {
        const o = (q ?? {}) as Record<string, unknown>;
        return [texte(o.question), texte(o.answer)].filter(Boolean).join(" ");
      })
      .filter(Boolean)
      .join("\n");
    poser("faq", f);
  }
  const eq = s.expertQuote as Record<string, unknown> | undefined;
  poser("expertQuote", eq?.text);
  if (Array.isArray(s.tags)) poser("tags", s.tags.filter((t) => typeof t === "string").join(" "));
  return out;
}

/** Config stockée → réglages du schéma : clés connues seulement (le reste est de l'affichage), défauts pour le reste. */
export function reglagesDepuisConfig(valeur: unknown): ReglagesPorte {
  const fusion: Record<string, unknown> = { ...REGLAGES_PAR_DEFAUT };
  if (typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)) {
    const brut = valeur as Record<string, unknown>;
    for (const cle of Object.keys(REGLAGES_PAR_DEFAUT)) {
      if (cle in brut && brut[cle] !== undefined) fusion[cle] = brut[cle];
    }
  }
  const lus = ReglagesPorteSchema.safeParse(fusion);
  return lus.success ? lus.data : REGLAGES_PAR_DEFAUT;
}

/** Contexte de la porte tel que le worker le connaît (sources de liens non branchées : « indisponible »). */
export function contexteDepuisEnv(
  reglages: ReglagesPorte,
  maintenant: Date,
  env: Readonly<Record<string, string | undefined>>,
): ContextePorte {
  return {
    reglages,
    maintenant,
    financementPublicAutorise: env.OF_PUBLIC_DISCLOSURE_ENABLED === "true",
    hotesInternes: ["axion-ia.com", "www.axion-ia.com"],
    etatLiens: { etat: "indisponible", raison: "non branché en observation" },
    pageProprietaire: { etat: "indisponible", raison: "non branché en observation" },
    corpsDejaPublie: { etat: "ok", valeur: null },
    penalites: {},
  };
}

/** false si les clés stockées violent le schéma : `reglagesDepuisConfig` retombe alors sur les défauts en bloc. */
export function reglagesStockesValides(valeur: unknown): boolean {
  const fusion: Record<string, unknown> = { ...REGLAGES_PAR_DEFAUT };
  if (typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)) {
    const brut = valeur as Record<string, unknown>;
    for (const cle of Object.keys(REGLAGES_PAR_DEFAUT)) {
      if (cle in brut && brut[cle] !== undefined) fusion[cle] = brut[cle];
    }
  }
  return ReglagesPorteSchema.safeParse(fusion).success;
}

export interface LigneVerdictEcrite {
  readonly jobId: string;
  readonly contentKind: string;
  readonly versionPorte: string;
  readonly mode: "ombre" | "reel";
  readonly verdict: string;
  readonly note: number;
  /** Enveloppe relue telle quelle par l'écran (titre, critères, motifs, critères absents). */
  readonly criteres: {
    readonly titre: string;
    readonly criteres: VerdictPorte["criteres"];
    readonly motifs: VerdictPorte["motifs"];
    readonly criteresAbsents: VerdictPorte["criteresAbsents"];
  };
  readonly seuilsFiges: ReglagesPorte;
}

export function ligneDepuisVerdict(
  jobId: string,
  contenu: ContenuPorte,
  v: VerdictPorte,
  mode: "ombre" | "reel" = "ombre",
): LigneVerdictEcrite {
  return {
    jobId,
    contentKind: contenu.contentType.slice(0, 40),
    versionPorte: v.versionPorte,
    mode,
    verdict: v.verdict,
    note: v.note,
    criteres: {
      titre: contenu.titre,
      criteres: v.criteres,
      motifs: v.motifs,
      criteresAbsents: v.criteresAbsents,
    },
    seuilsFiges: v.seuilsFiges,
  };
}

export interface DepsObservation {
  readonly creer: (ligne: LigneVerdictEcrite) => Promise<unknown>;
  readonly lireConfig: () => Promise<unknown>;
  readonly maintenant: () => Date;
  readonly journal: (message: string, detail?: Record<string, unknown>) => void;
}

export type IssueObservation = "eteint" | "saute" | "ecrit" | "table_absente" | "erreur";

export interface EntreeObservation {
  readonly jobId: string;
  readonly contentType: string;
  readonly sortie: unknown;
}

const estTableAbsente = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2021";

/** Ne lève JAMAIS, ne modifie rien d'autre que sa ligne de verdict. */
export async function observerSortie(
  entree: EntreeObservation,
  deps: DepsObservation,
  env: Readonly<Record<string, string | undefined>>,
): Promise<IssueObservation> {
  if (!observationActive(env)) return "eteint";
  try {
    const contenu = contenuDepuisSortie(entree.contentType, entree.sortie, deps.maintenant());
    if (!contenu) {
      deps.journal("porte_observation_saut", {
        jobId: entree.jobId,
        raison: "sortie_inexploitable",
      });
      return "saute";
    }
    let config: unknown = null;
    try {
      config = await deps.lireConfig();
    } catch {
      // Config illisible : réglages par défaut ; ils sont figés dans la ligne écrite.
    }
    const contexte = contexteDepuisEnv(reglagesDepuisConfig(config), deps.maintenant(), env);
    const verdict = evaluerPorte(contenu, contexte);
    await deps.creer(ligneDepuisVerdict(entree.jobId, contenu, verdict));
    return "ecrit";
  } catch (e) {
    if (estTableAbsente(e)) {
      deps.journal("porte_observation_table_absente", { jobId: entree.jobId });
      return "table_absente";
    }
    deps.journal("porte_observation_erreur", {
      jobId: entree.jobId,
      message: e instanceof Error ? e.message : "erreur inconnue",
    });
    return "erreur";
  }
}
