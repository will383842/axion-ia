// ⚠️ Atteint par le WORKER (passage quotidien, tsx hors Next) : aucun `server-only` ici.

import { prisma } from "@/lib/prisma";

/** Présentations dont l'e-mail de prise de contact a rebondi en erreur DÉFINITIVE (adresse morte). */
export async function idsPriseDeContactRebondie(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rebonds = await prisma.emailLog.findMany({
    where: {
      template: "entreprise-prise-de-contact-apporteur",
      entityType: "PresentationEntreprise",
      entityId: { in: [...ids] },
      bounceType: "hard",
    },
    select: { entityId: true },
  });
  return new Set(rebonds.map((r) => r.entityId).filter((x): x is string => !!x));
}
