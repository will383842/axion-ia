"use server";

/**
 * Chantier QNC, L03 — actions de la console pour le recueil du besoin (temps 1).
 *
 * Fines : la logique vit dans `server/qualiopi/recueil/`. Ici : la session
 * (rôle), la validation d'entrée, la revalidation de la page.
 *
 * Valider l'analyse et accorder une dérogation ENGAGENT l'organisme (c'est ce
 * qui ouvre l'envoi d'une convention) : même habilitation que la conclusion
 * d'un devis (`conclure_devis`).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { accorderDerogation } from "@/server/qualiopi/recueil/derogation";
import { envoyerEmailRecueil } from "@/server/qualiopi/recueil/envoi-email";
import { lancerRecueil } from "@/server/qualiopi/recueil/lancement";
import { rattacherSessionAuProjet } from "@/server/qualiopi/recueil/rattachement";
import { validerAnalyse } from "@/server/qualiopi/recueil/validation";

type ActionResult<T> = { data: T } | { error: string };

const uuid = z.string().uuid();

function rafraichir(sessionId: string): void {
  revalidatePath(adminPath("fr", `qualiopi/sessions/${sessionId}`));
}

/** « Envoyer le recueil à l'entreprise » (geste manuel, même chemin que l'envoi automatique). */
export async function lancerRecueilAction(
  sessionId: string,
): Promise<ActionResult<{ message: string }>> {
  const admin = await requireAdminWrite();
  const id = uuid.safeParse(sessionId);
  if (!id.success) return { error: "Identifiant invalide." };
  const r = await lancerRecueil(
    prisma,
    { sessionId: id.data, auteurId: admin.userId },
    envoyerEmailRecueil,
  );
  rafraichir(id.data);
  switch (r.etat) {
    case "eteint":
      return { error: "Le recueil du besoin n'est pas allumé pour cette session." };
    case "refuse":
      return { error: r.message };
    case "deja_lance":
      return { data: { message: "Le recueil a déjà été lancé pour ce projet." } };
    case "lance":
      return {
        data: {
          message: r.envoye
            ? "Questionnaire envoyé à l'entreprise."
            : "Questionnaire créé, mais l'e-mail n'est pas parti : il sera renvoyé au prochain passage.",
        },
      };
  }
}

export async function rattacherProjetAction(input: {
  sessionId: string;
  projetId: string;
}): Promise<ActionResult<{ message: string }>> {
  const admin = await requireAdminWrite();
  const p = z.object({ sessionId: uuid, projetId: uuid }).safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  const r = await rattacherSessionAuProjet(prisma, { ...p.data, auteurId: admin.userId });
  if (!r.ok) return { error: r.message };
  rafraichir(p.data.sessionId);
  return { data: { message: "Session rattachée au projet." } };
}

/** Will valide l'analyse : la date serveur et l'auteur sont journalisés. */
export async function validerAnalyseAction(input: {
  sessionId: string;
  questionnaireId: string;
}): Promise<ActionResult<{ valideLe: string }>> {
  const admin = await requireHabilitation("conclure_devis");
  const p = z.object({ sessionId: uuid, questionnaireId: uuid }).safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  const r = await validerAnalyse(prisma, {
    questionnaireId: p.data.questionnaireId,
    auteurId: admin.userId,
  });
  if (!r.ok) return { error: r.message };
  rafraichir(p.data.sessionId);
  return { data: { valideLe: r.valideLe.toISOString() } };
}

/** Dérogation motivée à la garde de la convention : journalisée, affichée en rouge. */
export async function accorderDerogationAction(input: {
  sessionId: string;
  motif: string;
}): Promise<ActionResult<{ message: string }>> {
  const admin = await requireHabilitation("conclure_devis");
  const p = z.object({ sessionId: uuid, motif: z.string().max(4000) }).safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  const r = await accorderDerogation(prisma, { ...p.data, auteurId: admin.userId });
  if (!r.ok) return { error: r.message };
  rafraichir(p.data.sessionId);
  return { data: { message: "Dérogation enregistrée et journalisée." } };
}
