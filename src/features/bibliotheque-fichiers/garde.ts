import "server-only";

/**
 * BIBLIOTHÈQUE DE FICHIERS — la garde de rôle et la trace (Candidatures unifiées L4, ADR 0065 D10).
 *
 * ⚠️ PAS un module `"use server"` : une garde exportée d'un module d'actions
 *    deviendrait un point d'entrée réseau (cf. `admin-job-applications/session.ts`).
 *
 * Même cloisonnement que les candidatures : les rôles qui ouvrent un dossier de
 * candidat (`ROLES_DOSSIER_CANDIDAT` — super-administrateur, administrateur,
 * responsable qualité, secrétaire). `editor` et `reader` sont refusés DANS
 * L'ACTION, pas seulement sur la page : une action serveur s'appelle sans elle.
 *
 * Chaque geste écrit une ligne `ActivityLog` (identifiant du fichier seulement,
 * jamais son nom ni son contenu).
 */

import { auth } from "@/auth";
import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import type { Auteur } from "@/server/partages/depot";

export type ResultatGarde =
  | { readonly ok: true; readonly auteur: Auteur; readonly role: string }
  | { readonly ok: false; readonly erreur: string };

export const MSG_SESSION = "Session expirée : reconnectez-vous.";
export const MSG_ROLE =
  "Votre rôle ne permet pas d'utiliser la bibliothèque de fichiers (réservée aux rôles qui ouvrent les dossiers des candidats).";

/** La session et le rôle, vérifiés. Ne lève jamais : rend la phrase du refus. */
export async function gardeBibliotheque(): Promise<ResultatGarde> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erreur: MSG_SESSION };
  const role = (session.user as { role?: string }).role ?? null;
  if (!peutOuvrirDossierCandidat(role)) return { ok: false, erreur: MSG_ROLE };
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { ok: true, auteur: { id: session.user.id, nom }, role };
}

/** Les gestes tracés. */
export type GesteBibliotheque =
  | "depot_commence"
  | "depot_repris"
  | "depot_termine"
  | "depot_abandonne"
  | "lien_ajoute"
  | "archive"
  | "reaffiche"
  | "telecharge";

/** Une ligne `ActivityLog` par geste. Best-effort : une trace manquée ne casse pas le geste. */
export async function tracerGeste(
  geste: GesteBibliotheque,
  fichierId: string,
  auteurId: string,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: auteurId,
        action: `fichier_partage.${geste}`,
        targetType: "fichier_partage",
        targetId: fichierId,
        ipAddress: await getClientIp().catch(() => null),
      },
    });
  } catch (e) {
    console.warn(`[partages] trace « ${geste} » non écrite :`, (e as Error).message);
  }
}
