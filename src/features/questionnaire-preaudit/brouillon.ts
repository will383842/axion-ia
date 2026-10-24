/**
 * Brouillon du questionnaire de pré-audit (2026-10-24) : « zéro perte de réponses pendant le
 * remplissage ». La page est servie en bac à sable (aucun stockage local) : sans brouillon côté
 * serveur, un rechargement ou une fermeture d'onglet efface tout. Décision de Will (24/10) :
 * « brouillon enregistré côté serveur pour reprendre après fermeture : OUI ».
 *
 *   · rien n'est enregistré sans l'accord explicite de la personne (`consent: true`) ;
 *   · un brouillon par (questionnaire, parcours, code du lien personnel) : le dernier gagne, un
 *     enregistrement PLUS ANCIEN que celui gardé (vieil onglet) est refusé ;
 *   · chiffré comme les réponses (`chiffrerParole`), jamais journalisé ;
 *   · supprimé à l'envoi réussi de la réponse (`enregistrerReponse`), avec la personne
 *     (`rgpd-erase.ts`), et à 30 jours d'inactivité : PURGE À L'ACCÈS (`purgerBrouillonsInactifs`,
 *     appelée par chaque requête de brouillon, tous questionnaires confondus) et, quoi qu'il
 *     arrive, un brouillon inactif depuis 30 jours n'est JAMAIS rendu.
 *
 * Écrivains de la table (cliquet nominatif `aucun-envoi-automatique.spec.ts`) : ce fichier,
 * `serveur.ts` (suppression à l'envoi) et `rgpd-erase.ts`.
 */

import { prisma } from "@/lib/prisma";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";

import type { ModeReponse } from "./donnees";

/** Un brouillon que personne n'a touché depuis 30 jours est supprimé. */
export const BROUILLON_INACTIF_JOURS = 30;
const JOUR_MS = 86_400_000;
/** Tolérance sur l'horloge du navigateur (un téléphone en avance d'un jour reste accepté). */
const AVANCE_MAX_MS = JOUR_MS;

const MODES: ReadonlySet<string> = new Set(["main", "emp", "it"]);
/** Code du lien personnel (`m`) : celui de la page (12 caractères hexadécimaux) ou « dirigeant ». */
const MEMBRE = /^[A-Za-z0-9_-]{6,60}$/;

export interface Personne {
  readonly mode: ModeReponse;
  /** Code du lien personnel, chaîne vide pour le dirigeant sans code. */
  readonly membre: string;
}

export type ResultatPersonne =
  | { readonly ok: true; readonly personne: Personne }
  | { readonly ok: false; readonly motif: string };

/**
 * Qui écrit ce brouillon. Collaborateur et référent informatique : un CODE de lien personnel est
 * exigé — sans lui, deux salariés partageant le même lien liraient et écraseraient le brouillon
 * l'un de l'autre.
 */
export function personneDe(mode: unknown, membre: unknown): ResultatPersonne {
  if (typeof mode !== "string" || !MODES.has(mode)) {
    return { ok: false, motif: "parcours_inconnu" };
  }
  const m = typeof membre === "string" ? membre.trim() : "";
  if (m !== "" && !MEMBRE.test(m)) return { ok: false, motif: "code_personnel_invalide" };
  if (m === "" && mode !== "main") return { ok: false, motif: "code_personnel_requis" };
  return { ok: true, personne: { mode: mode as ModeReponse, membre: m } };
}

export interface BrouillonValide {
  readonly personne: Personne;
  readonly horodatage: Date;
  /** Le brouillon, texte tel qu'envoyé (rendu octet pour octet). */
  readonly brouillon: string;
}

export type ResultatBrouillon =
  | { readonly ok: true; readonly valeur: BrouillonValide }
  | { readonly ok: false; readonly motif: string };

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Module PUR : la forme du corps `{ consent, horodatage, mode, membre?, brouillon }`. */
export function validerBrouillon(texte: string, maintenant: Date = new Date()): ResultatBrouillon {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, motif: "illisible" };
  }
  const o = objet(brut);
  if (o === null) return { ok: false, motif: "illisible" };
  // ⛔ Le serveur ne garde RIEN sans l'accord explicite donné sur la page d'accueil.
  if (o["consent"] !== true) return { ok: false, motif: "consentement_requis" };
  const p = personneDe(o["mode"], o["membre"]);
  if (!p.ok) return p;
  const h = o["horodatage"];
  if (
    typeof h !== "number" ||
    !Number.isSafeInteger(h) ||
    h <= 0 ||
    h > maintenant.getTime() + AVANCE_MAX_MS
  ) {
    return { ok: false, motif: "horodatage_invalide" };
  }
  const b = o["brouillon"];
  if (typeof b !== "string" || b === "") return { ok: false, motif: "brouillon_vide" };
  return { ok: true, valeur: { personne: p.personne, horodatage: new Date(h), brouillon: b } };
}

