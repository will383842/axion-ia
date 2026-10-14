/**
 * Espace formateur — garde de session (Node runtime, 2026-06-13).
 *
 * `getFormateurSession()` : lit + vérifie le cookie, relookup Trainer ACTIF.
 *   Retourne null si non connecté / token invalide / formateur désactivé.
 *   → la désactivation d'un formateur (`Trainer.actif=false`) coupe l'accès
 *     immédiatement (révocation, pas de cache 60 s contrairement à l'admin).
 * `requireFormateur()` : idem mais redirige vers la page de connexion si null
 *   (à utiliser dans les layouts/pages de `/espace-formateur`).
 *
 * Pour les Server Actions : utiliser `getFormateurSession()` et lever une
 * erreur explicite (pas de redirect dans une action).
 *
 * Lot E (M14) — VERSION D'ACCÈS et LECTURE SEULE après une fin de collaboration :
 *  - la session porte `versionSessionFormateur(fiche)` (tirée de la date de fin
 *    close) ; la clôture d'une fin la change, donc toute session ouverte avant tombe.
 *    Une session sans version (signée avant ce lot) ne vaut plus rien une fois la
 *    collaboration close. ⚠️ Jamais `accesVersion`, qui révoque les liens du dossier
 *    et bouge à chaque envoi du dossier par un formateur actif ;
 *  - `getFormateurSession()` (accès complet, seule porte des actions) refuse toute
 *    fiche dont la collaboration est close ;
 *  - `getFormateurSessionLecture()` rend en plus, en LECTURE SEULE, l'indépendant dont
 *    la collaboration est close, reconnecté après la fin, quand l'interrupteur
 *    `formateurs.fin_collaboration` est allumé. Seules les pages « Mes honoraires »,
 *    « Mon dossier » et le téléchargement de ses pièces la lisent.
 *
 * Lot C4 — la session porte aussi l'EMPREINTE de l'adresse e-mail à la connexion : si
 * la console change l'adresse d'un indépendant, sa session tombe.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyFormateurSession } from "@/lib/formateur-session";
import { getFormateurToken } from "./cookie";
import {
  accesFormateur,
  ecritureFormateurPermise,
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "./acces-apres-fin";
import { FORMATEUR_BASE_PATH, FORMATEUR_CONNEXION_PATH } from "./routes";

/** Où va une session en lecture seule qui ouvre une page à accès complet. */
export const FORMATEUR_LECTURE_SEULE_PATH = `${FORMATEUR_BASE_PATH}/remuneration`;

export interface FormateurSession {
  readonly trainerId: string;
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
}

export interface FormateurSessionLecture extends FormateurSession {
  /** Collaboration close : seules la lecture des honoraires et du dossier restent ouvertes. */
  readonly lectureSeule: boolean;
  readonly finCollaborationAt: Date | null;
}

/** Jeton vérifié + fiche relue, version d'accès comprise. Aucun effet de bord. */
async function lireSession() {
  const token = await getFormateurToken();
  if (!token) return null;

  const result = await verifyFormateurSession(token, "formateur");
  if (!result.ok) return null;

  const trainer = await prisma.trainer.findUnique({
    where: { id: result.trainerId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      actif: true,
      statut: true,
      finCollaborationAt: true,
    },
  });
  if (!trainer) return null;
  // Version signée et dépassée : la session a été révoquée (fin de collaboration…).
  if (result.version !== undefined && result.version !== versionSessionFormateur(trainer)) {
    return null;
  }
  // Lot C4 — adresse d'un indépendant changée depuis la connexion : la session tombe.
  // Une session sans empreinte (signée avant ce lot) n'est pas jugée sur l'adresse.
  if (
    trainer.statut === "sous_traitant" &&
    result.empreinte !== undefined &&
    result.empreinte !== empreinteSessionFormateur(trainer.email)
  ) {
    return null;
  }
  return { trainer, version: result.version };
}

/** Session formateur courante (accès complet), ou null. Aucun effet de bord. */
export async function getFormateurSession(): Promise<FormateurSession | null> {
  const lue = await lireSession();
  if (!lue) return null;
  const { trainer } = lue;
  // Garde commune des écritures (aussi celle du lien de mission) : collaboration close → rien.
  if (!trainer.actif || !ecritureFormateurPermise(lue.version, trainer)) return null;

  return {
    trainerId: trainer.id,
    nom: trainer.nom,
    prenom: trainer.prenom,
    email: trainer.email,
  };
}

/**
 * Lot E (M14) — session pour les pages de LECTURE (honoraires, dossier, pièces) :
 * l'accès complet, ou la lecture seule de l'indépendant dont la collaboration est
 * close. Aucun effet de bord.
 */
export async function getFormateurSessionLecture(): Promise<FormateurSessionLecture | null> {
  const lue = await lireSession();
  if (!lue) return null;
  const { trainer } = lue;
  const versionSignee = lue.version !== undefined;
  const identite = {
    trainerId: trainer.id,
    nom: trainer.nom,
    prenom: trainer.prenom,
    email: trainer.email,
  };
  const acces = await accesFormateur(trainer);
  if (acces === "complet") return { ...identite, lectureSeule: false, finCollaborationAt: null };
  // Lecture seule : seulement par une session ouverte APRÈS la fin (version signée et
  // à jour) ; une session sans version date d'avant ce lot, donc d'avant la fin.
  if (acces !== "lecture" || !versionSignee || trainer.finCollaborationAt == null) return null;
  return { ...identite, lectureSeule: true, finCollaborationAt: trainer.finCollaborationAt };
}

/**
 * Exige une session formateur valide — redirige vers la connexion sinon.
 * À n'appeler que depuis un Server Component (layout/page).
 */
export async function requireFormateur(): Promise<FormateurSession> {
  const session = await getFormateurSession();
  if (!session) {
    // Lot E (M14) — une session en lecture seule va vers ses honoraires, pas vers la connexion.
    if (await getFormateurSessionLecture()) redirect(FORMATEUR_LECTURE_SEULE_PATH);
    redirect(FORMATEUR_CONNEXION_PATH);
  }
  return session;
}

/** Lot E (M14) — pages de lecture : accès complet OU lecture seule ; la connexion sinon. */
export async function requireFormateurLecture(): Promise<FormateurSessionLecture> {
  const session = await getFormateurSessionLecture();
  if (!session) redirect(FORMATEUR_CONNEXION_PATH);
  return session;
}

/**
 * Variante pour Server Actions : lève une erreur au lieu de rediriger.
 */
export async function requireFormateurAction(): Promise<FormateurSession> {
  const session = await getFormateurSession();
  if (!session) throw new Error("unauthorized");
  return session;
}
