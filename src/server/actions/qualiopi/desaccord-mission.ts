/**
 * Lot D2 (M10) — les deux issues d'un désaccord sur un relevé de MISSION, depuis
 * l'écran du relevé.
 *
 *   · « Désaccord accepté » : la donnée d'origine (journées, forfait) a été
 *     corrigée dans les écrans existants ; l'outil recalcule (aperçu), puis émet
 *     l'avoir TOTAL et réémet le relevé recalculé, « à valider ». Aucun montant
 *     n'est saisi : le HT vu à l'aperçu est seulement comparé au HT recalculé.
 *   · « Désaccord non retenu » : motif écrit obligatoire, F59, et c'est le SEUL
 *     geste qui débloque le paiement — tracé sur le relevé (qui, quand, motif).
 *
 * Aucune règle d'argent ici : `paiement/desaccord-mission.ts`. Confirmation
 * exigée. Éteint tant que `passage_paiement` n'a pas de date.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import {
  accepterDesaccord,
  refuserDesaccord,
} from "@/server/qualiopi/formateurs-independants/paiement/desaccord-mission";
import { lireDateBascule } from "@/server/qualiopi/formateurs-independants/paiement/lecture-passage";
import { emettrePieceAvoirMission } from "@/server/qualiopi/remuneration/autofacture-emission";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIBELLE_REFUS: Record<string, string> = {
  introuvable: "Relevé introuvable.",
  coupe: "Le paiement par mission n'est pas ouvert.",
  deja_traite: "Ce désaccord est déjà tranché.",
  lignes_non_recalculables:
    "Ce relevé porte une indemnité ou un ajustement : le recalcul ne sait refaire que l'animation et le déplacement. Correction à la main.",
  mois_non_payable:
    "Le recalcul ne trouve pas un mois complet pour cette mission (feuilles ou conditions manquantes) : corrigez d'abord la donnée d'origine.",
  rien_n_a_change:
    "Le recalcul donne exactement la facture contestée : corrigez d'abord la donnée d'origine (journées, forfait), puis revenez ici.",
  apercu_perime:
    "Le montant recalculé a changé depuis l'aperçu : relisez le nouvel aperçu avant de confirmer.",
  contract_non_fait:
    "Le schéma n'accepte pas encore un avoir à côté du relevé mensuel : rien n'est écrit.",
  motif_requis: "Écrivez le motif (10 caractères au moins) : il est envoyé au formateur.",
};

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** Retour : l'écran d'UN relevé, et rien d'autre. */
function retourSur(fd: FormData): string {
  const v = champ(fd, "retour") ?? "";
  return /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/remuneration\/[0-9a-f-]{36}$/i.test(v) ? v : "/";
}

export async function accepterDesaccordFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const erreur = (m: string): never => redirect(`${base}?erreur=${encodeURIComponent(m)}`);
  const session = await requireHabilitation("remunerer_formateur");
  if ((await lireDateBascule(prisma).catch(() => null)) === null) erreur(LIBELLE_REFUS.coupe!);
  const id = champ(formData, "statementId");
  if (id === undefined || !UUID.test(id)) erreur(LIBELLE_REFUS.introuvable!);
  const vu = /^\d{1,9}$/.exec(champ(formData, "htVuCents") ?? "");
  if (vu === null) erreur("Affichez l'aperçu avant de confirmer.");
  if (champ(formData, "confirmer") !== "oui")
    erreur("Cochez la confirmation : la donnée d'origine est-elle bien corrigée ?");

  const r = await accepterDesaccord({
    statementId: id!,
    htVuCents: Number(vu![0]),
    parId: session.userId,
    maintenant: new Date(),
  });
  await logQualiopiActivity({
    action: "qualiopi.remuneration.desaccord_acceptation",
    targetType: "TrainerStatement",
    targetId: id!,
    changes:
      r.issue === "acceptee"
        ? { issue: r.issue, avoirId: r.avoirId, nouveauId: r.nouveauId }
        : { issue: r.issue, motif: r.motif },
    session,
  });
  revalidatePath(base);
  if (r.issue !== "acceptee") erreur(LIBELLE_REFUS[r.motif] ?? `Rien n'est écrit (${r.motif}).`);
  const ok = r as { avoirId: string; nouveauId: string };
  // Le numéro et le PDF de l'avoir, tout de suite (idempotent ; repris par F39 sinon).
  const piece = await emettrePieceAvoirMission(ok.avoirId);
  redirect(
    `${base}?ok=${encodeURIComponent(
      `Désaccord accepté : avoir ${piece?.numero ?? "écrit (numéro à venir avec la nouvelle facture)"}, relevé recalculé réémis « à valider ». Validez-le pour établir la nouvelle facture : le formateur recevra F39.`,
    )}`,
  );
}

export async function refuserDesaccordFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const erreur = (m: string): never => redirect(`${base}?erreur=${encodeURIComponent(m)}`);
  const session = await requireHabilitation("remunerer_formateur");
  if ((await lireDateBascule(prisma).catch(() => null)) === null) erreur(LIBELLE_REFUS.coupe!);
  const id = champ(formData, "statementId");
  if (id === undefined || !UUID.test(id)) erreur(LIBELLE_REFUS.introuvable!);
  if (champ(formData, "confirmer") !== "oui")
    erreur("Cochez la confirmation : le paiement sera débloqué.");

  const r = await refuserDesaccord({
    statementId: id!,
    motif: champ(formData, "motif") ?? "",
    parId: session.userId,
    maintenant: new Date(),
  });
  await logQualiopiActivity({
    action: "qualiopi.remuneration.desaccord_non_retenu",
    targetType: "TrainerStatement",
    targetId: id!,
    // Le motif reste sur le relevé (il est envoyé au formateur) : pas au journal.
    changes: r.issue === "non_retenu" ? { issue: r.issue, envoi: r.envoi } : { issue: r.issue },
    session,
  });
  revalidatePath(base);
  if (r.issue !== "non_retenu") erreur(LIBELLE_REFUS[r.issue] ?? "Rien n'est écrit.");
  const envoi = (r as { envoi: string }).envoi;
  redirect(
    `${base}?ok=${encodeURIComponent(
      `Désaccord non retenu : le paiement est débloqué. ${envoi === "envoye" ? "F59 est parti." : `F59 n'est pas parti (${envoi}) : prévenez le formateur.`}`,
    )}`,
  );
}
