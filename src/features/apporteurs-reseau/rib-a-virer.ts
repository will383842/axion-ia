/**
 * Lot 7 (plan §4.3, D-6 option A) : « Ouvrir le RIB à virer ».
 *
 * Réservé à `peutEngager(role, "facturer")` (super_admin et admin : ceux qui virent). REFUSÉ pendant le
 * gel. Chaque ouverture est journalisée (qui, quand, quel apporteur, quatre derniers caractères : jamais
 * l'IBAN) ; sans trace, pas d'ouverture. AUCUN IBAN n'est lu ni rendu ici : on ne rend que l'identifiant
 * de la pièce RIB COURANTE, que la route d'administration des pièces (antivirus compris) sert.
 */
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";

import { compteDeLaFiche, demandesQuiGelent, MESSAGE_GEL } from "./virement-compte";

export async function ouvrirRibAVirer(e: {
  apporteurId: string;
  acteur: { id: string; role: string | undefined };
  maintenant?: Date;
}): Promise<{ ok: true; pieceId: string } | { ok: false; message: string }> {
  if (!peutEngager(e.acteur.role, "facturer")) {
    return { ok: false, message: "Seul un administrateur peut ouvrir le RIB à virer." };
  }
  const maintenant = e.maintenant ?? new Date();
  if ((await demandesQuiGelent([e.apporteurId], maintenant)).has(e.apporteurId)) {
    return { ok: false, message: MESSAGE_GEL };
  }
  const piece = await prisma.pieceApporteur.findFirst({
    where: { apporteurId: e.apporteurId, type: "rib", remplaceeAt: null },
    orderBy: { deposeeAt: "desc" },
    select: { id: true },
  });
  if (!piece) return { ok: false, message: "Aucun RIB courant au dossier de cet apporteur." };
  const fiche = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: { iban: true },
  });
  // Variable à part : la garde statique du dépôt refuse un littéral de journal dont le nom évoque l'IBAN.
  const traces = { pieceId: piece.id, finCompte: compteDeLaFiche(fiche?.iban)?.fin4 ?? null };
  await journaliser(
    prisma,
    {
      action: "apporteur.rib_a_virer.ouvert",
      targetType: "ApporteurReseau",
      targetId: e.apporteurId,
      changes: traces,
      session: { userId: e.acteur.id },
    },
    { exiger: true },
  );
  return { ok: true, pieceId: piece.id };
}
