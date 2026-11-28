/**
 * Porte qualité : POINT FINAL de la publication (Q10, conception § 3 « P3 », § 5, § 11).
 *
 * Appelé par `content-publish-worker.ts` juste avant l'insertion de l'article. Drapeau
 * `CONTENT_PORTE_QUALITE`, ÉTEINT par défaut (« true » exact) : éteint, ce module ne lit
 * rien, n'écrit rien et rend « inerte » : le comportement de publication est strictement
 * celui d'avant. Allumé : la porte rejoue `evaluerPorte` sur la sortie persistée, écrit le
 * verdict en mode « reel », et tout ce qui n'est pas « publiable » est retenu. ÉCHEC FERMÉ :
 * table absente, erreur d'écriture, sortie illisible ou erreur de la porte = rien ne part.
 *
 * B17 (coupe-circuit) n'est PAS un refus : c'est un REPORT (§ 5). Il est évalué avant la
 * porte ; un coupe-circuit actif, ou illisible, reporte sans verdict de refus.
 * Module pur : toutes les E/S sont injectées.
 */

import {
  contenuDepuisSortie,
  contexteDepuisEnv,
  ligneDepuisVerdict,
  reglagesDepuisConfig,
  type LigneVerdictEcrite,
} from "./observation";
import { evaluerPorte } from "./porte";
import { evaluerB01, evaluerB03 } from "./criteres/doctrine";
import type { ContenuPorte, Source, VerdictPorte } from "./types";

export const DRAPEAU_POINT_FINAL = "CONTENT_PORTE_QUALITE";
/** Clé `ContentGenConfig` du coupe-circuit : `{ actif: boolean, motif?: string, depuis?: string }`. */
export const CLE_COUPE_CIRCUIT = "porte_coupe_circuit";

type Env = Readonly<Record<string, string | undefined>>;

export function pointFinalActif(env: Env): boolean {
  return env[DRAPEAU_POINT_FINAL] === "true";
}

/** B17 : lit l'état brut du coupe-circuit. Illisible = report, jamais blocage (§ 5). */
export function lireCoupeCircuit(brut: unknown): Source<boolean> {
  if (brut === null || brut === undefined) return { etat: "ok", valeur: false };
  if (typeof brut === "object" && !Array.isArray(brut)) {
    const actif = (brut as { actif?: unknown }).actif;
    if (actif === true || actif === false) return { etat: "ok", valeur: actif };
    if (actif === undefined) return { etat: "ok", valeur: false };
  }
  return { etat: "indisponible", raison: "état du coupe-circuit illisible" };
}

export interface EntreeB17 {
  readonly coupeCircuit: Source<boolean>;
  /** Publications du jour, `null` tant que le plafond de sécurité n'est pas branché (Q11). */
  readonly publieAujourdhui: Source<number> | null;
  readonly plafondSecurite: number | null;
}

export interface ResultatB17 {
  readonly statut: "ok" | "reporte";
  readonly raison: string | null;
}

/** B17 : jamais un refus. `reporte` laisse le contenu en attente (pas de réécriture, pas d'abandon). */
export function evaluerB17(e: EntreeB17): ResultatB17 {
  if (e.coupeCircuit.etat !== "ok") {
    return { statut: "reporte", raison: `Coupe-circuit illisible : ${e.coupeCircuit.raison}.` };
  }
  if (e.coupeCircuit.valeur) {
    return {
      statut: "reporte",
      raison: "Coupe-circuit de la porte déclenché : publications en pause.",
    };
  }
  if (e.plafondSecurite !== null) {
    if (e.publieAujourdhui === null || e.publieAujourdhui.etat !== "ok") {
      return { statut: "reporte", raison: "Compte des publications du jour illisible." };
    }
    if (e.publieAujourdhui.valeur >= e.plafondSecurite) {
      return {
        statut: "reporte",
        raison: `Plafond de sécurité du jour atteint (${e.plafondSecurite}) : repris demain.`,
      };
    }
  }
  return { statut: "ok", raison: null };
}

export type IssuePointFinal =
  | { readonly action: "inerte" }
  | { readonly action: "publier"; readonly verdict: VerdictPorte }
  | { readonly action: "reporter"; readonly raison: string }
  | {
      readonly action: "retenir";
      /** Code court pour `errorMessage` du job. */
      readonly code: string;
      readonly raison: string;
      readonly verdict?: VerdictPorte;
    };

export interface DepsPointFinal {
  readonly lireConfig: (cle: string) => Promise<unknown>;
  readonly ecrireVerdict: (ligne: LigneVerdictEcrite) => Promise<unknown>;
  readonly maintenant: () => Date;
  readonly journal: (message: string, detail?: Record<string, unknown>) => void;
  /** Branché par Q11. Absent : pas de plafond de sécurité. */
  readonly plafondSecurite?: (() => Promise<number | null>) | undefined;
  readonly compterPublies?: (() => Promise<number>) | undefined;
}

const estTableAbsente = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2021";

