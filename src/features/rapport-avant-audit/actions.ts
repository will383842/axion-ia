/**
 * Action serveur du rapport avant audit (2026-11-02) : le clic « Lancer le rapport » de Will.
 *
 * Gardes, dans cet ordre, toutes AVANT la moindre écriture :
 *   1. session et liste A2 (`exigerAccesEchanges`), puis rôle `super_admin` SEULEMENT : le
 *      rapport lit les réponses intégrales de toute l'équipe du client ;
 *   2. interrupteur `RAPPORT_AVANT_AUDIT_ENABLED` (éteint par défaut, `config.ts`) ;
 *   3. fiche existante, au moins une réponse reçue (non mise à l'écart) ;
 *   4. aucun lancement déjà en attente ou en cours sur la fiche (double clic, coût).
 *
 * Écrit UNE ligne neuve dans `rapports_avant_audit` (jamais la réutilisation d'une ancienne),
 * met `{ rapportId }` en file, journalise (`logActivity`). AUCUNE écriture sur `clients`.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { z } from "zod";

import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { enqueueRapportAvantAudit } from "@/server/queue/queues";

import { fichesCouvertes, questionnairesDesFiches } from "../questionnaire-preaudit/de-la-fiche";
import { MESSAGE_INTERRUPTEUR_ETEINT, rapportAvantAuditActif } from "./config";
import { creerRapport, marquerErreur } from "./persistance";

export type ResultatLancement =
  | { readonly ok: true; readonly rapportId: string }
  | { readonly ok: false; readonly erreur: string };

const Uuid = z.string().uuid();

export async function lancerRapportAvantAudit(clientId: string): Promise<ResultatLancement> {
  let acces: { userId: string; role: string };
  try {
    acces = await exigerAccesEchanges();
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Accès refusé." };
  }
  if (acces.role !== "super_admin") {
    return {
      ok: false,
      erreur: "Seule la personne qui administre la console peut lancer le rapport avant audit.",
    };
  }
  if (!rapportAvantAuditActif()) return { ok: false, erreur: MESSAGE_INTERRUPTEUR_ETEINT };
  if (!Uuid.safeParse(clientId).success) return { ok: false, erreur: "Fiche client invalide." };

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (client === null) return { ok: false, erreur: "Fiche client introuvable." };

  const fiches = await fichesCouvertes(clientId);
  const questionnaires = await prisma.questionnaireAvantAudit.findMany({
    where: { ...questionnairesDesFiches(fiches), envoyeLe: { not: null } },
    select: { id: true },
    orderBy: [{ envoyeLe: "asc" }, { id: "asc" }],
  });
  const ids = questionnaires.map((q) => q.id);
  const reponses =
    ids.length === 0
      ? 0
      : await prisma.questionnaireAvantAuditEnvoi.count({
          where: { questionnaireId: { in: ids }, ecarteLe: null },
        });
  if (reponses === 0) {
    return { ok: false, erreur: "Aucune réponse reçue sur cette fiche : rien à analyser." };
  }

  const enVol = await prisma.rapportAvantAudit.count({
    where: { clientId, statut: { in: ["en_attente", "en_cours"] } },
  });
  if (enVol > 0) {
    return { ok: false, erreur: "Un rapport est déjà en préparation pour cette fiche." };
  }

  const { id } = await creerRapport({ clientId, questionnaireIds: ids, lanceParId: acces.userId });
  let enFile = false;
  try {
    enFile = await enqueueRapportAvantAudit(id);
  } catch {
    enFile = false;
  }
  if (!enFile) {
    await marquerErreur(id, "La file des tâches est indisponible : relancez plus tard.");
  }

  // Des identifiants et des nombres : jamais un contenu de réponse.
  await logActivity({
    // `logActivity` n'écrit que `userId` ; l'adresse n'est ni lue ni journalisée.
    session: { userId: acces.userId, email: "", role: acces.role },
    action: "rapport-avant-audit.lancer",
    targetType: "RapportAvantAudit",
    targetId: id,
    changes: { clientId, questionnaires: ids.length, reponses, enFile },
  });

  return enFile
    ? { ok: true, rapportId: id }
    : { ok: false, erreur: "La file des tâches est indisponible : relancez plus tard." };
}
