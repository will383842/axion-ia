/**
 * Formateurs — LE SEUL ÉCRIVAIN de `Trainer.actif` (lot S1, ADR 0066 étape 8).
 *
 * 🔴 Avant ce module, quatre portes écrivaient `actif` chacune à sa façon :
 * `setTrainerActifAction`, `createTrainerAction` (colonne `@default(true)`),
 * `updateTrainerAction` (passage au statut `sous_traitant` sans rien regarder)
 * et `setFormateurActifAction` (console coaching). Toutes ouvertes à `editor`,
 * aucune ne regardait une pièce. Un formateur indépendant devenait actif d'un
 * clic.
 *
 * Désormais :
 * - ACTIVER passe par {@link changerActivationFormateur}, jamais par un acteur
 *   système, et — pour un `sous_traitant` — seulement par un rôle habilité
 *   (`habiliter_formateur`) ET si la garde provisoire est remplie ;
 * - DÉSACTIVER passe par le même chemin et FERME : les sollicitations encore en
 *   attente sont retirées (les missions acceptées restent, l'alerte
 *   `formateur_desactive_encore_affecte` les signale) ;
 * - à la CRÉATION, la valeur initiale vient de {@link actifALaCreation}.
 *
 * Verrou : `ecrivain-unique.spec.ts` refuse toute autre écriture de `actif`
 * sur `Trainer` dans `src/**`.
 *
 * ⚠️ Salariés et dirigeants : comportement INCHANGÉ (ADR 0066 (a)) — la garde
 * ne les examine pas et le rôle exigé reste celui de la porte appelante.
 *
 * ⚠️ Les indépendants DÉJÀ actifs ne sont pas désactivés par ce lot : la garde
 * ne s'applique qu'aux NOUVELLES activations (mise à niveau = lot ultérieur).
 */

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { MOTIF_REFUS, peutEngager } from "@/server/auth/habilitations";
import { retirerSollicitationsDuFormateur } from "@/server/qualiopi/trainers/mission-formateur";
import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";
import {
  peutActiverFormateurIndependant,
  TYPES_PIECES_GARDEES,
  type FormateurPourActivation,
} from "./gardes";

/** L'acte qui ouvre l'activation d'un indépendant — pas `editor`. */
export const ACTE_ACTIVATION_INDEPENDANT = "habiliter_formateur" as const;

/**
 * Qui demande. Un administrateur est identifié par sa session ; un acteur
 * système (tâche de fond, import) ne peut que DÉSACTIVER.
 */
export type ActeurActivation =
  | { readonly type: "administrateur"; readonly session: AdminSession }
  | { readonly type: "systeme"; readonly source: string };

export interface ChangerActivationInput {
  readonly trainerId: string;
  readonly actif: boolean;
  readonly acteur: ActeurActivation;
  /** Raison du geste, SANS donnée personnelle (journalisée telle quelle). */
  readonly motif: string;
}

export type CodeRefusActivation =
  "motif_requis" | "acteur_systeme" | "role_insuffisant" | "garde" | "introuvable" | "erreur";

export type ResultatActivation =
  | {
      readonly ok: true;
      readonly actif: boolean;
      /** Le formateur était déjà dans cet état : rien n'a été écrit. */
      readonly inchange: boolean;
      readonly sollicitationsRetirees: number;
    }
  | {
      readonly ok: false;
      readonly code: CodeRefusActivation;
      readonly message: string;
      /** Ce qui manque, en clair, quand c'est la garde qui refuse. */
      readonly manques: ReadonlyArray<string>;
    };

const MOTIF_MAX = 200;

function refus(
  code: CodeRefusActivation,
  message: string,
  manques: ReadonlyArray<string> = [],
): ResultatActivation {
  return { ok: false, code, message, manques };
}

/** Message d'écran d'un refus : le motif, puis la liste des manques. */
export function messageRefusActivation(r: Extract<ResultatActivation, { ok: false }>): string {
  return r.manques.length === 0 ? r.message : `${r.message} ${r.manques.join(" ")}`;
}

