/**
 * Réseau d'apporteurs — la PRIME d'un challenge, vue par les lecteurs de `CommissionApporteur`
 * (chantier #2464, PR H). Module sans `server-only` : atteint par le WORKER.
 *
 * Une prime est une `CommissionApporteur` ordinaire pour l'argent (autofacture, relevé, DAS2) mais
 * elle ne porte AUCUNE commande : `factureId` y est l'identifiant de la prime (`ChallengePrime.id`,
 * sans clé étrangère), jamais celui d'une facture client. Tout lecteur qui suit `factureId` vers
 * une facture, un avoir, une présentation ou une part de parrainage doit donc l'ignorer.
 */

import { prisma } from "@/lib/prisma";

export const ACTIVITE_PRIME_CHALLENGE = "prime_challenge";
export const PREFIXE_PALIER_CHALLENGE = "challenge:";
export const LIBELLE_PRIME_PAR_DEFAUT = "Prime exceptionnelle";

export function estPrimeChallenge(c: { activite: string }): boolean {
  return c.activite === ACTIVITE_PRIME_CHALLENGE;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant du challenge porté par le palier `challenge:<id>` ; `null` si le palier n'a pas cette forme. */
export function challengeIdDuPalier(palier: string | null | undefined): string | null {
  if (!palier || !palier.startsWith(PREFIXE_PALIER_CHALLENGE)) return null;
  const id = palier.slice(PREFIXE_PALIER_CHALLENGE.length);
  return UUID.test(id) ? id : null;
}

/** Désignation de la ligne d'autofacture ; le titre manquant ou vide donne le libellé par défaut. */
export function designationPrime(titre: string | null | undefined): string {
  const t = (titre ?? "").trim();
  return t
    ? `${LIBELLE_PRIME_PAR_DEFAUT} — ${t} (complément de commission)`
    : LIBELLE_PRIME_PAR_DEFAUT;
}

/** Les identifiants de FACTURES CLIENT de ces lignes : une prime n'en porte aucune (son `factureId` est celui de la prime). */
export function facturesClientDesLignes(
  lignes: ReadonlyArray<{ activite: string; factureId: string }>,
): string[] {
  return lignes.filter((l) => !estPrimeChallenge(l)).map((l) => l.factureId);
}

/** Titre de chaque challenge cité par le palier de ces lignes (`challenge:<id>`). Absent : repli au libellé par défaut. */
export async function titresDesPrimes(
  lignes: ReadonlyArray<{ activite: string; palier: string | null }>,
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      lignes
        .filter(estPrimeChallenge)
        .map((l) => challengeIdDuPalier(l.palier))
        .filter((x): x is string => x !== null),
    ),
  ];
  if (ids.length === 0) return new Map();
  const lus = await prisma.challengeApporteur.findMany({
    where: { id: { in: ids } },
    select: { id: true, titre: true },
  });
  return new Map(lus.map((c) => [c.id, c.titre]));
}
