// Registre des sous-traitants tenu par l'outil (Qualiopi ind. 27) — Server Actions.
//
// Chaque action vérifie le RÔLE d'abord (`habiliter_formateur` : « lever la réserve
// d'un sous-traitant »), puis l'interrupteur `formateurs.registre_sous_traitants`,
// AVANT toute lecture. Coupé : refus, rien n'est lu ni écrit.
//   - rattrapage : la synchronisation lancée à la main, après l'aperçu de l'écran ;
//   - trace d'un contrôle fait (auteur = la session, jamais le formulaire).
// Journal : écrit par les services (identifiants, codes, compteurs). Sentry : le nom de
// l'action seulement.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { synchroniserRegistre } from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/synchronisation";
import { tracerControle } from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/traces";

export type EtatGesteRegistre =
  | { readonly etat: "initial" }
  | { readonly etat: "ok"; readonly message: string }
  | { readonly etat: "erreur"; readonly message: string };

const ECRAN = adminPath("fr", "qualiopi/formateurs/registre-sous-traitants");

async function autorise(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "habiliter_formateur")) {
    return { error: "Vous n'avez pas le droit de faire ce geste." };
  }
  if (!(await interrupteurAllume("registre_sous_traitants"))) {
    return { error: "Le registre tenu par l'outil n'est pas encore ouvert (interrupteur coupé)." };
  }
  return { userId: session.user.id };
}

/** Le rattrapage des fiches existantes : la synchronisation, à la main, après l'aperçu. */
export async function synchroniserRegistreAction(
  _prev: EtatGesteRegistre,
  formData: FormData,
): Promise<EtatGesteRegistre> {
  const a = await autorise();
  if ("error" in a) return { etat: "erreur", message: a.error };
  if (formData.get("confirmer") !== "oui") {
    return { etat: "erreur", message: "Cochez la case : l'aperçu a été relu." };
  }
  try {
    const b = await synchroniserRegistre({ maintenant: new Date(), parId: a.userId });
    revalidatePath(ECRAN);
    if (b.etat === "deja_en_cours") {
      return {
        etat: "erreur",
        message: "Une synchronisation est déjà en cours. Réessayez dans un instant.",
      };
    }
    if (b.etat !== "fait") {
      return { etat: "erreur", message: "La synchronisation n'a pas pu se faire. Réessayez." };
    }
    return {
      etat: b.erreurs > 0 ? "erreur" : "ok",
      message:
        `${b.crees} entrée(s) au registre, ${b.misAJour} mise(s) à jour (dont ${b.sorties} sortie(s)), ` +
        `${b.inchanges} déjà à jour` +
        (b.erreurs > 0 ? `, ${b.erreurs} fiche(s) en échec : relancer le rattrapage.` : "."),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "synchroniserRegistreAction" } });
    return { etat: "erreur", message: "La synchronisation n'a pas pu se faire. Réessayez." };
  }
}

const schemaTrace = z.object({
  trainerId: z.string().uuid(),
  code: z.string().min(1).max(60),
  resultat: z.enum(["conforme", "non_conforme", "a_revoir"]),
  motif: z.string().max(2000).optional(),
  faitLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Trace un contrôle fait (quoi, quand, résultat, motif) ; l'auteur est la session. */
export async function tracerControleRegistreAction(
  _prev: EtatGesteRegistre,
  formData: FormData,
): Promise<EtatGesteRegistre> {
  const a = await autorise();
  if ("error" in a) return { etat: "erreur", message: a.error };
  const p = schemaTrace.safeParse({
    trainerId: formData.get("trainerId"),
    code: formData.get("code"),
    resultat: formData.get("resultat"),
    motif: formData.get("motif") ?? undefined,
    faitLe: formData.get("faitLe"),
  });
  if (!p.success) return { etat: "erreur", message: "Données invalides." };
  try {
    const r = await tracerControle({
      trainerId: p.data.trainerId,
      code: p.data.code,
      resultat: p.data.resultat,
      motif: p.data.motif ?? null,
      // Midi UTC : le jour saisi reste le même jour à Paris, été comme hiver.
      faitAt: new Date(`${p.data.faitLe}T12:00:00Z`),
      auteurId: a.userId,
      maintenant: new Date(),
    });
    if (!r.ok) return { etat: "erreur", message: r.refus };
    revalidatePath(ECRAN);
    return { etat: "ok", message: "Contrôle tracé au registre." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "tracerControleRegistreAction" } });
    return { etat: "erreur", message: "Le contrôle n'a pas pu être tracé. Réessayez." };
  }
}
