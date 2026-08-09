/**
 * Qualiopi — Server Actions « préparation du kit d'une session ».
 *
 * `genererSortiesAction` produit les sorties de démonstration ; à faire une fois
 * la session vendue, pas avant. `validerSortiesAction` enregistre la relecture
 * humaine — l'étape qui transforme un tas de texte généré en filet utilisable.
 *
 * Pattern maison : requireAdminWrite + Zod + ActionResult + logQualiopiActivity.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  genererSortiesSession,
  validerSortiesSession,
} from "@/server/qualiopi/kit-session/generation";

type ActionResult<T> = { data: T } | { error: string };

const sessionSchema = z.object({ sessionId: z.string().uuid() });

/** Traduit une panne technique en phrase que l'on peut lire sans être développeur. */
function messageLisible(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "session_introuvable") return "Cette session n'existe pas.";
  if (code === "aucune_demonstration") {
    return "Cette formation ne porte aucune démonstration : il n'y a pas de sortie à produire.";
  }
  if (code === "rien_a_valider") {
    return "Il n'y a aucune sortie à valider — produisez-les d'abord.";
  }
  return "La production des sorties a échoué. Réessayez ; si ça persiste, vérifiez le crédit du fournisseur d'IA.";
}

/**
 * Produit les sorties de démonstration de la session.
 *
 * Long par nature : un appel au modèle par démonstration, en série. Une
 * démonstration qui échoue n'annule pas les autres — le résultat dit lesquelles
 * manquent.
 */
export async function genererSortiesAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ produites: number; echecs: number }>> {
  const session = await requireAdminWrite();

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  try {
    const res = await genererSortiesSession(parsed.data.sessionId);
    await logQualiopiActivity({
      action: "qualiopi.kit_session.generer",
      targetType: "TrainingSession",
      targetId: parsed.data.sessionId,
      changes: { produites: res.sorties.length, echecs: res.echecs.length },
      session,
    });
    revalidatePath("/", "layout");
    return { data: { produites: res.sorties.length, echecs: res.echecs.length } };
  } catch (err) {
    console.error("[kit-session] génération échouée", err);
    return { error: messageLisible(err) };
  }
}

/**
 * Enregistre que quelqu'un a LU les sorties et les déclare utilisables.
 *
 * C'est le geste qui engage : après lui, le classeur promet au formateur que
 * ses sorties ont été vérifiées. On trace donc qui l'a posé.
 */
export async function validerSortiesAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ valide: true }>> {
  const session = await requireAdminWrite();

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  try {
    await validerSortiesSession(parsed.data.sessionId, session.userId);
    await logQualiopiActivity({
      action: "qualiopi.kit_session.valider",
      targetType: "TrainingSession",
      targetId: parsed.data.sessionId,
      session,
    });
    revalidatePath("/", "layout");
    return { data: { valide: true } };
  } catch (err) {
    console.error("[kit-session] validation échouée", err);
    return { error: messageLisible(err) };
  }
}
