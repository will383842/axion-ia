/**
 * Quels questionnaires appartiennent à une fiche client (2026-10-25, envoi SANS rendez-vous).
 *
 * Un questionnaire appartient à une fiche de deux façons : par son rendez-vous
 * (`rencontre.client_id`), ou directement (`client_id`, posé quand il est envoyé sans rendez-vous).
 *
 * Fusion de fiches : les rendez-vous changent de fiche (et reviennent à « Défaire »), mais
 * `ElementFusion` ne sait pas journaliser un questionnaire — l'ajouter demanderait une migration.
 * Un questionnaire direct RESTE donc sur la fiche absorbée, et la lecture suit les fusions non
 * défaites : « Défaire » le rend sans rien déplacer, et aucune ligne n'est jamais touchée.
 */

import { prisma } from "@/lib/prisma";

/** La fiche, plus les fiches qu'elle a absorbées (fusions non défaites, de proche en proche). */
export async function fichesCouvertes(clientId: string): Promise<string[]> {
  const vues = new Set<string>([clientId]);
  let front = [clientId];
  // Borné : une chaîne de fusions est courte, et une boucle ne doit pas tourner sans fin.
  for (let tour = 0; tour < 5 && front.length > 0; tour += 1) {
    const fusions = await prisma.clientFusion.findMany({
      where: { absorbantId: { in: front }, defaiteLe: null },
      select: { absorbeId: true },
    });
    front = fusions.map((f) => f.absorbeId).filter((id) => !vues.has(id));
    for (const id of front) vues.add(id);
  }
  return [...vues];
}

/** Le filtre Prisma « les questionnaires de ces fiches » (par rendez-vous ou directement). */
export function questionnairesDesFiches(clientIds: readonly string[]) {
  return {
    OR: [{ clientId: { in: [...clientIds] } }, { rencontre: { clientId: { in: [...clientIds] } } }],
  };
}

/**
 * La fiche qui a absorbé `clientId` (fusions non défaites, de proche en proche), ou `clientId`
 * lui-même. Sert à écrire sur la fiche que Will regarde, pas sur l'absorbée.
 */
export async function ficheVivante(clientId: string): Promise<string> {
  const vues = new Set<string>([clientId]);
  let courante = clientId;
  for (let tour = 0; tour < 5; tour += 1) {
    const fusion = await prisma.clientFusion.findFirst({
      where: { absorbeId: courante, defaiteLe: null },
      select: { absorbantId: true },
    });
    if (fusion === null || vues.has(fusion.absorbantId)) break;
    courante = fusion.absorbantId;
    vues.add(courante);
  }
  return courante;
}

/**
 * Le filtre « les questionnaires SANS rendez-vous de ces fiches » : le MÊME pour la lecture
 * (carte, « Envoyer ») et pour le dépôt, sinon un dépôt met à jour un questionnaire que la carte
 * ne montre pas et « Envoyer » envoie un autre HTML que celui que Will vient de relire.
 */
export function questionnairesDirectsDesFiches(clientIds: readonly string[]) {
  return { rencontreId: null, clientId: { in: [...clientIds] } };
}
