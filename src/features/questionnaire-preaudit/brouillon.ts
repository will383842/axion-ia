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
 *   · supprimé à l'envoi réussi de la réponse (`enregistrerReponse`), quand la personne le
 *     demande (DELETE) et avec la personne (`rgpd-erase.ts`, clic de Will) ;
 *   · ⛔ AUCUNE suppression automatique (décision de Will, 25/10) : conservé comme les réponses
 *     (5 ans, `config.ts`), supprimé à la main seulement. Aucune fonction de purge (garde
 *     `garde-structure.spec.ts`) ;
 *   · le dirigeant a un code PERSONNEL (`m`, `codeDirigeantPreaudit`, posé par le serveur dans
 *     le lien qui lui est envoyé) : un salarié qui a le lien de base ne lit pas son brouillon.
 *
 * Écrivains de la table (cliquet nominatif `aucun-envoi-automatique.spec.ts`) : ce fichier,
 * `serveur.ts` (suppression à l'envoi) et `rgpd-erase.ts`.
 */

import { prisma } from "@/lib/prisma";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";

import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";

import type { ModeReponse } from "./donnees";

/**
 * Un brouillon que personne n'a touché depuis 30 jours ne compte plus dans le plafond et ne
 * protège plus contre un vieil onglet. Il reste gardé ET rendu (rien n'est perdu ni supprimé).
 */
export const BROUILLON_INACTIF_JOURS = 30;
const JOUR_MS = 86_400_000;
/** Tolérance sur l'horloge du navigateur (un téléphone en avance d'un jour reste accepté). */
const AVANCE_MAX_MS = JOUR_MS;
/**
 * Au plus 150 brouillons VIVANTS (modifiés depuis moins de 30 jours) par questionnaire : la page
 * admet 62 personnes (60 collaborateurs, le dirigeant, le référent informatique), avec une marge
 * pour les liens personnels régénérés. Toujours borné.
 */
export const BROUILLONS_MAX_PAR_QUESTIONNAIRE = 150;

const MODES: ReadonlySet<string> = new Set(["main", "emp", "it"]);
/**
 * Code du lien personnel (`m`) : 12 caractères au moins (la page en tire 12 hexadécimaux au
 * hasard ; le dirigeant a le sien, 24 caractères). Un code devinable (« dirigeant ») est refusé.
 */
const MEMBRE = /^[A-Za-z0-9_-]{12,60}$/;

export interface Personne {
  readonly mode: ModeReponse;
  /**
   * Code du lien personnel du collaborateur ou du référent informatique. Pour le dirigeant :
   * TOUJOURS vide une fois son code vérifié (un seul code dirigeant valide par questionnaire) —
   * son code n'est donc écrit nulle part (ni en base, ni dans une clé de débit).
   */
  readonly membre: string;
}

export type ResultatPersonne =
  | { readonly ok: true; readonly personne: Personne }
  | { readonly ok: false; readonly motif: string };

/**
 * Qui écrit ou lit ce brouillon. Un CODE de lien personnel est exigé dans TOUS les parcours :
 *   · dirigeant (`main`) : SON code, vérifié (`codeDirigeantPreauditValide`) — le lien de base,
 *     que les salariés ont aussi, n'ouvre aucun brouillon ;
 *   · collaborateur et référent informatique : le code de leur lien personnel — sans lui, deux
 *     salariés partageant le même lien liraient et écraseraient le brouillon l'un de l'autre.
 */
export function personneDe(
  questionnaireId: string,
  mode: unknown,
  membre: unknown,
): ResultatPersonne {
  if (typeof mode !== "string" || !MODES.has(mode)) {
    return { ok: false, motif: "parcours_inconnu" };
  }
  const m = typeof membre === "string" ? membre.trim() : "";
  if (m === "") return { ok: false, motif: "code_personnel_requis" };
  if (!MEMBRE.test(m)) return { ok: false, motif: "code_personnel_invalide" };
  if (mode === "main" && !codeDirigeantPreauditValide(questionnaireId, m)) {
    return { ok: false, motif: "code_personnel_invalide" };
  }
  return { ok: true, personne: { mode: mode as ModeReponse, membre: mode === "main" ? "" : m } };
}

/**
 * Les réponses de CETTE personne : le dirigeant par son parcours seul (avec ou sans `membre` dans
 * sa réponse), un salarié par son parcours ET son code.
 */
export function reponsesDeLaPersonne(questionnaireId: string, p: Personne) {
  return p.mode === "main"
    ? { questionnaireId, mode: "main" }
    : { questionnaireId, mode: p.mode, membre: p.membre };
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
export function validerBrouillon(
  texte: string,
  questionnaireId: string,
  maintenant: Date = new Date(),
): ResultatBrouillon {
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
  const p = personneDe(questionnaireId, o["mode"], o["membre"]);
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

export type ResultatEnregistrement =
  | { readonly statut: "ok"; readonly horodatage: Date }
  | { readonly statut: "plus_ancien"; readonly horodatage: Date }
  | { readonly statut: "deja_envoye" }
  | { readonly statut: "trop_de_brouillons" }
  | { readonly statut: "ferme" };

/**
 * L'heure du NAVIGATEUR à l'envoi d'une réponse de CETTE personne (`envoyeLe` de la charge), ou
 * `null`. Dirigeant : seule une réponse AUTHENTIFIÉE par son code compte (lien de base sans code :
 * la réponse d'un salarié en parcours « dirigeant » n'arrête pas le brouillon du dirigeant).
 */
function envoyeLeNavigateur(
  questionnaireId: string,
  p: Personne,
  donneesChiffrees: string,
): number | null {
  try {
    const o = JSON.parse(dechiffrerParole(donneesChiffrees)) as {
      envoyeLe?: unknown;
      membre?: unknown;
    };
    if (
      p.mode === "main" &&
      (typeof o.membre !== "string" || !codeDirigeantPreauditValide(questionnaireId, o.membre))
    ) {
      return null;
    }
    const t = typeof o.envoyeLe === "string" ? Date.parse(o.envoyeLe) : Number.NaN;
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/**
 * Enregistre (ou remplace) le brouillon de cette personne. Refusé :
 *   · si celui déjà gardé est PLUS RÉCENT (un vieil onglet n'écrase pas un récent) ; à horodatage
 *     égal, le dernier reçu gagne ;
 *   · si la personne a déjà ENVOYÉ sa réponse après cet état (un enregistrement automatique en
 *     retard ne ressuscite pas le brouillon supprimé à l'envoi). Horloge du NAVIGATEUR contre
 *     horloge du NAVIGATEUR (`envoyeLe` de la réponse contre `horodatage` du brouillon), jamais
 *     l'heure du serveur contre celle du navigateur, qui peut être décalée ;
 *   · au-delà de `BROUILLONS_MAX_PAR_QUESTIONNAIRE` brouillons (`trop_de_brouillons`).
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
    const envois = await tx.questionnaireAvantAuditEnvoi.findMany({
      where: reponsesDeLaPersonne(questionnaireId, v.personne),
      select: { donnees: true },
    });
    const h = v.horodatage.getTime();
    const deLaPersonne = (d: string) => envoyeLeNavigateur(questionnaireId, v.personne, d);
    if (envois.some((e) => (deLaPersonne(e.donnees) ?? -Infinity) >= h)) {
      return { statut: "deja_envoye" };
    }
    const existant = await tx.questionnaireAvantAuditBrouillon.findUnique({
      where: cle(questionnaireId, v.personne),
      select: { horodatage: true, majLe: true },
    });
    if (existant === null) {
      // Seuls les brouillons VIVANTS (modifiés depuis moins de 30 jours) comptent.
      const n = await tx.questionnaireAvantAuditBrouillon.count({
        where: { questionnaireId, majLe: { gte: limiteInactivite(maintenant) } },
      });
      if (n >= BROUILLONS_MAX_PAR_QUESTIONNAIRE) return { statut: "trop_de_brouillons" };
    }
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

/** Le brouillon de cette personne, déchiffré, ou `null` (absent, illisible). */
export async function lireBrouillon(
  questionnaireId: string,
  p: Personne,
): Promise<{ brouillon: string; horodatage: Date } | null> {
  const l = await prisma.questionnaireAvantAuditBrouillon.findUnique({
    where: cle(questionnaireId, p),
    select: { horodatage: true, donnees: true },
  });
  if (l === null) return null;
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
