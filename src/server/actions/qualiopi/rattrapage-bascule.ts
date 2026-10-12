/**
 * Lot D2 (M22) — « Rattrapage avant la bascule » (L12e), depuis la page
 * Interrupteurs : AVANT de donner une date à `formateurs.passage_paiement`,
 * inscrire au relevé mensuel chaque couple (indépendant, session commencée avant
 * la bascule). Aucune règle ici : `paiement/rattrapage-bascule.ts`.
 *
 * Deux temps : l'aperçu nominatif (paramètre de la page, rien n'est écrit), puis
 * l'inscription, qui n'écrit que si l'aperçu relu au clic compte autant de
 * couples à inscrire que celui affiché. Ajout seul, idempotent ; rien n'est
 * supprimé ni modifié. Journal : des compteurs, aucune cible nominative.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import {
  debutFenetreRattrapage,
  inscrireRattrapage,
  lireApercuRattrapage,
  type ClientRattrapage,
} from "@/server/qualiopi/formateurs-independants/paiement/rattrapage-bascule";

/** Une bascule se pose toujours au 1er du mois. */
const DATE_BASCULE = /^\d{4}-\d{2}-01$/;

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v !== "" ? v : undefined;
}

function retourSur(fd: FormData): string {
  const v = champ(fd, "retour") ?? "";
  return /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/formateurs\/interrupteurs$/.test(v) ? v : "/";
}

export async function inscrireRattrapageFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const session = await requireHabilitation("remunerer_formateur");
  const date = champ(formData, "dateBascule") ?? "";
  const apercu = (m: string) =>
    redirect(
      `${base}?rattrapage=${encodeURIComponent(date)}&erreur=${encodeURIComponent(m)}#rattrapage`,
    );
  if (!DATE_BASCULE.test(date)) {
    redirect(
      `${base}?erreur=${encodeURIComponent("Date de bascule illisible (toujours un 1er du mois).")}`,
    );
  }
  if (champ(formData, "confirmer") !== "oui") apercu("Cochez la confirmation avant d'inscrire.");
  const vu = /^\d{1,6}$/.exec(champ(formData, "aRevendiquerVu") ?? "");
  if (vu === null) apercu("Affichez l'aperçu avant d'inscrire.");

  const db = prisma as unknown as ClientRattrapage;
  const relu = await lireApercuRattrapage(db, date, debutFenetreRattrapage(date));
  if (relu.aRevendiquer !== Number(vu![0])) {
    apercu("La liste a changé depuis l'aperçu : relisez-la avant d'inscrire.");
  }
  const inscrits = await inscrireRattrapage(db, relu);
  await logQualiopiActivity({
    action: "qualiopi.remuneration.rattrapage_bascule",
    targetType: "qualiopi",
    targetId: null,
    changes: {
      dateBascule: date,
      aRevendiquer: relu.aRevendiquer,
      inscrits,
      conflits: relu.conflits.length,
    },
    session,
  });
  revalidatePath(base);
  redirect(
    `${base}?rattrapage=${encodeURIComponent(date)}&ok=${encodeURIComponent(
      `${inscrits} couple(s) inscrit(s) au relevé mensuel. Comparez la liste ci-dessous à l'aperçu.`,
    )}#rattrapage`,
  );
}
