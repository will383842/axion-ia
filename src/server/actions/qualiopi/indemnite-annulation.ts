/**
 * Lot D (M11) — la décision de l'administrateur sur une mission fermée dont la
 * lettre est signée : « Écrire l'indemnité d'annulation ».
 *
 * Aucun calcul ici : l'aperçu et l'écriture sont dans
 * `paiement/indemnite-annulation-base.ts` (sources uniques `indemniteAnnulation`
 * et `totaliser`). Confirmation exigée ; l'instant saisi est une heure de Paris
 * et ne peut pas être dans le futur. Éteint avec la page « Missions »
 * (`formateurs.missions_console`).
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logQualiopiActivity, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { instantParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { ecrireIndemniteDecidee } from "@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-base";
import { montantEnTexte } from "@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIBELLE: Record<string, string> = {
  non_due:
    "Aucune indemnité n'est due (annulation à plus de 72 heures, ou pas du fait d'Axion, ou aucune demi-journée annulée).",
  refusee: "Cette mission n'attend pas de décision d'indemnité.",
  deja_ecrite: "L'indemnité de cette mission est déjà écrite.",
  releve_fige_a_la_main:
    "Le relevé de mission de ce mois est déjà validé : l'indemnité s'ajoute à la main, par une correction.",
  contract_non_fait:
    "Le schéma n'accepte pas encore un relevé de mission à côté du relevé mensuel : indemnité non écrite.",
};

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v !== "" ? v : undefined;
}

function retourSur(fd: FormData): string {
  const v = champ(fd, "retour") ?? "";
  return /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/formateurs\/missions$/.test(v) ? v : "/";
}

export async function ecrireIndemniteAnnulationFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const erreur = (m: string): never => redirect(`${base}?erreur=${encodeURIComponent(m)}`);
  const session = await requireHabilitation("remunerer_formateur");
  if (!(await interrupteurAllume("missions_console"))) erreur("La page « Missions » est éteinte.");
  if (champ(formData, "confirmer") !== "oui") erreur("Cochez la confirmation de votre décision.");
  const missionId = champ(formData, "missionId");
  if (missionId === undefined || !UUID.test(missionId)) erreur("Mission inconnue.");
  const saisi = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(champ(formData, "annuleeA") ?? "");
  if (saisi === null) erreur("Instant de l'annulation illisible.");
  let annuleeA: Date;
  try {
    annuleeA = instantParis(saisi![1]!, saisi![2]!);
  } catch {
    return erreur("Instant de l'annulation illisible.");
  }
  if (annuleeA.getTime() > Date.now()) erreur("L'annulation ne peut pas être dans le futur.");
  const parAxion = champ(formData, "parAxion") === "oui";

  const r = await ecrireIndemniteDecidee({ missionId: missionId!, annuleeA, parAxion });
  await logQualiopiActivity({
    action: "formateurs.mission.indemnite_annulation_decidee",
    targetType: "MissionFormateur",
    targetId: missionId!,
    changes: {
      issue: r.issue,
      parAxion,
      annuleeA: annuleeA.toISOString(),
      ...("montantHtCents" in r ? { montantHtCents: r.montantHtCents } : {}),
    },
    session,
  });
  revalidatePath(base);
  if (r.issue !== "ecrite") erreur(LIBELLE[r.issue] ?? "Indemnité non écrite.");
  const m = r as { montantHtCents: number; totalTtcCents: number };
  redirect(
    `${base}?ok=${encodeURIComponent(
      `Indemnité écrite : ${montantEnTexte(m.montantHtCents)} € HT (${montantEnTexte(m.totalTtcCents)} € TTC), relevé « à valider ».`,
    )}`,
  );
}
