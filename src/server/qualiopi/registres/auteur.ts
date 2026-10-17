/**
 * L09 — l'auteur RÉEL d'un geste sur un registre (réclamations, incidents).
 *
 * Une décision visible n'a de valeur que si elle dit QUI l'a prise : le nom de
 * l'administrateur connecté, relu en base, jamais saisi. À défaut de nom, le
 * rôle — c'est la règle déjà suivie par le dossier de session
 * (`dossier-verrou.ts`).
 */

import { prisma } from "@/lib/prisma";
import type { AuteurRegistre } from "./incidents-service";

/** Les automates qui écrivent dans les registres, nommés pour l'auditeur. */
export const AUTEUR_ENVOI_AUTOMATIQUE: AuteurRegistre = {
  id: null,
  nom: "Envoi automatique de l'organisme",
};
export const AUTEUR_FORMULAIRE_PUBLIC: AuteurRegistre = {
  id: null,
  nom: "Formulaire public de réclamation",
};
export const AUTEUR_EXAMEN_AUTOMATIQUE: AuteurRegistre = {
  id: null,
  nom: "Ouverture automatique (note de questionnaire)",
};

export async function auteurAdministrateur(session: {
  readonly userId: string;
  readonly role?: string;
}): Promise<AuteurRegistre> {
  const repli = session.role && session.role.trim() !== "" ? session.role : "administrateur";
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });
    const nom = typeof admin?.name === "string" ? admin.name.trim() : "";
    return { id: session.userId, nom: nom !== "" ? nom : repli };
  } catch {
    return { id: session.userId, nom: repli };
  }
}
