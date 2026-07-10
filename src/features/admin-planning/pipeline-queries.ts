// Cockpit — PIPELINE COMMERCIAL, couche de lecture (read-only, appelée par le RSC).
//
// Aucune règle ici : l'entonnoir, les âges, les fuites et le taux d'acceptation
// vivent dans `pipeline.ts`, pur et testé.
//
// ── Fenêtre glissante, et pas un mois ────────────────────────────────────────
// Le calendrier et la charge raisonnent par MOIS. Le pipeline non : un devis
// envoyé il y a 40 jours doit rester visible en juillet comme en juin, sinon
// l'affaire disparaît de l'écran au moment précis où elle devient un problème.
// On lit donc une fenêtre glissante de N jours en arrière, bornée pour ne pas
// ramener trois ans d'historique de factures payées.
//
// Build-safety (ADR 0026) : stub-aware (try/catch → entonnoir vide).

import { prisma } from "@/lib/prisma";
import {
  construirePipeline,
  type DemandeRow,
  type DevisRow,
  type FactureRow,
  type Pipeline,
  type SessionRow,
} from "./pipeline";

/** Profondeur d'historique par défaut. Assez pour voir un cycle de vente complet. */
export const FENETRE_JOURS_DEFAUT = 180;

const JOUR_MS = 86_400_000;

/** Entonnoir sur les `fenetreJours` derniers jours. `maintenant` est injecté (testabilité). */
export async function getPipeline(
  maintenant: Date,
  fenetreJours: number = FENETRE_JOURS_DEFAUT,
): Promise<Pipeline> {
  const depuis = new Date(maintenant.getTime() - fenetreJours * JOUR_MS);

  const [demandes, devis, sessions] = await Promise.all([
    lireDemandes(depuis),
    lireDevis(depuis),
    lireSessions(depuis),
  ]);

  // Les factures se lisent APRÈS les sessions, et pas seulement sur la fenêtre :
  // une facture créée AVANT `depuis` mais rattachée à une session de la fenêtre
  // doit être vue, sinon cette session ressortirait « à facturer » alors qu'elle
  // est facturée. Un faux positif silencieux sur l'étage le plus coûteux.
  const factures = await lireFactures(
    depuis,
    sessions.map((s) => s.id),
  );

  return construirePipeline({ demandes, devis, sessions, factures }, maintenant);
}

async function lireDemandes(depuis: Date): Promise<DemandeRow[]> {
  try {
    const rows = await prisma.submission.findMany({
      where: { submittedAt: { gte: depuis } },
      select: { status: true, submittedAt: true },
    });
    // `Submission` horodate avec `submittedAt`, pas `createdAt`. Le moteur pur
    // ne connaît qu'une notion de « date de création » : on la lui donne ici.
    return rows.map((r) => ({ status: r.status, createdAt: r.submittedAt }));
  } catch {
    return [];
  }
}

async function lireDevis(depuis: Date): Promise<DevisRow[]> {
  try {
    return await prisma.devis.findMany({
      where: { createdAt: { gte: depuis } },
      select: { statut: true, montantTotalHtCents: true, sentAt: true, createdAt: true },
    });
  } catch {
    return [];
  }
}

/**
 * Sessions de la fenêtre, bornées sur `dateFin` : c'est la fin qui décide si une
 * session est « réalisée, à facturer ». Une formation commencée avant la fenêtre
 * mais terminée dedans doit apparaître.
 */
async function lireSessions(depuis: Date): Promise<SessionRow[]> {
  try {
    return await prisma.trainingSession.findMany({
      where: { dateFin: { gte: depuis } },
      select: { id: true, statut: true, montantHtCents: true, dateFin: true },
    });
  } catch {
    return [];
  }
}

/**
 * Factures de la fenêtre, PLUS celles rattachées à une session de la fenêtre.
 *
 * Deux pièges évités ici :
 *
 * 1. Le filtre porte sur `createdAt`, PAS sur `emiseAt`. Une facture en brouillon
 *    n'a pas de date d'émission : la filtrer dessus la ferait disparaître — or
 *    c'est précisément une facture non émise qui laisse une session « à facturer ».
 *
 * 2. Le `OR` sur `sessionId` rattrape une facture plus ancienne que la fenêtre.
 *    Sans lui, une session de la fenêtre facturée par un devis ancien ressortirait
 *    comme non facturée.
 */
async function lireFactures(depuis: Date, sessionIds: readonly string[]): Promise<FactureRow[]> {
  try {
    return await prisma.factureFormation.findMany({
      where: {
        OR: [
          { createdAt: { gte: depuis } },
          ...(sessionIds.length > 0 ? [{ sessionId: { in: [...sessionIds] } }] : []),
        ],
      },
      select: { sessionId: true, statut: true, montantHtCents: true, emiseAt: true },
    });
  } catch {
    return [];
  }
}
