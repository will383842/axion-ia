/**
 * OPPOSITIONS À LA PROSPECTION, PAR LOT (lot L4-S, relecture du 25/09).
 *
 * `estOpposee()` (`server/email/opposition.ts`) interroge une adresse à la
 * fois : juste pour un clic, trop lent pour le rattrapage ou la
 * réconciliation, qui en examinent des centaines. Même calcul (empreinte HMAC
 * de l'adresse normalisée, `email_oppositions.email_hash`), en UNE requête.
 *
 * Module sans dépendance vers `crm-sync/index` : la réconciliation, que
 * `index` réexporte, peut l'importer sans cycle.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/** Les adresses (normalisées) de `emails` qui se sont opposées à la prospection. */
export async function adressesOpposees(emails: readonly string[]): Promise<Set<string>> {
  const parEmpreinte = new Map<string, string>();
  for (const e of emails) {
    const h = hashEmailForLookup(normaliser(e));
    if (h) parEmpreinte.set(h, normaliser(e));
  }
  if (parEmpreinte.size === 0) return new Set();
  const lignes = await prisma.emailOpposition.findMany({
    where: { emailHash: { in: [...parEmpreinte.keys()] } },
    select: { emailHash: true },
  });
  const opposees = new Set<string>();
  for (const l of lignes) {
    const adresse = parEmpreinte.get(l.emailHash);
    if (adresse !== undefined) opposees.add(adresse);
  }
  return opposees;
}
