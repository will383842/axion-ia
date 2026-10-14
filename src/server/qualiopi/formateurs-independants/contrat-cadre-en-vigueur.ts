/**
 * Le contrat-cadre SIGNÉ d'un formateur, lu dans la pièce elle-même (lots S5,
 * L3) : sa version vient de l'INSTANTANÉ de rendu (`gabaritVersion`), sa date
 * de la dernière signature non révoquée. Jamais d'une date saisie seule.
 *
 * Module neutre (Prisma seulement) : lu par la console et par le worker.
 */

import { prisma } from "@/lib/prisma";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";

export interface ContratCadreSigne {
  readonly version: number;
  readonly signeLe: Date;
}

/** Le strict nécessaire d'un client Prisma (le client global, ou une transaction). */
export interface ClientContratCadre {
  documentGenere: Pick<typeof prisma.documentGenere, "findFirst">;
}

/**
 * Le dernier contrat-cadre intégralement signé et non annulé, ou `null`. `db` :
 * une transaction, pour relire la pièce sous verrou (virement d'une mission).
 */
export async function lireContratCadreSigne(
  trainerId: string,
  db: ClientContratCadre = prisma,
): Promise<ContratCadreSigne | null> {
  const contrat = await db.documentGenere.findFirst({
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
  return { version: versionGabaritInstantane(meta?.renderData), signeLe };
}
