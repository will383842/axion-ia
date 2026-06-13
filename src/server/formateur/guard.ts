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
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyFormateurSession } from "@/lib/formateur-session";
import { getFormateurToken } from "./cookie";
import { FORMATEUR_CONNEXION_PATH } from "./routes";

export interface FormateurSession {
  readonly trainerId: string;
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
}

/** Session formateur courante, ou null. Aucun effet de bord. */
export async function getFormateurSession(): Promise<FormateurSession | null> {
  const token = await getFormateurToken();
  if (!token) return null;

  const result = await verifyFormateurSession(token);
  if (!result.ok) return null;

  const trainer = await prisma.trainer.findUnique({
    where: { id: result.trainerId },
    select: { id: true, nom: true, prenom: true, email: true, actif: true },
  });
  if (!trainer || !trainer.actif) return null;

  return {
    trainerId: trainer.id,
    nom: trainer.nom,
    prenom: trainer.prenom,
    email: trainer.email,
  };
}

/**
 * Exige une session formateur valide — redirige vers la connexion sinon.
 * À n'appeler que depuis un Server Component (layout/page).
 */
export async function requireFormateur(): Promise<FormateurSession> {
  const session = await getFormateurSession();
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