/**
 * Valeur INITIALE de `actif` à la création d'une fiche, à étaler dans le
 * `data` du `create`.
 *
 * Un `sous_traitant` naît TOUJOURS inactif : son activation est un acte à part,
 * gardé. Pour les autres statuts, la demande est respectée et son absence
 * laisse le défaut de la colonne (comportement inchangé).
 */
export function actifALaCreation(input: {
  readonly statut: string;
  readonly actifDemande: boolean | undefined;
}): { actif?: boolean } {
  if (input.statut !== "salarie" && input.statut !== "dirigeant") return { actif: false };
  return input.actifDemande === undefined ? {} : { actif: input.actifDemande };
}

async function lireFormateurPourGarde(
  trainerId: string,
): Promise<(FormateurPourActivation & { actif: boolean }) | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      statut: true,
      actif: true,
      sousTraitantVerifieAt: true,
      sousTraitantNda: true,
      sousTraitantContratSigneAt: true,
      documents: {
        where: { type: { in: [...TYPES_PIECES_GARDEES] }, statutValidation: "valide" },
        select: {
          type: true,
          statutValidation: true,
          fichierUrl: true,
          dateEmission: true,
          dateExpiration: true,
        },
      },
    },
  });
  if (!t) return null;
  return {
    statut: t.statut,
    actif: t.actif,
    sousTraitantVerifieAt: t.sousTraitantVerifieAt ?? null,
    sousTraitantNda: t.sousTraitantNda ?? null,
    sousTraitantContratSigneAt: t.sousTraitantContratSigneAt ?? null,
    pieces: (t.documents ?? []) as DocumentConformite[],
  };
}

