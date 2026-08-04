/**
 * Qualiopi — Retours en attente : questionnaires ENVOYÉS restés sans réponse.
 *
 * 🔴 Constaté sur le premier dossier réel : les questionnaires partaient, puis
 * plus rien — aucun écran ne montrait qui n'avait pas répondu, et personne ne
 * relançait. Ce module alimente le bloc « Retours en attente » de la page
 * « À traiter » : c'est là que vit tout ce qui attend une action.
 *
 * La sélection est la MÊME que celle du cron de relance (envoyé, sans réponse,
 * ≤ 90 jours) — l'écran montre exactement la population que le cron travaille,
 * plus les relances déjà épuisées (plafond 2) qu'il faut reprendre au
 * téléphone. La colonne « relances » n'est pas décorative : devant l'auditeur,
 * la trace des tentatives est la preuve que le recueil est organisé.
 *
 * Stub-safe → [].
 */

import { prisma } from "@/lib/prisma";
import type { QuestionnaireType } from "../../../../prisma/generated/client";

export interface RetourEnAttente {
  questionnaireId: string;
  type: QuestionnaireType;
  /** Nom du stagiaire — ou du CONTACT CLIENT pour l'enquête entreprise. */
  destinataire: string;
  /** « Enquête entreprise » est adressée au client, pas au stagiaire. */
  estEntreprise: boolean;
  sessionNumero: string;
  sessionTitre: string;
  envoyeAt: Date;
  relanceCount: number;
  derniereRelanceAt: Date | null;
  /** Vrai quand les 2 relances email sont épuisées → reprendre au téléphone. */
  relancesEpuisees: boolean;
}

const PLAFOND_RELANCES = 2;

export async function listerRetoursEnAttente(): Promise<RetourEnAttente[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];

  const plafond90j = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  let lignes;
  try {
    lignes = await prisma.questionnaire.findMany({
      where: {
        reponduAt: null,
        envoyeAt: { not: null, gte: plafond90j },
      },
      orderBy: { envoyeAt: "asc" },
      take: 50,
      select: {
        id: true,
        type: true,
        envoyeAt: true,
        relanceCount: true,
        derniereRelanceAt: true,
        enrollment: {
          select: {
            trainee: { select: { nom: true, prenom: true } },
            session: {
              select: {
                numero: true,
                titreSession: true,
                client: { select: { contactNom: true, raisonSociale: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    // Sur échec de lecture on n'affiche rien plutôt qu'un écran cassé — les
    // pastilles et le cron restent les filets.
    return [];
  }

  return lignes.map((q) => {
    const estEntreprise = q.type === "satisfaction_entreprise";
    const client = q.enrollment.session.client;
    return {
      questionnaireId: q.id,
      type: q.type,
      destinataire: estEntreprise
        ? (client?.contactNom ?? client?.raisonSociale ?? "Contact client")
        : `${q.enrollment.trainee.prenom} ${q.enrollment.trainee.nom}`,
      estEntreprise,
      sessionNumero: q.enrollment.session.numero,
      sessionTitre: q.enrollment.session.titreSession,
      // `envoyeAt` non nul par sélection — le `??` n'est qu'un garde de type.
      envoyeAt: q.envoyeAt ?? new Date(),
      relanceCount: q.relanceCount,
      derniereRelanceAt: q.derniereRelanceAt,
      relancesEpuisees: q.relanceCount >= PLAFOND_RELANCES,
    };
  });
}
