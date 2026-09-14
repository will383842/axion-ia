/**
 * PRÉSENCE d'une précision de besoin d'adaptation CHIFFRÉE, jamais son contenu.
 *
 * 🔴 Relecture de la PR 1090. Depuis le 2026-08-20, `portail.ts` retire le
 * détail du JSON des réponses et le chiffre dans `Trainee.handicapDetailsChiffre`
 * (donnée de santé, RGPD art. 9 : lecture réservée au super-administrateur,
 * journalisée). Lire le détail dans les réponses rendait donc « Non renseigné »
 * — une absence fausse sur la pièce remise à l'auditrice.
 *
 * Ce module dit seulement QUI porte une précision. La colonne chiffrée n'est
 * jamais chargée : la présence se lit par un filtre en base, et seul
 * l'identifiant revient.
 *
 * 🔑 Seul l'écran de la fiche session (console, réservée à l'administration) lit
 * cette fonction. Les pièces du dossier d'audit ne l'appellent PAS : elles ne
 * révèlent pas l'existence d'un détail de santé (minimisation). La requête est
 * bornée aux stagiaires désignés : elle ne parcourt jamais le registre.
 */

import { prisma } from "@/lib/prisma";

export async function stagiairesAvecPrecisionChiffree(
  traineeIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(traineeIds)];
  if (ids.length === 0) return new Set();
  const lignes = await prisma.trainee.findMany({
    where: { id: { in: ids }, handicapDetailsChiffre: { not: null } },
    select: { id: true },
  });
  return new Set(lignes.map((t) => t.id));
}
