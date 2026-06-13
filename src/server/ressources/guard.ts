/**
 * Espace ressources — garde de session (Node runtime, 2026-06-13).
 * Relookup DocumentRecipient ACTIF → désactiver un destinataire coupe l'accès.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyFormateurSession } from "@/lib/formateur-session";
import { getRessourcesToken } from "./cookie";
import { RESSOURCES_CONNEXION_PATH } from "./routes";

export interface RecipientSession {
  readonly recipientId: string;
  readonly email: string;
  readonly nom: string | null;
  readonly role: string;
  readonly famille: string | null;
  readonly interventionSlug: string | null;
}

export async function getRecipientSession(): Promise<RecipientSession | null> {
  const token = await getRessourcesToken();
  if (!token) return null;
  const result = await verifyFormateurSession(token, "ressources");
  if (!result.ok) return null;
  // `trainerId` ici = l'identifiant opaque du sujet = recipientId.
  const r = await prisma.documentRecipient.findUnique({
    where: { id: result.trainerId },
    select: {
      id: true,
      email: true,
      nom: true,
      role: true,
      famille: true,
      interventionSlug: true,
      actif: true,
    },
  });
  if (!r || !r.actif) return null;
  return {
    recipientId: r.id,
    email: r.email,
    nom: r.nom,
    role: r.role,
    famille: r.famille,
    interventionSlug: r.interventionSlug,
  };
}

export async function requireRecipient(): Promise<RecipientSession> {
  const session = await getRecipientSession();
  if (!session) redirect(RESSOURCES_CONNEXION_PATH);
  return session;
}

export async function requireRecipientAction(): Promise<RecipientSession> {
  const session = await getRecipientSession();
  if (!session) throw new Error("unauthorized");
  return session;
}
