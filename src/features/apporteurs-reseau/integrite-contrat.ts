/**
 * Réseau d'apporteurs — INTÉGRITÉ du contrat signé (point 12, PR B de l'issue #2464).
 *
 * L'empreinte SHA-256 du PDF est posée en base à la signature (`contratSha256`) et à la
 * contresignature (`contratSigneSha256`). On la REVÉRIFIE à chaque lecture et chaque semaine :
 * un fichier altéré sur R2 n'est jamais servi, et Williams est alerté une fois.
 *
 * ⚠️ Aucun `server-only` : le worker (passage quotidien) appelle ce module.
 * ⚠️ Message et journaux sans donnée personnelle ni clé R2 (elle porte l'identifiant du dossier) :
 * on ne cite que l'identifiant du dossier.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { alerteInterne } from "./alerte-interne";

export type EtatEmpreinte = "conforme" | "alteree" | "sans_reference";

/** SHA-256 hexadécimal des octets, comparé en temps constant. `attendu` nul → `sans_reference`. */
export function empreinteConforme(octets: Buffer, attendu: string | null): EtatEmpreinte {
  if (!attendu) return "sans_reference";
  const calcule = createHash("sha256").update(octets).digest();
  const reference = Buffer.from(attendu.trim().toLowerCase(), "hex");
  // Une empreinte de référence malformée (longueur ≠ 32 octets) ne peut pas correspondre.
  if (reference.length !== calcule.length) return "alteree";
  return timingSafeEqual(calcule, reference) ? "conforme" : "alteree";
}

const LIBELLE_QUEL = { apporteur: "signé par l'apporteur", signe: "contresigné" } as const;

/** Alerte critique, une seule fois par dossier et par document (`jobId` stable). */
export async function alerterContratAltere(
  apporteurId: string,
  quel: "apporteur" | "signe",
  maintenant: Date,
): Promise<boolean> {
  return alerteInterne({
    code: "apporteur_contrat_altere",
    niveau: "critique",
    jobId: `apporteur-contrat-altere-${apporteurId}-${quel}`,
    titre: "Contrat d'apporteur altéré",
    message:
      `Le PDF du contrat ${LIBELLE_QUEL[quel]} ne correspond plus à son empreinte enregistrée ` +
      `(dossier ${apporteurId}). Il n'est plus servi. Ne rien supprimer : vérifier le stockage.`,
    cibleType: "apporteur_reseau",
    cibleId: apporteurId,
    maintenant,
  });
}
