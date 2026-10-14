/**
 * Lot G2 — « Payer quand même » : l'administrateur lève l'exigence du bilan de fin de
 * formation pour UN formateur indépendant sur UNE session (jamais celle des feuilles).
 *
 * Motif écrit obligatoire et confirmation cochée ; auteur, date et motif posés sur la
 * ligne du bilan, l'acte tracé au journal (identifiants seuls). Aucun montant ne bouge :
 * le passage du paiement écrira le relevé à son prochain passage, « à valider » comme
 * tous. Éteint tant que `formateurs.bilan_fin_formation` est éteint.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { payerQuandMemeBilan } from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIBELLES: Record<string, string> = {
  eteint: "Le bilan de fin de formation n'est pas ouvert (interrupteur éteint).",
  introuvable: "Ce formateur n'a pas animé cette session.",
  non_concerne:
    "Aucun bilan n'est attendu ici : formateur non indépendant (salarié, dirigeant ou formateur d'organisme), ou session annulée ou reportée.",
  motif_invalide: "Écrivez le motif (10 à 500 caractères) : il reste au dossier.",
  deja_fait: "« Payer quand même » est déjà posé pour ce formateur.",
};

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** Retour : la page « Évaluations » d'une session, et rien d'autre. */
function retourSur(fd: FormData): string {
  const v = champ(fd, "retour") ?? "";
  return /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/sessions\/[0-9a-f-]{36}\/evaluations$/i.test(v)
    ? v
    : "/";
}

export async function payerQuandMemeBilanFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const vers = (cle: "ok" | "erreur", m: string): never =>
    redirect(`${base}?${cle}=${encodeURIComponent(m)}#bilans-fin-formation`);
  const session = await requireHabilitation("remunerer_formateur");
  const sessionId = champ(formData, "sessionId");
  const trainerId = champ(formData, "trainerId");
  if (
    sessionId === undefined ||
    !UUID.test(sessionId) ||
    trainerId === undefined ||
    !UUID.test(trainerId)
  ) {
    vers("erreur", LIBELLES.introuvable!);
  }
  if (champ(formData, "confirmer") !== "oui") {
    vers(
      "erreur",
      "Cochez la confirmation : le relevé du dernier mois de la mission n'attendra plus ce bilan.",
    );
  }
  const issue = await payerQuandMemeBilan({
    sessionId: sessionId!,
    trainerId: trainerId!,
    adminUserId: session.userId,
    motif: champ(formData, "motif") ?? "",
    maintenant: new Date(),
  });
  revalidatePath(base);
  if (issue !== "ok") vers("erreur", LIBELLES[issue] ?? "Rien n'est écrit.");
  vers(
    "ok",
    "C'est noté : le relevé du dernier mois de la mission n'attend plus le bilan de ce formateur. Il passera « à valider » au prochain passage.",
  );
}
