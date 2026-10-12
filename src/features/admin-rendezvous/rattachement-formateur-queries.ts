// Les candidatures proposées pour rattacher un ÉCHANGE FORMATEUR depuis la tuile « à faire
// le point » (lot B, M17) : celles qui portent la même adresse que l'invité (empreinte,
// jamais l'adresse en clair dans la requête). Lecture seule.

import "server-only";

import { formatDateFrShort } from "@/lib/format-date-fr";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

import type { PropositionRattachement } from "./point-formateur";

export async function lirePropositionsRattachement(
  rdvs: ReadonlyArray<{ readonly id: string; readonly contactEmail: string | null }>,
): Promise<Map<string, PropositionRattachement[]>> {
  const empreintes = new Map<string, string>();
  for (const r of rdvs) {
    const h = hashEmailForLookup(r.contactEmail);
    if (h) empreintes.set(r.id, h);
  }
  const resultat = new Map<string, PropositionRattachement[]>();
  if (empreintes.size === 0) return resultat;
  const candidatures = await prisma.jobApplication.findMany({
    where: { emailHash: { in: [...new Set(empreintes.values())] } },
    orderBy: { submittedAt: "desc" },
    take: 50,
    select: { id: true, emailHash: true, submittedAt: true, offerTitleSnap: true },
  });
  for (const [rdvId, h] of empreintes) {
    resultat.set(
      rdvId,
      candidatures
        .filter((c) => c.emailHash === h)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          libelle: `Candidature du ${formatDateFrShort(c.submittedAt)}${
            c.offerTitleSnap ? ` · ${c.offerTitleSnap}` : ""
          }`,
        })),
    );
  }
  return resultat;
}
