"use server";

/**
 * Suppression MANUELLE depuis la console (demande de Will du 25/10/2026). Super-administrateur
 * seul, DOUBLE VALIDATION (26/10/2026) : mot EFFACER, puis recopie du numéro de la fiche : voir
 * `suppression-manuelle.ts`. Jamais appelée par une tâche planifiée ni par le worker.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { MessagePourWill, messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";

import {
  MOT_CONFIRMATION,
  preparerSuppression,
  supprimerManuellement,
  type TypeCible,
} from "./suppression-manuelle";
import { preparerRetraitPersonne, retirerPersonne } from "./retrait-personne";

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

/** 1re validation : le mot EFFACER, puis l'écran de la 2e étape (jeton signé dans l'adresse). */
export async function preparerSuppressionAction(fd: FormData): Promise<void> {
  const type = champ(fd, "type") as TypeCible;
  const id = champ(fd, "id");
  const repli = adminPath("fr", "/rendez-vous");
  const page = pageSure(champ(fd, "page"), repli);
  if (!TYPES.includes(type) || !uuid.safeParse(id).success) redirect(repli);
  let jeton = "";
  try {
    const { userId, role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill("Seul Williams (super-administrateur) peut supprimer.");
    }
    if (champ(fd, "confirmation") !== MOT_CONFIRMATION) {
      throw new MessagePourWill(`Écrivez ${MOT_CONFIRMATION} pour confirmer la suppression.`);
    }
    const r = await preparerSuppression({
      type,
      id,
      acteurId: userId,
      confirmation: champ(fd, "confirmation"),
    });
    if (!r.ok) throw new MessagePourWill(r.motif);
    jeton = r.jeton;
  } catch (e) {
    redirect(avecMessageDeRetour(`${page}?supprimer=${type}`, "erreur", messageAffichable(e)));
  }
  redirect(`${page}?supprimer=${type}&jeton=${encodeURIComponent(jeton)}#suppression-${type}`);
}

/** 2e validation : le jeton et le numéro recopié ; tout refus ramène à la 1re étape. */
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
    const jeton = champ(fd, "jeton");
    const code = champ(fd, "code");
    if (jeton === "") throw new MessagePourWill("Recommencez : la première validation manque.");
    if (code === "") throw new MessagePourWill("Recopiez le numéro affiché pour confirmer.");
    const r = await supprimerManuellement({ type, id, acteurId: userId, jeton, code });
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

// ── Retirer UNE personne d'une fiche (ordre de Will du 26/10/2026) ─────────────────────────────
// Même double validation ; on revient sur l'onglet « Personnes » de la fiche (`page`).

const ongletPersonnes = (page: string) => `${page}?onglet=personnes`;

/** 1re validation du retrait : le mot EFFACER, puis l'écran de la 2e étape (jeton signé). */
export async function preparerRetraitPersonneAction(fd: FormData): Promise<void> {
  const contactId = champ(fd, "contactId");
  const clientId = champ(fd, "clientId");
  const repli = adminPath("fr", "/qualiopi/clients");
  const page = pageSure(champ(fd, "page"), repli);
  if (!uuid.safeParse(contactId).success || !uuid.safeParse(clientId).success) redirect(repli);
  const ecran = `${ongletPersonnes(page)}&retirer=${contactId}`;
  let jeton = "";
  try {
    const { userId, role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill("Seul Williams (super-administrateur) peut retirer une personne.");
    }
    if (champ(fd, "confirmation") !== MOT_CONFIRMATION) {
      throw new MessagePourWill(`Écrivez ${MOT_CONFIRMATION} pour confirmer le retrait.`);
    }
    const r = await preparerRetraitPersonne({
      contactId,
      clientId,
      acteurId: userId,
      confirmation: champ(fd, "confirmation"),
    });
    if (!r.ok) throw new MessagePourWill(r.motif);
    jeton = r.jeton;
  } catch (e) {
    redirect(avecMessageDeRetour(ecran, "erreur", messageAffichable(e)));
  }
  redirect(`${ecran}&jeton=${encodeURIComponent(jeton)}#retrait-${contactId}`);
}

/** 2e validation du retrait : le jeton et le code recopié ; tout refus ramène à la 1re étape. */
export async function retirerPersonneAction(fd: FormData): Promise<void> {
  const contactId = champ(fd, "contactId");
  const clientId = champ(fd, "clientId");
  const repli = adminPath("fr", "/qualiopi/clients");
  const page = pageSure(champ(fd, "page"), repli);
  if (!uuid.safeParse(contactId).success || !uuid.safeParse(clientId).success) redirect(repli);
  let texte = "";
  try {
    const { userId, role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill("Seul Williams (super-administrateur) peut retirer une personne.");
    }
    const jeton = champ(fd, "jeton");
    const code = champ(fd, "code");
    if (jeton === "") throw new MessagePourWill("Recommencez : la première validation manque.");
    if (code === "")
      throw new MessagePourWill("Recopiez le code ou le nom affiché pour confirmer.");
    const r = await retirerPersonne({ contactId, clientId, acteurId: userId, jeton, code });
    if (!r.ok) throw new MessagePourWill(r.motif);
    texte =
      r.dejaRetiree === true
        ? "Déjà retirée : rien d'autre à faire."
        : `Personne retirée : ${r.compteurs
            .filter((c) => c.n > 0)
            .map((c) => `${c.n} ${c.libelle}`)
            .join(", ")}.`;
  } catch (e) {
    redirect(
      avecMessageDeRetour(
        `${ongletPersonnes(page)}&retirer=${contactId}`,
        "erreur",
        messageAffichable(e),
      ),
    );
  }
  revalidatePath(page);
  redirect(avecMessageDeRetour(ongletPersonnes(page), "message", texte));
}
