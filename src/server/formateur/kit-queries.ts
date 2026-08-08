/**
 * Espace formateur — disponibilité du kit imprimé d'une session.
 *
 * Le kit est le classeur A4 des plans B : ce que le formateur pose sur la table
 * quand l'outil tombe en panne devant la salle. Il est rattaché à la FORMATION,
 * pas à la session — mais on l'interroge par session, parce que c'est la
 * session qui porte l'appartenance vérifiable.
 *
 * Cette requête ne rend jamais d'URL : seulement de quoi décider s'il faut
 * afficher le bouton. Le lien pointe sur `/api/espace-formateur/kit/[id]`, qui
 * re-signe à la demande — une URL R2 signée expire en 900 secondes.
 */

import { prisma } from "@/lib/prisma";

import { whereSessionsDuFormateur } from "./collectif-queries";

export interface KitDisponible {
  readonly version: number;
  readonly sizeBytes: number;
  readonly publieLe: Date | null;
}

/**
 * Le kit de la formation de cette session, si le formateur y est affecté.
 *
 * `null` couvre trois cas volontairement indiscernables de l'extérieur : la
 * session n'existe pas, elle n'est pas au formateur, ou son kit n'a pas encore
 * été publié. L'appelant n'a rien à en tirer d'autre que « pas de bouton ».
 */
export async function lireKitFormateur(
  sessionId: string,
  trainerId: string,
): Promise<KitDisponible | null> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, ...whereSessionsDuFormateur(trainerId) },
    select: { formationId: true },
  });
  if (session === null) return null;

  const kit = await prisma.supportFormation.findFirst({
    where: {
      formationId: session.formationId,
      type: "kit_formateur_imprime",
      // Une clé absente = rien à télécharger : autant ne pas proposer le bouton.
      pdfKey: { not: null },
    },
    orderBy: { version: "desc" },
    select: { version: true, sizeBytes: true, generatedAt: true },
  });
  if (kit === null) return null;

  return { version: kit.version, sizeBytes: kit.sizeBytes, publieLe: kit.generatedAt };
}
