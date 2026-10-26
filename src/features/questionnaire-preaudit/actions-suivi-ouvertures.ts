"use server";

/**
 * « Lire le brouillon » (2026-10-27) : le contenu d'un brouillon du questionnaire avant audit, pour
 * le SUPER-ADMINISTRATEUR seul, sous l'interrupteur `QUESTIONNAIRE_SUIVI_BROUILLON_VISIBLE`.
 *
 *   · le rôle est vérifié ICI (masquer le bouton n'est pas interdire) ;
 *   · chaque lecture laisse une trace (`activity_logs`, jamais purgée) : qui, quand, quel
 *     brouillon — JAMAIS le contenu ;
 *   · sans trace écrite, rien n'est rendu ;
 *   · rien n'est journalisé en clair, rien n'est modifié ni supprimé.
 */

import { z } from "zod";

import { AccesRefuse, exigerAccesEchanges } from "@/features/dossier-client/acces";
import { prisma } from "@/lib/prisma";

import { brouillonVisible, personneLisible, type ChampLu } from "./ouvertures";
import { lireBrouillonPourConsole } from "./suivi-ouvertures";

export type EtatLectureBrouillon =
  | { readonly etat: "initial" }
  | { readonly etat: "refuse"; readonly message: string }
  | {
      readonly etat: "lu";
      readonly personne: string;
      readonly majLe: string;
      readonly champs: ReadonlyArray<ChampLu>;
    };

// Non exportée : un fichier « use server » n'exporte que des fonctions asynchrones.
const ACTION_TRACE_LECTURE = "questionnaire-preaudit.brouillon.lu";

const uuid = z.string().uuid();

export async function lireBrouillonAction(
  _prec: EtatLectureBrouillon,
  fd: FormData,
): Promise<EtatLectureBrouillon> {
  if (!brouillonVisible()) {
    return { etat: "refuse", message: "La lecture des brouillons n'est pas activée." };
  }
  let userId: string;
  try {
    const acces = await exigerAccesEchanges();
    if (acces.role !== "super_admin") {
      return {
        etat: "refuse",
        message: "Seul Williams (super-administrateur) peut lire un brouillon.",
      };
    }
    userId = acces.userId;
  } catch (e) {
    return {
      etat: "refuse",
      message: e instanceof AccesRefuse ? e.message : "Accès refusé.",
    };
  }
  const brut = fd.get("brouillonId");
  const id = typeof brut === "string" ? brut.trim() : "";
  if (!uuid.safeParse(id).success) return { etat: "refuse", message: "Brouillon introuvable." };
  const b = await lireBrouillonPourConsole(id);
  if (b === null) {
    return {
      etat: "refuse",
      message: "Ce brouillon n'existe plus (réponse envoyée ou accord retiré) ou est illisible.",
    };
  }
  try {
    // Trace SANS contenu : qui (adminUserId), quand (createdAt), quel brouillon, quel parcours.
    await prisma.activityLog.create({
      data: {
        adminUserId: userId,
        action: ACTION_TRACE_LECTURE,
        targetType: "questionnaire_avant_audit_brouillon",
        targetId: id,
        changes: { questionnaireId: b.questionnaireId, parcours: b.mode },
      },
    });
  } catch {
    return {
      etat: "refuse",
      message: "La lecture n'a pas pu être tracée : le brouillon n'est pas affiché.",
    };
  }
  return {
    etat: "lu",
    personne: personneLisible(b.mode, b.membre),
    majLe: b.majLe.toISOString(),
    champs: b.champs,
  };
}
