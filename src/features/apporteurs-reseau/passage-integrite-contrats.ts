/**
 * Réseau d'apporteurs — étape HEBDOMADAIRE « integrite-contrats » du passage quotidien (PR B, #2464).
 *
 * Le lundi (jour de Paris), relit au plus 200 contrats contresignés sur R2 et compare leur
 * empreinte à celle de la base. Absent → alerte critique ; altéré → alerte critique ; conforme →
 * silence. Chaque alerte part une seule fois (`jobId` stable).
 *
 * ⚠️ Aucun `server-only` : tourne dans le worker. Journaux sans donnée personnelle.
 */

import { prisma } from "@/lib/prisma";
import { getObjectBufferR2 } from "@/lib/r2-storage";

import { alerteInterne } from "./alerte-interne";
import { alerterContratAltere, empreinteConforme } from "./integrite-contrat";

export const PLAFOND_INTEGRITE_CONTRATS = 200;

export interface BilanIntegriteContrats {
  verifies: number;
  absents: number;
  alteres: number;
}

/** Vrai le lundi, à l'heure de Paris. */
export function estLundiAParis(maintenant: Date): boolean {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(
      maintenant,
    ) === "Mon"
  );
}

export async function verifierIntegriteContrats(maintenant: Date): Promise<BilanIntegriteContrats> {
  const bilan: BilanIntegriteContrats = { verifies: 0, absents: 0, alteres: 0 };
  if (!estLundiAParis(maintenant)) return bilan;

  const dossiers = await prisma.apporteurReseau.findMany({
    where: { contratSigneCle: { not: null } },
    select: { id: true, contratSigneCle: true, contratSigneSha256: true },
    orderBy: { id: "asc" },
    take: PLAFOND_INTEGRITE_CONTRATS,
  });

  for (const d of dossiers) {
    if (!d.contratSigneCle) continue;
    const octets = await getObjectBufferR2(d.contratSigneCle);
    bilan.verifies += 1;
    if (octets === null) {
      bilan.absents += 1;
      await alerteInterne({
        code: "apporteur_contrat_absent",
        niveau: "critique",
        jobId: `apporteur-contrat-absent-${d.id}`,
        titre: "Contrat contresigné introuvable",
        message: `Le PDF du contrat contresigné est introuvable sur le stockage (dossier ${d.id}).`,
        cibleType: "apporteur_reseau",
        cibleId: d.id,
        maintenant,
      });
      continue;
    }
    if (empreinteConforme(octets, d.contratSigneSha256) === "alteree") {
      bilan.alteres += 1;
      await alerterContratAltere(d.id, "signe", maintenant);
    }
  }
  return bilan;
}
