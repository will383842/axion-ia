/**
 * Formateurs indépendants — LECTURE des faits de la règle complète d'activation
 * (lot L9). Une seule lecture, partagée par l'écrivain unique (`activation.ts`)
 * et l'écran « Vérifier et contresigner » : l'écran montre exactement ce que la
 * garde jugera.
 *
 * Aucune donnée personnelle ne sort d'ici : l'IBAN n'est lu que pour savoir
 * s'il est présent.
 *
 * Module neutre (sans `server-only`) : `activation.ts` est aussi appelé hors
 * requête.
 */

import { prisma } from "@/lib/prisma";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";

import type { FaitsActivationComplete } from "./garde-activation-complete";

type Client = Pick<
  typeof prisma,
  "trainer" | "documentGenere" | "verificationRegistreSousTraitance" | "preuveVigilance"
>;

/** Version de gabarit d'un contrat, lue dans son instantané figé. */
export function versionDuContrat(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  return versionGabaritInstantane((metadata as Record<string, unknown>)["renderData"]);
}

/** Les faits de la règle complète, ou `null` si la fiche n'existe pas. */
export async function lireFaitsActivationComplete(
  trainerId: string,
  db: Client = prisma,
): Promise<(FaitsActivationComplete & { actif: boolean }) | null> {
  const t = await db.trainer.findUnique({
    where: { id: trainerId },
    select: {
      statut: true,
      actif: true,
      finCollaborationAt: true,
      siret: true,
      ndaVerifieListeAt: true,
      regimeTvaHonoraires: true,
      iban: true,
      declarationsVersion: true,
      habilitations: { where: { retireAt: null }, select: { id: true } },
      documents: {
        where: { type: { in: ["attestation_vigilance_urssaf", "cv"] } },
        select: {
          id: true,
          type: true,
          statutValidation: true,
          fichierUrl: true,
          dateEmission: true,
          dateExpiration: true,
        },
      },
    },
  });
  if (t === null) return null;

  const [contrats, controles, preuves] = await Promise.all([
    db.documentGenere.findMany({
      where: { trainerId, type: "contrat_sous_traitance" },
      select: { metadata: true, statutSignature: true, annuleeAt: true },
    }),
    db.verificationRegistreSousTraitance.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { verdict: true, source: true, verifieAt: true, createdAt: true, siret: true },
    }),
    db.preuveVigilance.findMany({
      where: { trainerId },
      select: { trainerDocumentId: true, resultat: true },
    }),
  ]);

  return {
    statut: t.statut,
    actif: t.actif,
    finCollaborationAt: t.finCollaborationAt ?? null,
    siret: t.siret ?? null,
    ndaVerifieListeAt: t.ndaVerifieListeAt ?? null,
    regimeTvaHonoraires: t.regimeTvaHonoraires ?? null,
    ibanPresent: typeof t.iban === "string" && t.iban !== "",
    declarationsVersion: t.declarationsVersion ?? null,
    habilitationsActives: t.habilitations.length,
    contrats: contrats.map((c) => ({
      version: versionDuContrat(c.metadata),
      statutSignature: c.statutSignature,
      annuleeAt: c.annuleeAt ?? null,
    })),
    controles,
    pieces: t.documents,
    preuvesVigilance: preuves,
  };
}