async function journaliser(
  input: ChangerActivationInput,
  changes: Record<string, unknown>,
): Promise<void> {
  const acteur =
    input.acteur.type === "administrateur"
      ? { acteur: "administrateur", role: input.acteur.session.role }
      : { acteur: "systeme", source: input.acteur.source };
  const payload = { actif: input.actif, motif: input.motif, ...acteur, ...changes };
  if (input.acteur.type === "administrateur") {
    // L'identité de l'administrateur est portée par `adminUserId` (session) ;
    // celle du formateur par `targetId`. Aucun nom, aucun e-mail en clair.
    await logQualiopiActivity({
      action: "qualiopi.trainer.activation",
      targetType: "Trainer",
      targetId: input.trainerId,
      changes: payload,
      session: input.acteur.session,
    });
    return;
  }
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "qualiopi.trainer.activation",
        targetType: "Trainer",
        targetId: input.trainerId,
        changes: payload as never,
      },
    });
  } catch (err) {
    console.error(
      `[formateurs-independants] journal d'activation non écrit (${input.trainerId}):`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Active ou désactive un formateur. SEUL chemin d'écriture de `actif` après
 * la création.
 *
 * Refuse (sans rien écrire) :
 * - un motif vide ;
 * - une ACTIVATION demandée par un acteur système (ADR 0066 étape 8) ;
 * - l'activation d'un `sous_traitant` par un rôle non habilité (`editor`…) ;
 * - l'activation d'un `sous_traitant` dont la garde n'est pas remplie — avec
 *   la liste des manques ;
 * - toute activation dont la lecture échoue (garde FERMÉE).
 */
export async function changerActivationFormateur(
  input: ChangerActivationInput,
): Promise<ResultatActivation> {
  const motif = (input.motif ?? "").trim().slice(0, MOTIF_MAX);
  if (motif === "") {
    return refus("motif_requis", "Le changement d'activation exige un motif.");
  }
  const demande: ChangerActivationInput = { ...input, motif };

  if (!input.actif) return desactiver(demande);

  if (input.acteur.type !== "administrateur") {
    return refus(
      "acteur_systeme",
      "Activation refusée : un formateur n'est activé que par un administrateur identifié, jamais par un traitement automatique.",
    );
  }

  let formateur: Awaited<ReturnType<typeof lireFormateurPourGarde>>;
  try {
    formateur = await lireFormateurPourGarde(input.trainerId);
  } catch {
    return refus("erreur", "Lecture du formateur impossible : activation refusée par prudence.");
  }
  if (formateur === null) return refus("introuvable", "Formateur introuvable.");
  if (formateur.actif) {
    return { ok: true, actif: true, inchange: true, sollicitationsRetirees: 0 };
  }

  if (formateur.statut !== "salarie" && formateur.statut !== "dirigeant") {
    if (!peutEngager(input.acteur.session.role, ACTE_ACTIVATION_INDEPENDANT)) {
      return refus(
        "role_insuffisant",
        `Activation refusée : ${MOTIF_REFUS[ACTE_ACTIVATION_INDEPENDANT]}`,
      );
    }
    const verdict = peutActiverFormateurIndependant(formateur);
    if (!verdict.activable) {
      return refus(
        "garde",
        "Activation refusée : le dossier du formateur indépendant est incomplet.",
        verdict.manques,
      );
    }
  }

  try {
    // Écriture CONDITIONNELLE : si la fiche a changé de statut entre la
    // lecture et l'écriture, rien n'est activé (0 ligne) — on ne valide pas
    // une garde évaluée sur un autre état.
    const r = await prisma.trainer.updateMany({
      where: { id: input.trainerId, statut: formateur.statut as never, actif: false },
      data: { actif: true },
    });
    if (r.count === 0) {
      return refus(
        "erreur",
        "La fiche a changé pendant l'activation : rechargez la page et recommencez.",
      );
    }
  } catch {
    return refus("erreur", "Erreur lors de l'activation du formateur.");
  }

  await journaliser(demande, { statut: formateur.statut });
  return { ok: true, actif: true, inchange: false, sollicitationsRetirees: 0 };
}

async function desactiver(input: ChangerActivationInput): Promise<ResultatActivation> {
  try {
    await prisma.trainer.update({ where: { id: input.trainerId }, data: { actif: false } });
  } catch {
    return refus("erreur", "Erreur lors de la désactivation du formateur.");
  }
  // La désactivation FERME : plus aucune proposition en attente ne peut être
  // acceptée. Fail-soft : la fiche est déjà inactive, c'est l'essentiel.
  const sollicitationsRetirees = await retirerSollicitationsDuFormateur(input.trainerId);
  await journaliser(input, { sollicitationsRetirees });
  return { ok: true, actif: false, inchange: false, sollicitationsRetirees };
}

/**
 * Après un changement de statut VERS `sous_traitant` : si la fiche est active
 * et que la garde n'est pas remplie, elle est désactivée (par le chemin unique).
 *
 * C'est une nouvelle activation qui ne disait pas son nom : un salarié actif
 * requalifié en indépendant devenait un indépendant actif, sans pièce.
 *
 * Garde FERMÉE : une lecture impossible désactive aussi.
 */
export async function desactiverSiGardeNonRemplie(input: {
  readonly trainerId: string;
  readonly acteur: ActeurActivation;
  readonly motif: string;
}): Promise<{ desactive: boolean; manques: ReadonlyArray<string> }> {
  let formateur: Awaited<ReturnType<typeof lireFormateurPourGarde>> = null;
  let manques: ReadonlyArray<string>;
  try {
    formateur = await lireFormateurPourGarde(input.trainerId);
    if (formateur === null) return { desactive: false, manques: [] };
    if (!formateur.actif) return { desactive: false, manques: [] };
    const verdict = peutActiverFormateurIndependant(formateur);
    if (verdict.activable) return { desactive: false, manques: [] };
    manques = verdict.manques;
  } catch {
    manques = ["Le contrôle des pièces n'a pas pu aboutir."];
  }
  const r = await changerActivationFormateur({ ...input, actif: false });
  return { desactive: r.ok, manques };
}
