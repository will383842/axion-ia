/**
 * Qualiopi — Service consentement RGPD versionné (T15 AGENT C).
 *
 * enregistrerConsentement : enregistre (ou met à jour) le consentement d'un
 *   stagiaire pour une version de politique donnée + flags granulaires.
 *
 * consentementAJour : vérifie si le consentement enregistré est à jour par
 *   rapport à la version attendue.
 *
 * Contexte RGPD :
 *   - `consentementVersion` : ex. "v1.0", "v2.1" — versionnage sémantique de la
 *     politique de traitement (modifié dès que la finalité ou les données
 *     traitées changent — RGPD art. 7).
 *   - `consentementAt`      : horodatage de la dernière acceptation.
 *   - `consentementFormation` : consent. au traitement des données pour la
 *     gestion de formation (financement, attestations — base légale = contrat).
 *   - `consentementEmail` : consent. aux communications non-contractuelles
 *     (suivi J+30, newsletter — base légale = consentement).
 *
 * Note : le chiffrement des données handicap est géré séparément via pii-crypto
 * (T14). Ce service couvre uniquement les flags consentement.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", lève (mutation) ou
 * retourne false (lecture).
 *
 * exactOptionalPropertyTypes respecté.
 */

import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsentementFlags {
  readonly formation?: boolean;
  readonly email?: boolean;
}

export interface ConsentementEnregistreResult {
  readonly traineeId: string;
  readonly version: string;
  readonly at: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard stub
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// enregistrerConsentement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre (ou met à jour) le consentement d'un stagiaire.
 *
 * Met à jour : consentementVersion, consentementAt + les flags granulaires
 * fournis (les flags non fournis restent inchangés grâce à exactOptionalPropertyTypes).
 *
 * Idempotent : un re-consentement sur la même version met simplement à jour
 * l'horodatage (trace la dernière acceptation explicite).
 *
 * @throws Error si le stagiaire n'existe pas ou si stub.
 */
export async function enregistrerConsentement(
  traineeId: string,
  version: string,
  flags?: ConsentementFlags,
): Promise<ConsentementEnregistreResult> {
  if (isStub()) {
    throw new Error("[consentement-service] mutation non disponible en mode stub");
  }

  const now = new Date();

  const trainee = await prisma.trainee.update({
    where: { id: traineeId },
    data: {
      consentementVersion: version,
      consentementAt: now,
      ...(flags?.formation !== undefined ? { consentementFormation: flags.formation } : {}),
      ...(flags?.email !== undefined ? { consentementEmail: flags.email } : {}),
    },
    select: { id: true },
  });

  return {
    traineeId: trainee.id,
    version,
    at: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// consentementAJour
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si le consentement enregistré pour un stagiaire est à jour.
 *
 * Retourne `true` si et seulement si :
 *   - `consentementVersion` correspond exactement à `versionAttendue`
 *   - `consentementAt` est non null
 *
 * Retourne `false` si stub, si le stagiaire est introuvable, ou si la version
 * ne correspond pas.
 */
export async function consentementAJour(
  traineeId: string,
  versionAttendue: string,
): Promise<boolean> {
  if (isStub()) return false;

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { consentementVersion: true, consentementAt: true },
  });

  if (!trainee) return false;
  if (!trainee.consentementAt) return false;
  return trainee.consentementVersion === versionAttendue;
}
