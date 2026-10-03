/**
 * Qualiopi — État des fonds des OPCO (lot OPCO A5). Module PUR.
 *
 * Les enveloppes OPCO s'épuisent en cours d'année : un OPCO peut SUSPENDRE le
 * financement d'une branche, et chaque OPCO a ses dates limites de dépôt. Les
 * relevés (`EtatFondsOpco`) sont versionnés par AJOUT : pour un couple
 * (opco, idcc), le dernier relevé — `releveLe`, puis `createdAt` — fait foi.
 *
 * Résolution : le relevé de la BRANCHE (opco, idcc) l'emporte sur celui de
 * l'OPCO entier (opco, NULL). Une suspension dont le périmètre dit « moins de
 * 50 salariés » ne vaut pas pour une entreprise de 50 salariés et plus : on
 * retombe alors sur la ligne de l'OPCO entier (la fiche dit déjà ailleurs que
 * l'entreprise relève des fonds conventionnels). Effectif inconnu : prudence,
 * la suspension s'affiche.
 *
 * Aucun accès base ici : la lecture est dans `etat-fonds-opco-lecture.ts`.
 */

import { z } from "zod";

import { OPCO_IDS } from "./opco-referentiel";

export const STATUTS_FONDS = ["ouvert", "reduit", "suspendu"] as const;
export type StatutFonds = (typeof STATUTS_FONDS)[number];

export const STATUT_FONDS_LABELS: Record<StatutFonds, string> = {
  ouvert: "Ouvert",
  reduit: "Réduit",
  suspendu: "Suspendu",
};

/** Un relevé tel que lu en base (sous-ensemble de `EtatFondsOpco`). */
export interface ReleveEtatFonds {
  id: string;
  opco: string;
  idcc: string | null;
  statut: StatutFonds;
  perimetre: string | null;
  dateLimiteDepot: Date | null;
  sourceUrl: string;
  releveLe: Date;
  note: string | null;
  createdAt: Date;
}

export interface EtatFonds {
  statut: StatutFonds;
  dateLimiteDepot: Date | null;
  depasse: boolean;
  source: string;
  releveLe: Date;
  note: string | null;
}

/** Seuil lu dans le périmètre : « moins de 50 salariés ». */
const MOINS_DE_50 = /moins de 50 salari/i;
export const SEUIL_EFFECTIF_SUSPENSION = 50;

/** « 573 », « IDCC 0573 », « 0573 » → « 0573 » ; tout le reste → null. */
export function normaliserIdcc(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length === 0 || chiffres.length > 4) return null;
  return chiffres.padStart(4, "0");
}

/** Jour civil de Paris, AAAA-MM-JJ. */
function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Une colonne `@db.Date` arrive à minuit UTC : son jour est sa partie ISO. */
function jourDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** JJ/MM/AAAA d'une colonne `@db.Date`. */
export function formatJourDate(d: Date): string {
  const [a, m, j] = jourDate(d).split("-");
  return `${j}/${m}/${a}`;
}

