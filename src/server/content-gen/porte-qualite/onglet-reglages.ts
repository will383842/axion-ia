/**
 * Porte qualité : onglet 4 de l'écran « Réglages et journal » (Q14, conception § 12.2).
 * Module PUR. Les réglages passent par le schéma Zod UNIQUE du back-end (§ 12.1) ; la liste
 * des interdits est importée et JAMAIS modifiée ici : toute modification passe par une PR
 * sur `interdits-publication.ts`. Un nombre absent s'affiche « indisponible », jamais 0.
 */

import { MOTIFS_INTERDITS } from "@/lib/contenu/interdits-publication";
import { REGLAGES_PAR_DEFAUT, ReglagesPorteSchema } from "./reglages";

export type ResultatFusion =
  { ok: true; config: Record<string, unknown> } | { ok: false; erreurs: string[] };

/** Saisie du formulaire → nouvelle config. Seules les clés du schéma sont lues ; le reste de la config est conservé tel quel. */
export function fusionnerReglages(
  configExistante: unknown,
  saisie: Readonly<Record<string, string | undefined>>,
): ResultatFusion {
  const candidat: Record<string, unknown> = {};
  const erreurs: string[] = [];
  for (const cle of Object.keys(REGLAGES_PAR_DEFAUT)) {
    const brut = saisie[cle]?.trim();
    if (!brut) {
      erreurs.push(`${cle} : valeur manquante`);
      continue;
    }
    const n = Number(brut);
    if (!Number.isFinite(n)) {
      erreurs.push(`${cle} : nombre attendu`);
      continue;
    }
    candidat[cle] = n;
  }
  if (erreurs.length > 0) return { ok: false, erreurs };
  const lu = ReglagesPorteSchema.safeParse(candidat);
  if (!lu.success) {
    return { ok: false, erreurs: lu.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`) };
  }
  const base =
    typeof configExistante === "object" &&
    configExistante !== null &&
    !Array.isArray(configExistante)
      ? (configExistante as Record<string, unknown>)
      : {};
  return { ok: true, config: { ...base, ...lu.data } };
}

export interface InterditAffiche {
  readonly code: string;
  readonly raison: string;
  readonly sauf: string | null;
}

/** Lecture seule : copie des champs d'affichage, pas du motif exécutable. */
export function listerInterdits(): ReadonlyArray<InterditAffiche> {
  return MOTIFS_INTERDITS.map((m) => ({ code: m.code, raison: m.raison, sauf: m.sauf ?? null }));
}

export interface LigneAuditLue {
  readonly id: string;
  readonly actorEmail: string | null;
  readonly createdAt: Date;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly description: string | null;
}

export interface EntreeJournal {
  readonly id: string;
  readonly qui: string;
  readonly quand: Date;
  readonly changements: ReadonlyArray<{ cle: string; avant: string; apres: string }>;
}

const objet = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const texte = (v: unknown): string =>
  v === undefined || v === null
    ? "indisponible"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export function lireJournal(lignes: ReadonlyArray<LigneAuditLue>): EntreeJournal[] {
  return lignes.map((l) => {
    const avant = objet(l.oldValue);
    const apres = objet(l.newValue);
    const cles = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].sort();
    const changements = cles
      .filter((c) => JSON.stringify(avant[c]) !== JSON.stringify(apres[c]))
      .map((cle) => ({ cle, avant: texte(avant[cle]), apres: texte(apres[cle]) }));
    return { id: l.id, qui: l.actorEmail ?? "système", quand: l.createdAt, changements };
  });
}

export interface LigneDerogationLue {
  readonly id: string;
  readonly jobId: string | null;
  readonly contentKind: string;
  readonly verdict: string;
  readonly note: number | null;
  readonly decidePar: string | null;
  readonly motifDerogation: string | null;
  readonly createdAt: Date;
}

export interface DerogationAffichee {
  readonly id: string;
  readonly jobId: string | null;
  readonly type: string;
  readonly verdict: string;
  readonly note: number | null;
  readonly decidePar: string;
  readonly motif: string;
  readonly quand: Date;
}

export function lireDerogations(lignes: ReadonlyArray<LigneDerogationLue>): DerogationAffichee[] {
  return lignes
    .filter((l) => l.decidePar !== null)
    .map((l) => ({
      id: l.id,
      jobId: l.jobId,
      type: l.contentKind,
      verdict: l.verdict,
      note: typeof l.note === "number" ? l.note : null,
      decidePar: l.decidePar as string,
      motif: l.motifDerogation ?? "indisponible",
      quand: l.createdAt,
    }));
}
