/**
 * Mise en correspondance participants ↔ inscrits.
 *
 * Algorithme (2 passes) :
 *   1. Match exact email (lower/trim).
 *   2. Sinon : nom normalisé (minuscule, sans accents, tokens triés)
 *      vs concaténations "prénom nom" et "nom prénom" de l'inscrit.
 *
 * Un enrollment ne peut être matché qu'une seule fois.
 * En cas de doublon (même enrollment matché par plusieurs participants),
 * le participant avec la durée la plus longue gagne.
 *
 * Aucun import Prisma / accès DB.
 */

import type { MatchInput, MatchResult, ParsedParticipant } from "./types";

/**
 * Met en correspondance les participants parsés avec les inscrits.
 *
 * @param parsed      - Participants issus du relevé de connexion.
 * @param enrollments - Inscrits de la session (email + nom/prénom).
 */
export function matchParticipants(
  parsed: ParsedParticipant[],
  enrollments: MatchInput[],
): MatchResult {
  // Map candidats : enrollmentId → meilleur participant trouvé jusqu'ici
  const best = new Map<string, ParsedParticipant>();

  // Indexer les enrollments par email normalisé pour le pass 1
  const byEmail = new Map<string, MatchInput>();
  for (const e of enrollments) {
    const emailNorm = e.email.toLowerCase().trim();
    if (emailNorm) byEmail.set(emailNorm, e);
  }

  // Indexer les enrollments par nom normalisé pour le pass 2
  const byNom = new Map<string, MatchInput>();
  for (const e of enrollments) {
    const k1 = normalizeNom(`${e.prenom} ${e.nom}`);
    const k2 = normalizeNom(`${e.nom} ${e.prenom}`);
    if (k1) byNom.set(k1, e);
    if (k2 && k2 !== k1) byNom.set(k2, e);
  }

  const unmatched: ParsedParticipant[] = [];

  for (const participant of parsed) {
    let enrollment: MatchInput | undefined;

    // Pass 1 : email exact
    if (participant.email) {
      enrollment = byEmail.get(participant.email.toLowerCase().trim());
    }

    // Pass 2 : nom normalisé
    if (!enrollment) {
      const nomNorm = normalizeNom(participant.nomBrut);
      if (nomNorm) {
        enrollment = byNom.get(nomNorm);
      }
    }

    if (!enrollment) {
      unmatched.push(participant);
      continue;
    }

    // Résolution des doublons : garder le participant avec la plus longue durée
    const existing = best.get(enrollment.enrollmentId);
    if (!existing || participant.dureeMinutes > existing.dureeMinutes) {
      best.set(enrollment.enrollmentId, participant);
    }
  }

  const matched = Array.from(best.entries()).map(([enrollmentId, participant]) => ({
    enrollmentId,
    participant,
  }));

  return { matched, unmatched };
}

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Normalise un nom pour la comparaison floue :
 *   - minuscules
 *   - supprime les accents (NFD + retrait diacritiques)
 *   - découpe en tokens, trie et rejoint par espace
 */
export function normalizeNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}
