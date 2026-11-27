/**
 * Porte qualité : données de l'écran de console (Q8, § 12). Module PUR, lecture seule.
 * L'écran n'a pas de vérité propre : critères = registre, réglages = schéma du back-end,
 * verdicts = lignes de `content_quality_verdicts` relues telles quelles (§ 12.1).
 */

import { reglagesDepuisConfig } from "./observation";
import { CRITERES } from "./registre";
import { VERSION_PORTE, type ReglagesPorte } from "./reglages";
import type { ResultatCritere, Source } from "./types";

export interface LigneVerdictLue {
  readonly id: string;
  readonly jobId: string | null;
  readonly contentKind: string;
  readonly versionPorte: string;
  readonly mode: string;
  readonly verdict: string;
  readonly note: number | null;
  readonly criteres: unknown;
  readonly createdAt: Date;
}

export interface VerdictAffiche {
  readonly id: string;
  readonly jobId: string | null;
  readonly type: string;
  readonly versionPorte: string;
  readonly mode: string;
  readonly verdict: string;
  /** `null` = indisponible, jamais 0. */
  readonly note: number | null;
  readonly titre: string | null;
  readonly criteres: ReadonlyArray<ResultatCritere>;
  readonly creeLe: Date;
}

const STATUTS = new Set(["ok", "echec", "non_evalue"]);

function lireCriteres(brut: unknown): { titre: string | null; criteres: ResultatCritere[] } {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { titre: null, criteres: [] };
  }
  const o = brut as Record<string, unknown>;
  const liste = Array.isArray(o.criteres) ? o.criteres : [];
  const criteres = liste.filter(
    (c): c is ResultatCritere =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { id?: unknown }).id === "string" &&
      STATUTS.has((c as { statut?: string }).statut ?? ""),
  );
  return { titre: typeof o.titre === "string" ? o.titre : null, criteres };
}

export function lireLigneVerdict(l: LigneVerdictLue): VerdictAffiche {
  const { titre, criteres } = lireCriteres(l.criteres);
  return {
    id: l.id,
    jobId: l.jobId,
    type: l.contentKind,
    versionPorte: l.versionPorte,
    mode: l.mode,
    verdict: l.verdict,
    note: typeof l.note === "number" ? l.note : null,
    titre,
    criteres,
    creeLe: l.createdAt,
  };
}

export interface RaisonRefus {
  readonly id: string;
  readonly libelle: string;
  readonly nombre: number;
}

export interface VueVerdicts {
  readonly total: number;
  readonly parVerdict: Readonly<Record<string, number>>;
  readonly raisons: ReadonlyArray<RaisonRefus>;
  readonly lignes: ReadonlyArray<VerdictAffiche>;
}

export interface VuePorte {
  readonly interrupteurActif: boolean;
  readonly versionPorte: string;
  readonly phase: string | null;
  readonly mode: string | null;
  /** Limite haute, jamais un objectif. `null` = indisponible. */
  readonly plafondSecuriteParJour: number | null;
  readonly reglagesPorte: ReglagesPorte;
  readonly criteres: ReadonlyArray<{
    id: string;
    libelle: string;
    famille: string;
    classe: string;
    derogation: boolean;
    seuil: string;
  }>;
  readonly verdicts: Source<VueVerdicts>;
}

const chaine = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function construireVue(entree: {
  config: unknown;
  interrupteurActif: boolean;
  lignes: Source<ReadonlyArray<LigneVerdictLue>>;
}): VuePorte {
  const cfg =
    typeof entree.config === "object" && entree.config !== null
      ? (entree.config as Record<string, unknown>)
      : {};
  const reglagesPorte = reglagesDepuisConfig(entree.config);
  const libelles = new Map(CRITERES.map((c) => [c.id, c.libelle]));

  let verdicts: Source<VueVerdicts>;
  if (entree.lignes.etat === "indisponible") {
    verdicts = entree.lignes;
  } else {
    const lignes = entree.lignes.valeur.map(lireLigneVerdict);
    const parVerdict: Record<string, number> = {};
    const comptes = new Map<string, number>();
    for (const l of lignes) {
      parVerdict[l.verdict] = (parVerdict[l.verdict] ?? 0) + 1;
      for (const c of l.criteres) {
        if (c.statut !== "ok") comptes.set(c.id, (comptes.get(c.id) ?? 0) + 1);
      }
    }
    const raisons = [...comptes]
      .map(([id, nombre]) => ({ id, libelle: libelles.get(id) ?? id, nombre }))
      .sort((a, b) => b.nombre - a.nombre || a.id.localeCompare(b.id));
    verdicts = { etat: "ok", valeur: { total: lignes.length, parVerdict, raisons, lignes } };
  }

  return {
    interrupteurActif: entree.interrupteurActif,
    versionPorte: VERSION_PORTE,
    phase: chaine(cfg.phase),
    mode: chaine(cfg.mode),
    plafondSecuriteParJour:
      typeof cfg.plafondSecuriteParJour === "number" ? cfg.plafondSecuriteParJour : null,
    reglagesPorte,
    criteres: CRITERES.map((c) => ({
      id: c.id,
      libelle: c.libelle,
      famille: c.famille,
      classe: c.classe,
      derogation: c.derogation,
      seuil: c.seuil(reglagesPorte),
    })),
    verdicts,
  };
}
