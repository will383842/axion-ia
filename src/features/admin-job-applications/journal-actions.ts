// Écrire au journal d'une candidature depuis la console — Server Actions.
//
// Deux gestes seulement : consigner une note, consigner un appel. Ce sont les
// deux faits qu'aucune autre action ne produit — un changement de statut et un
// envoi de réponse écrivent déjà leur propre trace, là où ils ont lieu.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import { consignerEvenement, RESUME_MAX } from "./journal";

/**
 * Même garde que la réponse au candidat, et pour la même raison : le journal
 * porte le nom de la personne et le contenu des échanges. Voir le commentaire
 * étendu dans `reply-actions.ts`.
 */
async function requireEcritureJournal(): Promise<{ userId: string; nom: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

export type EtatJournal = { ok: true } | { ok: false; error: string };

const schemaNote = z.object({
  applicationId: z.string().uuid(),
  type: z.enum(["note", "appel", "email_recu", "piece_recue"]),
  texte: z.string().min(2).max(4000),
  /**
   * Date du FAIT. Facultative : une note écrite maintenant vaut maintenant.
   *
   * 🔑 Mais un appel passé hier et consigné aujourd'hui doit se lire à hier —
   * c'est toute la raison d'être de `occurredAt`. Le champ est donc offert à
   * l'écran, pas seulement accepté par le schéma.
   */
  occurredAt: z.coerce.date().optional(),
});

/**
 * Consigne une note, un appel, un message reçu ou une pièce reçue.
 *
 * ⚠️ Aucune modification, aucune suppression : le journal est en ajout seul. Une
 * note erronée se corrige par une note qui la corrige, comme dans un registre
 * papier — et c'est exactement ce qui lui donne sa valeur.
 */
export async function consignerAuJournalAction(
  _prev: EtatJournal,
  formData: FormData,
): Promise<EtatJournal> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureJournal();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const brut = {
    applicationId: formData.get("applicationId"),
    type: formData.get("type"),
    texte: formData.get("texte"),
    ...(formData.get("occurredAt") ? { occurredAt: formData.get("occurredAt") } : {}),
  };
  const parsed = schemaNote.safeParse(brut);
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const d = parsed.data;

  // 🔴 La date du fait ne peut pas être dans le FUTUR. Un journal qui accepte
  // « appel du 15 mars prochain » n'est plus un journal : c'est un agenda, et
  // la frise se trie alors sur des faits qui n'ont pas eu lieu. Planifier un
  // entretien est un autre geste, avec son propre objet (lot 2).
  if (d.occurredAt && d.occurredAt.getTime() > Date.now()) {
    return { ok: false, error: "date_future" };
  }

  // Le résumé est la première ligne, le corps garde tout. Une note de trois
  // paragraphes ne doit pas remplir la frise, mais rien ne doit être perdu.
  const premiereLigne = d.texte.trim().split("\n")[0] ?? d.texte.trim();

  try {
    await consignerEvenement({
      applicationId: d.applicationId,
      type: d.type,
      authorId: acteur.userId,
      authorName: acteur.nom,
      ...(d.occurredAt ? { occurredAt: d.occurredAt } : {}),
      summary: premiereLigne.slice(0, RESUME_MAX),
      body: d.texte.trim(),
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }

  revalidatePath(adminPath("fr", `contacts/candidatures/${d.applicationId}`));
  return { ok: true };
}
