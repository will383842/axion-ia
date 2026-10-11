"use server";

/**
 * Actions — choisir le formateur en cartes (L11b) et se désister depuis
 * l'espace (L11h).
 *
 * Deux côtés, deux gardes :
 *   - la CONSOLE choisit (`requireAdminWrite`, dossier ouvert) : toujours une
 *     personne de l'équipe, jamais un choix automatique ;
 *   - le FORMATEUR se désiste de SA mission (`requireFormateurAction` ; la
 *     mission d'un autre répond comme une mission inconnue).
 *
 * La logique vit dans `formateurs-independants/choix-formateur*.ts`.
 */

import { z } from "zod";

import { requireFormateurAction } from "@/server/formateur/guard";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { figerChoix } from "@/server/qualiopi/formateurs-independants/choix-formateur";
import {
  enregistrerChoix,
  lireCartesChoix,
  seDesister,
} from "@/server/qualiopi/formateurs-independants/choix-formateur-service";
import { prisma } from "@/lib/prisma";
import { STATUTS_ACCORD_DONNE } from "@/server/qualiopi/trainers/mission-formateur";

import { logQualiopiActivity, requireAdminWrite } from "./_guards";
import { assignTrainerToSessionAction } from "./trainers";

type ActionResult<T> = { data: T } | { error: string };

const choixSchema = z.object({
  sessionId: z.string().uuid(),
  choix: z
    .array(
      z.object({
        trainerId: z.string().uuid(),
        rang: z.number().int().min(1).max(3),
        forfaitDeplacementParJourHtCents: z.number().int().min(0).max(100_000).nullable(),
      }),
    )
    .min(1)
    .max(3),
});

const FONCTION_FERMEE = "Le choix en cartes n'est pas ouvert.";

/**
 * Enregistre le choix (rangs 1 à 3, conditions figées) puis propose la
 * mission au 1er choix par la porte d'affectation habituelle (garde,
 * habilitation, double emploi, archive, proposition).
 */
export async function choisirFormateursSessionAction(
  input: z.infer<typeof choixSchema>,
): Promise<ActionResult<{ missionProposee: boolean; avertissements: string[] }>> {
  const admin = await requireAdminWrite();
  const parsed = choixSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  if (!(await interrupteurAllume("choix_cartes"))) return { error: FONCTION_FERMEE };
  const { sessionId } = parsed.data;
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const maintenant = new Date();
  const cartes = await lireCartesChoix(sessionId, maintenant);
  if (cartes === null) return { error: "Session introuvable" };
  if (!cartes.ouverte) return { error: "La session n'est plus à venir : rien à proposer." };
  // T3 — la même évaluation que les cartes affichées, relue ICI.
  const fige = figerChoix(parsed.data.choix, [...cartes.disponibles, ...cartes.indisponibles]);
  if (!fige.ok) return { error: fige.erreur };
  const premier = fige.choix[0]!;

  // Le 1er choix tient déjà la place avec une proposition vivante : ses
  // conditions sont figées sur elle, on ne les change pas en silence.
  let dejaPropose = false;
  try {
    const [session, vivante] = await Promise.all([
      prisma.trainingSession.findUnique({
        where: { id: sessionId },
        select: { formateurPrincipalId: true },
      }),
      prisma.missionFormateur.findFirst({
        where: {
          sessionId,
          trainerId: premier.trainerId,
          statut: { in: ["en_attente", ...STATUTS_ACCORD_DONNE] },
        },
        select: { forfaitDeplacementParJourHtCents: true },
      }),
    ]);
    dejaPropose = session?.formateurPrincipalId === premier.trainerId && vivante !== null;
    // Une proposition faite avant les cartes n'a pas de forfait figé : rien à comparer.
    if (
      dejaPropose &&
      vivante !== null &&
      vivante.forfaitDeplacementParJourHtCents !== null &&
      vivante.forfaitDeplacementParJourHtCents !== premier.forfaitDeplacementParJourHtCents
    ) {
      return {
        error:
          "Le 1er choix a déjà reçu la proposition avec un autre forfait : retirez-la d'abord pour en changer.",
      };
    }
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }

  try {
    await enregistrerChoix(sessionId, fige.choix, maintenant);
  } catch {
    return { error: "Erreur lors de l'enregistrement du choix" };
  }
  await logQualiopiActivity({
    action: "qualiopi.session.choix_formateurs",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      choix: fige.choix.map((c) => ({
        rang: c.rang,
        trainerId: c.trainerId,
        tarifHtCents: c.tarifHtCents,
        forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents,
      })),
    },
    session: admin,
  });
  if (dejaPropose) return { data: { missionProposee: false, avertissements: [] } };

  const r = await assignTrainerToSessionAction({ sessionId, trainerId: premier.trainerId });
  if ("error" in r) return { error: r.error };
  return {
    data: { missionProposee: r.data.missionProposee, avertissements: r.data.avertissements },
  };
}

const desistementSchema = z.object({
  missionId: z.string().uuid(),
  motif: z.string().max(1400).optional(),
  remplacant: z.string().max(500).optional(),
});

/** « Je ne peux plus assurer cette mission » — depuis l'espace connecté. */
export async function seDesisterMissionAction(
  input: z.infer<typeof desistementSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const { trainerId } = await requireFormateurAction();
  const parsed = desistementSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const r = await seDesister({
    trainerId,
    missionId: parsed.data.missionId,
    ...(parsed.data.motif !== undefined ? { motif: parsed.data.motif } : {}),
    ...(parsed.data.remplacant !== undefined ? { remplacant: parsed.data.remplacant } : {}),
    maintenant: new Date(),
  });
  if (!r.ok) return { error: r.erreur };
  return { data: { ok: true } };
}