/** Ordre « le plus récent d'abord » : releveLe, puis createdAt. */
function plusRecentDabord(a: ReleveEtatFonds, b: ReleveEtatFonds): number {
  return (
    b.releveLe.getTime() - a.releveLe.getTime() || b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/** Le relevé qui fait foi pour chaque couple (opco, idcc). */
export function relevesEnVigueur<T extends ReleveEtatFonds>(releves: readonly T[]): T[] {
  const vus = new Map<string, T>();
  for (const r of [...releves].sort(plusRecentDabord)) {
    const cle = `${r.opco}|${r.idcc ?? ""}`;
    if (!vus.has(cle)) vus.set(cle, r);
  }
  return [...vus.values()];
}

function versEtat(r: ReleveEtatFonds, aLaDate: Date): EtatFonds {
  return {
    statut: r.statut,
    dateLimiteDepot: r.dateLimiteDepot,
    depasse: r.dateLimiteDepot !== null && jourParis(aLaDate) > jourDate(r.dateLimiteDepot),
    source: r.sourceUrl,
    releveLe: r.releveLe,
    note: r.note,
  };
}

export function etatFondsPour(input: {
  opco: string | null | undefined;
  idcc: string | null | undefined;
  effectif: number | null | undefined;
  aLaDate: Date;
  releves: readonly ReleveEtatFonds[];
}): EtatFonds | null {
  const { opco, effectif, aLaDate } = input;
  if (!opco) return null;
  const idcc = normaliserIdcc(input.idcc);
  // Un relevé daté après `aLaDate` n'était pas encore connu à cette date.
  const connus = input.releves.filter(
    (r) => r.opco === opco && jourDate(r.releveLe) <= jourParis(aLaDate),
  );
  const [branche] = idcc ? connus.filter((r) => r.idcc === idcc).sort(plusRecentDabord) : [];
  const [opcoEntier] = connus.filter((r) => r.idcc === null).sort(plusRecentDabord);

  const brancheIgnoree =
    branche !== undefined &&
    branche.statut !== "ouvert" &&
    MOINS_DE_50.test(branche.perimetre ?? "") &&
    effectif != null &&
    effectif >= SEUIL_EFFECTIF_SUSPENSION;

  const retenu = branche && !brancheIgnoree ? branche : opcoEntier;
  return retenu ? versEtat(retenu, aLaDate) : null;
}

/** Veille mensuelle : au-delà, l'alerte `etat_fonds_perime` est levée. */
export const VEILLE_ETAT_FONDS_JOURS = 31;

/** Vrai si le relevé (colonne `@db.Date`) a plus de 31 jours, en jours civils de Paris. */
export function estEtatFondsPerime(releveLe: Date, now: Date): boolean {
  const jours = (Date.parse(jourParis(now)) - Date.parse(jourDate(releveLe))) / 86_400_000;
  return jours > VEILLE_ETAT_FONDS_JOURS;
}

export interface Bandeau {
  ton: "rouge" | "orange";
  texte: string;
  source: string;
  note: string | null;
}

/** Ce que la fiche client ou devis affiche ; `null` = rien. */
export function bandeauEtatFonds(etat: EtatFonds | null): Bandeau | null {
  if (!etat) return null;
  const commun = { source: etat.source, note: etat.note };
  if (etat.statut === "suspendu") {
    return {
      ton: "rouge",
      texte: `Financement suspendu pour cette branche (relevé du ${formatJourDate(etat.releveLe)})`,
      ...commun,
    };
  }
  if (etat.dateLimiteDepot) {
    const date = formatJourDate(etat.dateLimiteDepot);
    return {
      ton: "orange",
      texte: etat.depasse
        ? `Date limite dépassée (dépôt avant le ${date})`
        : `Dépôt avant le ${date}`,
      ...commun,
    };
  }
  if (etat.statut === "reduit") {
    return {
      ton: "orange",
      texte: `Financement réduit pour cette branche (relevé du ${formatJourDate(etat.releveLe)})`,
      ...commun,
    };
  }
  return null;
}

// ── Saisie console ──────────────────────────────────────────────────────────

const jourSaisi = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue AAAA-MM-JJ");
const vide = (v: unknown) => (v === "" ? null : v);

/** Schéma d'un nouveau relevé. La source est OBLIGATOIRE et en https. */
export const releveEtatFondsSchema = z.object({
  opco: z.enum(OPCO_IDS),
  idcc: z.preprocess(
    vide,
    z
      .string()
      .regex(/^[0-9]{4}$/, "IDCC à quatre chiffres")
      .nullable()
      .optional(),
  ),
  statut: z.enum(STATUTS_FONDS),
  perimetre: z.preprocess(vide, z.string().trim().max(200).nullable().optional()),
  dateLimiteDepot: z.preprocess(vide, jourSaisi.nullable().optional()),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((u) => u.startsWith("https://"), "La source doit être une adresse https"),
  releveLe: jourSaisi,
  note: z.preprocess(vide, z.string().trim().max(2000).nullable().optional()),
});

export type ReleveEtatFondsSaisi = z.infer<typeof releveEtatFondsSchema>;
