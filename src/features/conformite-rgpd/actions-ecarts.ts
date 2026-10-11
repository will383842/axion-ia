// Conformité RGPD (console) — « Marquer corrigé », « Rouvrir », « Archiver » et
// « Réactiver ». Administrateur seulement, revérifié ICI ; trace `journaliser`
// SANS contenu (ni constat, ni note : l'identifiant de la ligne suffit).
//
// ⛔ Aucune suppression : un écart corrigé reste visible, un traitement s'archive.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { exigerAdministrateur, lireUuid } from "./garde";

export type ResultatGeste = { ok: true } | { ok: false; erreur: string };

const INTROUVABLE = "Ce point a déjà changé d'état. Rechargez la page.";
const ECHEC = "L'enregistrement a échoué. Réessayez dans un instant.";
const MAX_NOTE = 2000;

async function changerEcart(
  formData: FormData,
  vers: "corrige" | "ouvert",
): Promise<ResultatGeste> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  const id = lireUuid(formData, "ecartId");
  if (!id) return { ok: false, erreur: INTROUVABLE };

  const brute = formData.get("note");
  const note = typeof brute === "string" && brute.trim() !== "" ? brute.trim() : null;
  if (note && note.length > MAX_NOTE) {
    return { ok: false, erreur: `Note trop longue (${MAX_NOTE} caractères au plus).` };
  }

  let count: number;
  try {
    ({ count } = await prisma.ecartRgpd.updateMany({
      where: { id, statut: vers === "corrige" ? "ouvert" : "corrige" },
      data:
        vers === "corrige"
          ? {
              statut: "corrige",
              corrigeLe: new Date(),
              corrigeParId: garde.auteur.id,
              corrigeParNom: garde.auteur.nom,
              ...(note ? { note } : {}),
            }
          : { statut: "ouvert", corrigeLe: null, corrigeParId: null, corrigeParNom: null },
    }));
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  if (count === 0) return { ok: false, erreur: INTROUVABLE };

  await journaliser(prisma, {
    action: vers === "corrige" ? "conformite.ecart.corrige" : "conformite.ecart.rouvert",
    targetType: "EcartRgpd",
    targetId: id,
    session: { userId: garde.auteur.id },
  });
  return { ok: true };
}

export async function marquerEcartCorrige(formData: FormData): Promise<ResultatGeste> {
  return changerEcart(formData, "corrige");
}

export async function rouvrirEcart(formData: FormData): Promise<ResultatGeste> {
  return changerEcart(formData, "ouvert");
}

async function changerTraitement(
  formData: FormData,
  vers: "archive" | "actif",
): Promise<ResultatGeste> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  const id = lireUuid(formData, "traitementId");
  if (!id) return { ok: false, erreur: INTROUVABLE };
  let count: number;
  try {
    ({ count } = await prisma.traitementRgpd.updateMany({
      where: { id, statut: vers === "archive" ? "actif" : "archive" },
      data: { statut: vers },
    }));
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  if (count === 0) return { ok: false, erreur: INTROUVABLE };
  await journaliser(prisma, {
    action: vers === "archive" ? "conformite.traitement.archive" : "conformite.traitement.reactive",
    targetType: "TraitementRgpd",
    targetId: id,
    session: { userId: garde.auteur.id },
  });
  return { ok: true };
}

export async function archiverTraitement(formData: FormData): Promise<ResultatGeste> {
  return changerTraitement(formData, "archive");
}

export async function reactiverTraitement(formData: FormData): Promise<ResultatGeste> {
  return changerTraitement(formData, "actif");
}

// ─── Les actions des formulaires : le geste, puis retour sur la bonne vue ─────

const CLE = /^[A-Za-z0-9_-]{1,80}$/;

/** `retour` vient du formulaire : seules trois vues connues sont acceptées. */
function adresseRetour(formData: FormData): string {
  const base = adminPath("fr", "conformite-rgpd");
  const cle = formData.get("cle");
  if (formData.get("retour") === "fiche" && typeof cle === "string" && CLE.test(cle)) {
    return `${base}/${cle}`;
  }
  if (formData.get("retour") === "corriges") return `${base}?onglet=points&vue=corriges`;
  return `${base}?onglet=points`;
}

async function conclure(formData: FormData, r: ResultatGeste): Promise<never> {
  const retour = adresseRetour(formData);
  const sep = retour.includes("?") ? "&" : "?";
  revalidatePath(adminPath("fr", "conformite-rgpd"), "layout");
  if (r.ok) redirect(retour);
  redirect(`${retour}${sep}erreur=${encodeURIComponent(r.erreur)}`);
}

export async function marquerEcartCorrigeAction(formData: FormData): Promise<void> {
  await conclure(formData, await marquerEcartCorrige(formData));
}

export async function rouvrirEcartAction(formData: FormData): Promise<void> {
  await conclure(formData, await rouvrirEcart(formData));
}

export async function archiverTraitementAction(formData: FormData): Promise<void> {
  await conclure(formData, await archiverTraitement(formData));
}

export async function reactiverTraitementAction(formData: FormData): Promise<void> {
  await conclure(formData, await reactiverTraitement(formData));
}
