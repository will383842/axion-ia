/**
 * Lot D (M9) — les actions de la vue « Virements à faire » (W-8, plan 08 §12.1).
 *
 * 🔑 AUCUNE RÈGLE D'ARGENT ICI. « Virements faits (N) » appelle, pour chaque
 * relevé coché, LA transition existante (`transitionStatementAction`) : facture
 * conforme, pièce non contestée, verrous, écriture conditionnelle, et — pour un
 * relevé de mission — contrat-cadre signé, SIREN actif, empreinte de l'IBAN
 * affiché relue au clic. Un rejeu ou un double clic trouve le relevé déjà payé :
 * la transition refuse, rien n'est payé deux fois.
 *
 * 🔒 L'IBAN n'est jamais journalisé : « Copier l'IBAN » inscrit QUI l'a affiché,
 * pour quel formateur (UUID), et rien d'autre.
 *
 * Éteint par `formateurs.virements_a_faire` : coupé, tout refuse.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { transitionStatementAction } from "@/server/actions/qualiopi/trainer-remuneration";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { ibanEnClairPourVirement } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission-base";
import {
  envoyerVirementEnAttente,
  envoyerVirementsFaits,
} from "@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi";
import { etatsVirementsMission } from "@/server/qualiopi/formateurs-independants/paiement/virements-a-faire-lecture";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPREINTE = /^[0-9a-f]{64}$/;
/** Au plus 50 virements par clic : un lot raisonnable, une requête bornée. */
const VIREMENTS_PAR_LOT = 50;
const COUPE = "La vue « Virements à faire » est éteinte.";

async function allumee(): Promise<boolean> {
  return (await lireEtatsEntree()).virements_a_faire === true;
}

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** Retour : la vue elle-même, et rien d'autre (jamais une URL fournie telle quelle). */
function retourSur(fd: FormData): string {
  const v = champ(fd, "retour") ?? "";
  return /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/remuneration\/virements$/.test(v) ? v : "/";
}

/** « Copier l'IBAN » : l'IBAN en clair et son empreinte, journalisé sans l'IBAN. */
export async function revelerIbanVirementAction(
  trainerId: string,
): Promise<{ data: { iban: string; empreinte: string } } | { error: string }> {
  const session = await requireHabilitation("remunerer_formateur");
  if (!(await allumee())) return { error: COUPE };
  if (typeof trainerId !== "string" || !UUID.test(trainerId))
    return { error: "Formateur inconnu." };
  const lu = await ibanEnClairPourVirement(prisma, trainerId).catch(() => null);
  if (lu === null) return { error: "Aucun IBAN lisible pour ce formateur." };
  await logQualiopiActivity({
    action: "formateurs.virement.iban_affiche",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {},
    session,
  });
  return { data: { iban: lu.iban, empreinte: lu.empreinte } };
}

/** « Virements faits (N) » : chaque relevé coché passe par la transition existante. */
export async function virementsFaitsFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  await requireHabilitation("remunerer_formateur");
  if (!(await allumee())) redirect(`${base}?erreur=${encodeURIComponent(COUPE)}`);
  if (champ(formData, "confirmer") !== "oui") {
    redirect(
      `${base}?erreur=${encodeURIComponent("Cochez la confirmation : les virements sont-ils bien partis ?")}`,
    );
  }
  const ids = [
    ...new Set(
      formData.getAll("releve").filter((x): x is string => typeof x === "string" && UUID.test(x)),
    ),
  ];
  if (ids.length === 0) redirect(`${base}?erreur=${encodeURIComponent("Aucun virement coché.")}`);
  if (ids.length > VIREMENTS_PAR_LOT) {
    redirect(
      `${base}?erreur=${encodeURIComponent(`Au plus ${VIREMENTS_PAR_LOT} virements par lot.`)}`,
    );
  }

  const payes: string[] = [];
  const refus: string[] = [];
  for (const id of ids) {
    const empreinte = champ(formData, `empreinte_${id}`);
    const r = await transitionStatementAction({
      id,
      to: "paye",
      moyenPaiement: "virement",
      referenceVirement: champ(formData, `reference_${id}`)?.slice(0, 80),
      ibanEmpreinteAffichee:
        empreinte !== undefined && EMPREINTE.test(empreinte) ? empreinte : undefined,
    });
    if ("error" in r) refus.push(`${champ(formData, `reference_${id}`) ?? "relevé"} : ${r.error}`);
    else payes.push(id);
  }
  // F37 — un e-mail par formateur, pour les seuls relevés de mission payés.
  await envoyerVirementsFaits(payes);
  revalidatePath(base);
  const bilan = `${payes.length} virement${payes.length > 1 ? "s" : ""} marqué${payes.length > 1 ? "s" : ""} fait${payes.length > 1 ? "s" : ""}`;
  if (refus.length > 0) {
    redirect(`${base}?erreur=${encodeURIComponent(`${bilan}. Refusés — ${refus.join(" · ")}`)}`);
  }
  redirect(`${base}?ok=${encodeURIComponent(bilan)}`);
}

/** F38 — prévenir le formateur que son virement attend une attestation URSSAF à jour. */
export async function prevenirVirementEnAttenteFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const session = await requireHabilitation("remunerer_formateur");
  if (!(await allumee())) redirect(`${base}?erreur=${encodeURIComponent(COUPE)}`);
  // Champ propre au bouton : les cases « releve » du même formulaire ne le masquent pas.
  const id = champ(formData, "attente");
  if (id === undefined || !UUID.test(id)) {
    redirect(`${base}?erreur=${encodeURIComponent("Relevé inconnu.")}`);
  }
  const etat = (await etatsVirementsMission([id], new Date())).get(id);
  if (!etat?.motifs.includes("attestation_urssaf_echue_a_la_mission")) {
    redirect(
      `${base}?erreur=${encodeURIComponent("L'attestation URSSAF n'est pas en cause pour ce virement : rien n'est envoyé.")}`,
    );
  }
  const issue = await envoyerVirementEnAttente(id);
  await logQualiopiActivity({
    action: "formateurs.virement.attente_attestation_signalee",
    targetType: "TrainerStatement",
    targetId: id,
    changes: { issue },
    session,
  });
  revalidatePath(base);
  if (issue !== "envoye") {
    redirect(`${base}?erreur=${encodeURIComponent(`E-mail non envoyé (${issue}).`)}`);
  }
  redirect(`${base}?ok=${encodeURIComponent("Le formateur est prévenu (F38).")}`);
}
