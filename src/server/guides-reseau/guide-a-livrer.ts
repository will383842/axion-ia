/**
 * QUEL GUIDE LIVRER POUR CET AIMANT ? (PR-S2b, 2026-11-14)
 *
 * 🔴 BLOQUANT : l'aimant `guide-ia` est résolu SANS AUCUNE LECTURE (ni `cibles_reseau`, ni variable
 * d'essai). Le guide-ia est en production ; la route signée peut upserter une fiche `guide-ia` dans le
 * catalogue, son titre ou son chemin ne doivent jamais décider de ce que reçoivent ses demandeurs.
 *
 * Pour un code `gde-…` : la cible doit exister, être de type `guide`, active, porter un chemin de PDF
 * sous `guides-reseau/` (la SEULE racine publique des guides du catalogue) et un titre sûr. Une cible
 * d'essai (`test`) ne se livre qu'aux adresses de `GUIDES_RESEAU_ESSAI_ADRESSES`. Toute lecture en
 * échec ferme (`indisponible`). Module sans effet de bord à l'import (la base est chargée à l'appel).
 */
import { AIMANT_GUIDE_IA } from "@/server/guide-ia/config";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { adressesEssai } from "./config";
import { validerCheminPdf, validerTitre } from "./cibles-reseau";

/** Racine unique, sous `public/`, des PDF de guides du catalogue. */
export const RACINE_GUIDES = "guides-reseau/";
/** Forme d'un code de guide du catalogue. */
export const RE_CODE_GUIDE = /^gde-[a-z0-9-]{6,24}$/;

export interface CibleLue {
  readonly code: string;
  readonly type: string;
  readonly titre: string;
  readonly cheminPdf: string | null;
  readonly actif: boolean;
  readonly test: boolean;
}

export type RaisonIndisponible =
  "inconnue" | "inactive" | "type" | "chemin" | "titre" | "essai_hors_liste" | "lecture_echec";

export type GuideALivrer =
  | { readonly kind: "guide-ia" }
  | {
      readonly kind: "catalogue";
      readonly code: string;
      readonly titre: string;
      readonly chemin: string;
    }
  | { readonly kind: "indisponible"; readonly raison: RaisonIndisponible };

/** Chemin de PDF accepté ET situé sous `guides-reseau/` (un nom de fichier, jamais un point de tête). */
export function cheminGuideAutorise(brut: unknown): string | null {
  const c = validerCheminPdf(brut);
  if (c === null || !c.startsWith(RACINE_GUIDES)) return null;
  return /^[A-Za-z0-9]/.test(c.slice(RACINE_GUIDES.length)) ? c : null;
}

/** Retours à la ligne, caractères de contrôle C0/C1 et séparateurs Unicode de ligne (en-tête e-mail). */
const CONTROLE = new RegExp("[\u0000-\u001f\u007f-\u009f\u2028\u2029]");

/** Titre de guide sûr pour un sujet d'e-mail : `validerTitre` ET aucun caractère de contrôle. */
export function titreGuideSur(brut: unknown): string | null {
  const t = validerTitre(brut);
  return t !== null && !CONTROLE.test(t) ? t : null;
}

export interface OptionsResolution {
  readonly lire?: (code: string) => Promise<CibleLue | null>;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

async function lireCible(code: string): Promise<CibleLue | null> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.cibleReseau.findUnique({
    where: { code },
    select: { code: true, type: true, titre: true, cheminPdf: true, actif: true, test: true },
  });
}

function adresseDEssai(email: string, env: Readonly<Record<string, string | undefined>>): boolean {
  const cle = hashEmailForLookup(email);
  if (cle === null) return false;
  return adressesEssai(env).some((a) => hashEmailForLookup(a) === cle);
}

export async function resoudreGuide(
  aimant: string,
  email: string,
  { lire = lireCible, env = process.env }: OptionsResolution = {},
): Promise<GuideALivrer> {
  if (aimant === AIMANT_GUIDE_IA) return { kind: "guide-ia" };
  const indispo = (raison: RaisonIndisponible): GuideALivrer => ({ kind: "indisponible", raison });
  if (typeof aimant !== "string" || !RE_CODE_GUIDE.test(aimant)) return indispo("inconnue");
  let cible: CibleLue | null;
  try {
    cible = await lire(aimant);
  } catch {
    return indispo("lecture_echec");
  }
  if (cible === null) return indispo("inconnue");
  if (cible.type !== "guide") return indispo("type");
  if (cible.actif !== true) return indispo("inactive");
  const chemin = cheminGuideAutorise(cible.cheminPdf);
  if (chemin === null) return indispo("chemin");
  const titre = titreGuideSur(cible.titre);
  if (titre === null) return indispo("titre");
  if (cible.test === true && !adresseDEssai(email, env)) return indispo("essai_hors_liste");
  return { kind: "catalogue", code: aimant, titre, chemin };
}
