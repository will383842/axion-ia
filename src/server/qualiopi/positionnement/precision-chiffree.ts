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
import { PREFIX_V1 } from "@/lib/pii-crypto";

export async function stagiairesAvecPrecisionChiffree(
  traineeIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(traineeIds)];
  if (ids.length === 0) return new Set();
  const lignes = await prisma.trainee.findMany({
    // 🔴 `startsWith` et non `{ not: null }` : cette fonction s'appelle
    // « avec précision CHIFFRÉE », et « non vide » ne veut pas dire « chiffré ».
    // Une valeur héritée ou posée hors des chemins gardés serait comptée comme
    // chiffrée — l'écran affirmerait à l'administration que la précision est
    // protégée alors qu'elle ne l'est pas. Un nom qui promet plus que le
    // prédicat ne tient est un mensonge qui ne rougit jamais.
    where: { id: { in: ids }, handicapDetailsChiffre: { startsWith: PREFIX_V1 } },
    select: { id: true },
  });
  return new Set(lignes.map((t) => t.id));
}