function limiteInactivite(maintenant: Date): Date {
  return new Date(maintenant.getTime() - BROUILLON_INACTIF_JOURS * JOUR_MS);
}

const cle = (questionnaireId: string, p: Personne) => ({
  questionnaireId_mode_membre: { questionnaireId, mode: p.mode, membre: p.membre },
});

/** Purge de rétention : supprime TOUS les brouillons inactifs depuis 30 jours. */
export async function purgerBrouillonsInactifs(maintenant: Date = new Date()): Promise<number> {
  const r = await prisma.questionnaireAvantAuditBrouillon.deleteMany({
    where: { majLe: { lt: limiteInactivite(maintenant) } },
  });
  return r.count;
}

export type ResultatEnregistrement =
  | { readonly statut: "ok"; readonly horodatage: Date }
  | { readonly statut: "plus_ancien"; readonly horodatage: Date }
  | { readonly statut: "deja_envoye" }
  | { readonly statut: "ferme" };

/**
 * Enregistre (ou remplace) le brouillon de cette personne. Refusé :
 *   · si celui déjà gardé est PLUS RÉCENT (un vieil onglet n'écrase pas un récent) ; à horodatage
 *     égal, le dernier reçu gagne ;
 *   · si la personne a déjà ENVOYÉ sa réponse après cet horodatage (un enregistrement automatique
 *     en retard ne ressuscite pas le brouillon supprimé à l'envoi).
 * Même verrou que `enregistrerReponse` (`FOR UPDATE` sur le questionnaire) : un brouillon et une
 * réponse de ce questionnaire ne s'écrivent jamais en même temps.
 */
export async function enregistrerBrouillon(
  questionnaireId: string,
  v: BrouillonValide,
  maintenant: Date = new Date(),
): Promise<ResultatEnregistrement> {
  const donnees = chiffrerParole(v.brouillon);
  return prisma.$transaction(async (tx): Promise<ResultatEnregistrement> => {
    const verrou = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM questionnaires_avant_audit WHERE id = ${questionnaireId}::uuid FOR UPDATE`;
    if (verrou.length === 0) return { statut: "ferme" };
    const envoye = await tx.questionnaireAvantAuditEnvoi.count({
      where: {
        questionnaireId,
        mode: v.personne.mode,
        membre: v.personne.membre === "" ? null : v.personne.membre,
        recuLe: { gte: v.horodatage },
      },
    });
    if (envoye > 0) return { statut: "deja_envoye" };
    const existant = await tx.questionnaireAvantAuditBrouillon.findUnique({
      where: cle(questionnaireId, v.personne),
      select: { horodatage: true, majLe: true },
    });
    const vivant =
      existant !== null && existant.majLe.getTime() >= limiteInactivite(maintenant).getTime();
    if (vivant && existant.horodatage.getTime() > v.horodatage.getTime()) {
      return { statut: "plus_ancien", horodatage: existant.horodatage };
    }
    await tx.questionnaireAvantAuditBrouillon.upsert({
      where: cle(questionnaireId, v.personne),
      create: {
        questionnaireId,
        mode: v.personne.mode,
        membre: v.personne.membre,
        horodatage: v.horodatage,
        majLe: maintenant,
        donnees,
      },
      update: { horodatage: v.horodatage, majLe: maintenant, donnees },
    });
    return { statut: "ok", horodatage: v.horodatage };
  });
}

/** Le brouillon de cette personne, déchiffré, ou `null` (absent, inactif, illisible). */
export async function lireBrouillon(
  questionnaireId: string,
  p: Personne,
  maintenant: Date = new Date(),
): Promise<{ brouillon: string; horodatage: Date } | null> {
  const l = await prisma.questionnaireAvantAuditBrouillon.findUnique({
    where: cle(questionnaireId, p),
    select: { horodatage: true, majLe: true, donnees: true },
  });
  if (l === null || l.majLe.getTime() < limiteInactivite(maintenant).getTime()) return null;
  try {
    return { brouillon: dechiffrerParole(l.donnees), horodatage: l.horodatage };
  } catch {
    // clé absente ou valeur illisible : on ne rend rien (jamais de texte de remplacement)
    return null;
  }
}

/** La personne retire son accord (ou abandonne) : son brouillon est supprimé. */
export async function supprimerBrouillon(questionnaireId: string, p: Personne): Promise<number> {
  const r = await prisma.questionnaireAvantAuditBrouillon.deleteMany({
    where: { questionnaireId, mode: p.mode, membre: p.membre },
  });
  return r.count;
}
