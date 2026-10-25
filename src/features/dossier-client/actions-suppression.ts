"use server";

/**
 * Suppression MANUELLE depuis la console (demande de Will du 25/10/2026). Super-administrateur
 * seul, mot EFFACER, écran de confirmation : voir `suppression-manuelle.ts`. Jamais appelée par
 * une tâche planifiée ni par le worker.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { MessagePourWill, messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";

import { MOT_CONFIRMATION, supprimerManuellement, type TypeCible } from "./suppression-manuelle";

const uuid = z.string().uuid();
const TYPES: ReadonlyArray<TypeCible> = ["questionnaire", "rencontre", "client"];

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

/** Une page de la console seulement (jamais une adresse extérieure). */
function pageSure(brut: string, repli: string): string {
  const prefixe = adminPath("fr", "/");
  return brut.startsWith(prefixe) && !brut.startsWith("//") ? brut : repli;
}

const APRES: Readonly<Record<TypeCible, string>> = {
  questionnaire: "",
  rencontre: "/rendez-vous",
  client: "/qualiopi/clients",
};

export async function supprimerManuellementAction(fd: FormData): Promise<void> {
  const type = champ(fd, "type") as TypeCible;
  const id = champ(fd, "id");
  const repli = adminPath("fr", "/rendez-vous");
  // La page d'où vient le geste, sans `?supprimer=` : on y revient en cas de refus.
  const page = pageSure(champ(fd, "page"), repli);
  if (!TYPES.includes(type) || !uuid.safeParse(id).success) redirect(repli);
  let resume = "";
  let deja = false;
  try {
    const { userId, role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill("Seul Williams (super-administrateur) peut supprimer.");
    }
    if (champ(fd, "confirmation") !== MOT_CONFIRMATION) {
      throw new MessagePourWill(`Écrivez ${MOT_CONFIRMATION} pour confirmer la suppression.`);
    }
    const r = await supprimerManuellement({
      type,
      id,
      acteurId: userId,
      confirmation: champ(fd, "confirmation"),
    });
    if (!r.ok) throw new MessagePourWill(r.motif);
    deja = r.dejaSupprime === true;
    resume = r.compteurs
      .filter((c) => c.n > 0)
      .map((c) => `${c.n} ${c.libelle}`)
      .join(", ");
  } catch (e) {
    // On rouvre l'écran de confirmation, avec la raison du refus.
    redirect(avecMessageDeRetour(`${page}?supprimer=${type}`, "erreur", messageAffichable(e)));
  }
  const apres = APRES[type] === "" ? page : adminPath("fr", APRES[type]);
  revalidatePath(apres.split("?")[0] ?? apres);
  redirect(
    avecMessageDeRetour(
      apres,
      "message",
      deja ? "Déjà supprimé : rien d'autre à faire." : `Supprimé : ${resume}.`,
    ),
  );
}