export async function appliquerPointFinal(
  entree: { readonly jobId: string; readonly contentType: string; readonly sortie: unknown },
  deps: DepsPointFinal,
  env: Env,
): Promise<IssuePointFinal> {
  if (!pointFinalActif(env)) return { action: "inerte" };
  try {
    // B17 d'abord : un report ne produit aucun verdict de refus.
    let coupe: Source<boolean>;
    try {
      coupe = lireCoupeCircuit(await deps.lireConfig(CLE_COUPE_CIRCUIT));
    } catch {
      coupe = { etat: "indisponible", raison: "lecture impossible" };
    }
    let plafond: number | null = null;
    let publie: Source<number> | null = null;
    if (deps.plafondSecurite) {
      try {
        plafond = await deps.plafondSecurite();
        if (plafond !== null && deps.compterPublies) {
          publie = { etat: "ok", valeur: await deps.compterPublies() };
        }
      } catch {
        plafond = plafond ?? 0;
        publie = { etat: "indisponible", raison: "lecture impossible" };
      }
    }
    const b17 = evaluerB17({
      coupeCircuit: coupe,
      publieAujourdhui: publie,
      plafondSecurite: plafond,
    });
    if (b17.statut === "reporte") {
      deps.journal("porte_point_final_report", { jobId: entree.jobId, raison: b17.raison });
      return { action: "reporter", raison: b17.raison ?? "report" };
    }

    const maintenant = deps.maintenant();
    const contenu = contenuDepuisSortie(entree.contentType, entree.sortie, maintenant);
    if (!contenu) {
      return {
        action: "retenir",
        code: "porte_sortie_inexploitable",
        raison: "Sortie du générateur inexploitable.",
      };
    }
    let config: unknown = null;
    try {
      config = await deps.lireConfig("porte_qualite");
    } catch {
      // Réglages illisibles : défauts (figés dans la ligne écrite).
    }
    const verdict = evaluerPorte(
      contenu,
      contexteDepuisEnv(reglagesDepuisConfig(config), maintenant, env),
    );
    try {
      await deps.ecrireVerdict(ligneDepuisVerdict(entree.jobId, contenu, verdict, "reel"));
    } catch (e) {
      // Échec fermé : pas de trace du verdict, pas de publication.
      const absente = estTableAbsente(e);
      deps.journal(absente ? "porte_point_final_table_absente" : "porte_point_final_ecriture", {
        jobId: entree.jobId,
      });
      return {
        action: "retenir",
        code: absente ? "porte_table_absente" : "porte_ecriture_impossible",
        raison: "Le verdict de la porte n'a pas pu être enregistré : publication refusée.",
      };
    }
    if (verdict.verdict === "publiable") return { action: "publier", verdict };
    const ids = verdict.motifs.map((m) => m.id).join(",");
    return {
      action: "retenir",
      code: `porte_${verdict.verdict}:${ids}`.slice(0, 200),
      raison: verdict.motifs
        .map((m) => `${m.id} : ${m.raison}`)
        .join(" ; ")
        .slice(0, 600),
      verdict,
    };
  } catch (e) {
    deps.journal("porte_point_final_erreur", {
      jobId: entree.jobId,
      message: e instanceof Error ? e.message : "erreur inconnue",
    });
    return {
      action: "retenir",
      code: "porte_erreur",
      raison: "Erreur de la porte : publication refusée.",
    };
  }
}

// ── Chemins 5 et 6 (§ 11) : texte publié hors du circuit des articles ─────────────────────

export interface ControleHorsArticle {
  readonly refuse: boolean;
  readonly codes: ReadonlyArray<string>;
  readonly raison: string | null;
}

/**
 * Chemin 5 (FAQ extraites) et 6 (réécriture du corps publié) : B01 (doctrine) et B03 (prix)
 * sur le texte, sans attendre les autres critères. Drapeau éteint : ne refuse jamais.
 * Fautes de doctrine ou erreur du contrôle : refusé (échec fermé).
 */
export function controlerTexteHorsArticle(
  entree: { readonly contentType: string; readonly titre: string; readonly corpsHtml: string },
  env: Env,
): ControleHorsArticle {
  if (!pointFinalActif(env)) return { refuse: false, codes: [], raison: null };
  try {
    const contenu: ContenuPorte = {
      contentType: entree.contentType,
      titre: entree.titre,
      metaDescription: null,
      corpsHtml: entree.corpsHtml,
      directAnswer: null,
      keyTakeaway: null,
      champsSupplementaires: {},
      auteur: null,
      datePublished: null,
      dateModified: null,
    };
    const x = contexteDepuisEnv(reglagesDepuisConfig(null), new Date(0), env);
    const echecs = [
      ["B01", evaluerB01(contenu, x)],
      ["B03", evaluerB03(contenu)],
    ] as const;
    const ko = echecs.filter(([, r]) => r.statut !== "ok");
    if (ko.length === 0) return { refuse: false, codes: [], raison: null };
    return {
      refuse: true,
      codes: ko.map(([id]) => id),
      raison: ko.map(([id, r]) => `${id} : ${r.raison ?? "non satisfait"}`).join(" ; "),
    };
  } catch {
    return { refuse: true, codes: ["ERREUR"], raison: "Erreur du contrôle : texte refusé." };
  }
}
