/**
 * L09 — ce que la console et le dossier de session lisent d'une réclamation
 * du cycle daté : ses étapes, ses échéances, son rattachement à la session
 * (par l'inscription — `appreciations/rattachements.ts`, jamais une seconde
 * clé), les actions d'amélioration qui la citent (ind. 32) et l'état de ses
 * e-mails de réponse dans la corbeille.
 *
 * Sans N+1 : une requête groupée par table, quel que soit le nombre de
 * réclamations. Chaque lecture secondaire est fail-soft : une table absente
 * (fenêtre de déploiement) ne fait pas tomber le registre.
 */

import { prisma } from "@/lib/prisma";
import {
  resoudreRattachementsAppreciations,
  type RattachementsAppreciation,
} from "@/server/qualiopi/appreciations/rattachements";
import { etapesPossibles } from "./cycle";
import { etatEcheances, type EtapeCode, type EtatDesEcheances } from "./echeances";

export interface EtapeLue {
  readonly id: string;
  readonly etape: EtapeCode;
  readonly contenu: string;
  readonly auteurNom: string;
  readonly creeLe: Date;
}

export interface ActionAmeliorationLiee {
  readonly id: string;
  readonly numero: string;
  readonly action: string;
}

export interface EmailReponseLu {
  readonly statut: "a_valider" | "approuve" | "envoye" | "refuse";
  readonly creeLe: Date;
}

export interface SuiviReclamation {
  readonly etapes: ReadonlyArray<EtapeLue>;
  readonly possibles: ReadonlyArray<EtapeCode>;
  readonly echeances: EtatDesEcheances;
  readonly rattachement: RattachementsAppreciation;
  readonly ameliorations: ReadonlyArray<ActionAmeliorationLiee>;
  readonly emailsReponse: ReadonlyArray<EmailReponseLu>;
}

export interface ReclamationALire {
  readonly id: string;
  readonly dateReception: Date;
  readonly enrollmentId: string | null;
  readonly coachingSessionId: string | null;
}

export async function lireSuivisReclamations(
  reclamations: ReadonlyArray<ReclamationALire>,
  maintenant: Date = new Date(),
): Promise<Map<string, SuiviReclamation>> {
  const out = new Map<string, SuiviReclamation>();
  if (reclamations.length === 0) return out;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return out;
  const ids = reclamations.map((r) => r.id);

  const [etapes, ameliorations, emails, rattachements] = await Promise.all([
    prisma.reclamationEtape
      .findMany({
        where: { reclamationId: { in: ids } },
        select: {
          id: true,
          reclamationId: true,
          etape: true,
          contenu: true,
          auteurNom: true,
          creeLe: true,
        },
        orderBy: { creeLe: "asc" },
      })
      .catch(() => []),
    prisma.actionAmelioration
      .findMany({
        where: { origine: "reclamation", origineRefId: { in: ids } },
        select: { id: true, numero: true, action: true, origineRefId: true },
        orderBy: { creeLe: "asc" },
      })
      .catch(() => []),
    prisma.emailOutbox
      .findMany({
        where: {
          entityType: "Reclamation",
          entityId: { in: ids },
          template: "reclamation-reponse",
        },
        select: { entityId: true, statut: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => []),
    resoudreRattachementsAppreciations(
      reclamations.map((r) => ({
        id: r.id,
        traineeId: null,
        enrollmentId: r.enrollmentId,
        clientId: null,
        trainerId: null,
        coachingSessionId: r.coachingSessionId,
      })),
    ).catch(() => new Map<string, RattachementsAppreciation>()),
  ]);

  for (const r of reclamations) {
    const siennes: EtapeLue[] = etapes
      .filter((e) => e.reclamationId === r.id)
      .map((e) => ({
        id: e.id,
        etape: e.etape,
        contenu: e.contenu,
        auteurNom: e.auteurNom,
        creeLe: e.creeLe,
      }));
    out.set(r.id, {
      etapes: siennes,
      possibles: etapesPossibles(siennes.map((e) => e.etape)),
      echeances: etatEcheances(r.dateReception, siennes, maintenant),
      rattachement: rattachements.get(r.id) ?? {},
      ameliorations: ameliorations
        .filter((a) => a.origineRefId === r.id)
        .map((a) => ({ id: a.id, numero: a.numero, action: a.action })),
      emailsReponse: emails
        .filter((m) => m.entityId === r.id)
        .map((m) => ({ statut: m.statut, creeLe: m.createdAt })),
    });
  }
  return out;
}
