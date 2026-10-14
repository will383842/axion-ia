/**
 * Le contrat-cadre SIGNÉ d'un formateur, lu dans la pièce elle-même (lots S5,
 * L3) : sa version vient de l'INSTANTANÉ de rendu (`gabaritVersion`), sa date
 * de la dernière signature non révoquée. Jamais d'une date saisie seule.
 *
 * Module neutre (Prisma seulement) : lu par la console et par le worker.
 */

import { prisma } from "@/lib/prisma";
import { siretDuContrat } from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";

export interface ContratCadreSigne {
  readonly version: number;
  readonly signeLe: Date;
  /** C4 — SIRET figé dans le contrat (normalisé), ou `null` s'il est illisible. */
  readonly siret: string | null;
}

/** Le dernier contrat-cadre intégralement signé et non annulé, ou `null`. */
export async function lireContratCadreSigne(trainerId: string): Promise<ContratCadreSigne | null> {
  const contrat = await prisma.documentGenere.findFirst({
    where: {
      trainerId,
      type: "contrat_sous_traitance",
      statutSignature: "signee",
      annuleeAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      metadata: true,
      signatures: {
        where: { revokedAt: null },
        orderBy: { signeAt: "desc" },
        take: 1,
        select: { signeAt: true },
      },
    },
  });
  if (contrat === null) return null;
  const meta = contrat.metadata as { renderData?: unknown } | null;
  const signeLe = contrat.signatures[0]?.signeAt ?? null;
  if (signeLe === null) return null;
  return {
    version: versionGabaritInstantane(meta?.renderData),
    signeLe,
    siret: siretDuContrat(contrat.metadata),
  };
}
