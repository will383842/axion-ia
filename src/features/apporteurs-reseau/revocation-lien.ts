/**
 * Réseau d'apporteurs — « Révoquer et renvoyer le lien » (critique #2464, point 21).
 *
 * Le lien de l'espace n'expire pas ; la seule révocation était un effet de bord (`versionLien`).
 * Cette action console l'incrémente (l'ancien lien cesse de fonctionner aussitôt), puis renvoie
 * le lien NEUF par l'e-mail existant (`apporteur-lien-espace` pour un dossier signé, sinon
 * `apporteur-dossier-lien`, via `preparerLien`). Journalisée (`activityLog`). Console admin seulement.
 */

import { prisma } from "@/lib/prisma";

import { envoyer } from "./envois";
import { preparerLien } from "./verification";

export type RetourRevocation = { ok: true; message: string } | { ok: false; message: string };

export async function revoquerEtRenvoyerLien(
  apporteurId: string,
  parId: string,
): Promise<RetourRevocation> {
  // Rien n'est révoqué si le lien neuf ne pourrait pas partir (fiche fermée, retirée, secret absent).
  const avant = await preparerLien(apporteurId, null);
  if (!avant.ok) return { ok: false, message: avant.message };

  const r = await prisma.$transaction(async (tx) => {
    const m = await tx.apporteurReseau.updateMany({
      where: { id: apporteurId, statut: { notIn: ["refuse", "resilie"] } },
      data: { versionLien: { increment: 1 } },
    });
    if (m.count !== 1) return null;
    const a = await tx.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { versionLien: true },
    });
    await tx.activityLog.create({
      data: {
        action: "apporteur.lien_revoque",
        targetType: "apporteur_reseau",
        targetId: apporteurId,
        ...(parId ? { adminUserId: parId } : {}),
        changes: { versionLien: a?.versionLien ?? null } as object,
      },
    });
    return a?.versionLien ?? null;
  });
  if (r === null) return { ok: false, message: "Ce dossier est fermé : rien n'a été révoqué." };

  const prep = await preparerLien(apporteurId, null);
  if (!prep.ok) {
    return {
      ok: false,
      message: `Lien révoqué, mais le lien neuf n'a pas pu être préparé : ${prep.message}`,
    };
  }
  const envoi = await envoyer({ ...prep.envoi, jobId: `lien-revoque-${apporteurId}-${r}` });
  return {
    ok: true,
    message:
      envoi === "envoye"
        ? "Ancien lien révoqué, nouveau lien envoyé."
        : `Ancien lien révoqué. Le nouveau lien n'est pas parti (e-mail : ${envoi}) : utilisez « Envoyer le lien ».`,
  };
}
