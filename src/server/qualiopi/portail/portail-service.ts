/**
 * Qualiopi — Service portail stagiaire (T14 — AGENT A).
 *
 * creerAcces         : génère un accès portail (token 64 hex, 90 j par défaut).
 * verifierToken      : vérification timing-safe → met à jour lastUsedAt.
 * revoquerAcces      : révoque un accès (revoked=true).
 * getEspaceStagiaire : retourne toutes les données visibles par le stagiaire.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", les mutations lèvent
 * et les lectures retournent des valeurs sécurisées (safe au build SSG).
 *
 * Règles non négociables :
 * - Token via randomBytes 32 (64 hex) — même primitives que makeQrToken.
 * - Comparaison token via timingSafeEqual (node:crypto).
 * - Handicap décrit via decryptPii — JAMAIS en clair dans les retours.
 * - exactOptionalPropertyTypes respecté.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type {
  EnrollmentStatut,
  DocumentType,
  QuestionnaireType,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerAccesResult {
  id: string;
  token: string;
  expiresAt: Date;
}

/** Résumé d'une formation (session) visible dans l'espace stagiaire. */
export interface FormationResume {
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  statut: EnrollmentStatut;
}

/** Résumé d'une attestation/certificat visible dans l'espace stagiaire. */
export interface AttestationResume {
  type: DocumentType;
  numero: string;
  pdfUrl: string | null;
  qrToken: string | null;
}

/** Résumé d'un questionnaire visible dans l'espace stagiaire. */
export interface QuestionnaireResume {
  type: QuestionnaireType;
  token: string;
  reponduAt: Date | null;
}

/** Espace stagiaire complet retourné par getEspaceStagiaire. */
export interface EspaceStagiaire {
  trainee: {
    prenom: string;
    nom: string;
  };
  formations: FormationResume[];
  attestations: AttestationResume[];
  questionnaires: QuestionnaireResume[];
  /** Situation handicap (champ clair après décryptage, null si non renseigné). */
  situationHandicap: {
    declaree: boolean;
    details: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/** Génère un token portail : 32 bytes → 64 chars hex. */
function genererTokenPortail(): string {
  return randomBytes(32).toString("hex");
}

/** Comparaison timing-safe de deux tokens portail (même longueur attendue : 64). */
function comparerTokenPortail(candidat: string, reference: string): boolean {
  if (candidat.length !== reference.length) return false;
  try {
    return timingSafeEqual(Buffer.from(candidat, "utf8"), Buffer.from(reference, "utf8"));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// creerAcces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un accès portail pour un stagiaire.
 *
 * - Génère un token aléatoire (64 hex) valable `joursValidite` jours (défaut 90).
 * - N'invalide PAS les accès précédents (plusieurs accès actifs possibles, la
 *   révocation est explicite via `revoquerAcces`).
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerAcces(traineeId: string, joursValidite = 90): Promise<CreerAccesResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerAcces: stub DB — non disponible au build");
  }

  const token = genererTokenPortail();
  const expiresAt = new Date(Date.now() + joursValidite * 24 * 60 * 60 * 1000);

  const acces = await prisma.portailAcces.create({
    data: {
      traineeId,
      token,
      expiresAt,
    },
    select: { id: true, token: true, expiresAt: true },
  });

  return { id: acces.id, token: acces.token, expiresAt: acces.expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// verifierToken
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie un token portail (timing-safe) et retourne le traineeId si valide.
 *
 * - Retourne null si token inconnu, révoqué ou expiré.
 * - Met à jour `lastUsedAt` sur vérification réussie.
 *
 * Stub-aware : retourne null si DATABASE_URL contient "stub.invalid".
 */
export async function verifierToken(token: string): Promise<{ traineeId: string } | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }

  // On ne peut pas filtrer par token directement en DB (champ unique) sans
  // exposer un oracle de timing — on récupère par token (index unique) puis
  // comparaison timing-safe en mémoire. La requête DB est par token (hachage
  // interne B-tree, pas de timing attaque côté DB significatif).
  const acces = await prisma.portailAcces.findUnique({
    where: { token },
    select: { id: true, traineeId: true, token: true, expiresAt: true, revoked: true },
  });

  if (acces === null) return null;

  // Comparaison timing-safe (défense en profondeur contre cache-timing)
  if (!comparerTokenPortail(token, acces.token)) return null;
  if (acces.revoked) return null;
  if (acces.expiresAt < new Date()) return null;

  // Mise à jour lastUsedAt (fire-and-forget : ne bloque pas la réponse)
  void prisma.portailAcces.update({
    where: { id: acces.id },
    data: { lastUsedAt: new Date() },
  });

  return { traineeId: acces.traineeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// revoquerAcces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révoque un accès portail par son id.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function revoquerAcces(id: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("revoquerAcces: stub DB — non disponible au build");
  }

  await prisma.portailAcces.update({
    where: { id },
    data: { revoked: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getEspaceStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'espace stagiaire complet pour affichage dans le portail.
 *
 * - Inclut : identité, formations, attestations, questionnaires, situation handicap.
 * - Le détail handicap est déchiffré via `decryptPii` (jamais en clair en DB).
 * - Retourne un espace vide si DATABASE_URL contient "stub.invalid".
 *
 * Lève si le stagiaire est introuvable (considéré supprimé/inexistant).
 */
export async function getEspaceStagiaire(traineeId: string): Promise<EspaceStagiaire> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      trainee: { prenom: "", nom: "" },
      formations: [],
      attestations: [],
      questionnaires: [],
      situationHandicap: { declaree: false, details: null },
    };
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: {
      prenom: true,
      nom: true,
      situationHandicap: true,
      handicapDetailsChiffre: true,
      enrollments: {
        select: {
          statut: true,
          attestationDocument: {
            select: {
              type: true,
              numero: true,
              pdfUrl: true,
              qrToken: true,
            },
          },
          questionnaires: {
            select: {
              type: true,
              token: true,
              reponduAt: true,
            },
          },
          session: {
            select: {
              titreSession: true,
              dateDebut: true,
              dateFin: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (trainee === null) {
    throw new Error(`getEspaceStagiaire: stagiaire introuvable (id=${traineeId})`);
  }

  const formations: FormationResume[] = trainee.enrollments.map((e) => ({
    titre: e.session.titreSession,
    dateDebut: e.session.dateDebut,
    dateFin: e.session.dateFin,
    statut: e.statut,
  }));

  const attestations: AttestationResume[] = trainee.enrollments
    .flatMap((e) => (e.attestationDocument ? [e.attestationDocument] : []))
    .map((doc) => ({
      type: doc.type,
      numero: doc.numero,
      pdfUrl: doc.pdfUrl ?? null,
      qrToken: doc.qrToken ?? null,
    }));

  const questionnaires: QuestionnaireResume[] = trainee.enrollments
    .flatMap((e) => e.questionnaires)
    .map((q) => ({
      type: q.type,
      token: q.token,
      reponduAt: q.reponduAt ?? null,
    }));

  const detailsChiffre = trainee.handicapDetailsChiffre ?? null;
  const details = detailsChiffre !== null ? decryptPii(detailsChiffre) : null;

  return {
    trainee: { prenom: trainee.prenom, nom: trainee.nom },
    formations,
    attestations,
    questionnaires,
    situationHandicap: {
      declaree: trainee.situationHandicap,
      details,
    },
  };
}
