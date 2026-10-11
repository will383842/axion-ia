// Conformité RGPD (console) — « Déclarer un incident », « Enregistrer », « Clore ».
// Administrateur seulement, revérifié ICI ; trace `journaliser` SANS contenu (le
// numéro de l'incident, rien de ce qui a été saisi).
//
// ⛔ Aucune suppression : un incident se clôt et reste au journal.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { exigerAdministrateur, lireUuid } from "./garde";
import { decisionCnilPrise, lireFormulaireIncident } from "./incidents";
import { alerterDeclarationIncident } from "./incidents-alertes";
import { creerIncident, modifierIncident } from "./incidents-base";

export type ResultatIncident = { ok: true; numero: number } | { ok: false; erreur: string };

const ECHEC = "L'enregistrement a échoué. Réessayez dans un instant.";
const INTROUVABLE = "Incident introuvable. Rechargez la page.";

export async function declarerIncident(formData: FormData): Promise<ResultatIncident> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  const f = lireFormulaireIncident(formData);
  if (!f.ok) return f;
  let cree: { id: string; numero: number };
  try {
    cree = await creerIncident(f.saisie, garde.auteur);
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  await journaliser(prisma, {
    action: "conformite.incident.declare",
    targetType: "IncidentDonnees",
    targetId: cree.id,
    session: { userId: garde.auteur.id },
    changes: { numero: cree.numero },
  });
  // Telegram, salon « Incidents » : fail-soft, ne lève jamais.
  await alerterDeclarationIncident(cree.numero, f.saisie.decouvertLe);
  return { ok: true, numero: cree.numero };
}

export async function enregistrerIncident(formData: FormData): Promise<ResultatIncident> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  const id = lireUuid(formData, "incidentId");
  if (!id) return { ok: false, erreur: INTROUVABLE };
  const f = lireFormulaireIncident(formData);
  if (!f.ok) return f;
  let numero: number;
  try {
    const avant = await prisma.incidentDonnees.findUnique({
      where: { id },
      select: { numero: true },
    });
    if (!avant) return { ok: false, erreur: INTROUVABLE };
    numero = avant.numero;
    await modifierIncident(id, f.saisie);
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  await journaliser(prisma, {
    action: "conformite.incident.modifie",
    targetType: "IncidentDonnees",
    targetId: id,
    session: { userId: garde.auteur.id },
    changes: { numero },
  });
  return { ok: true, numero };
}

export async function cloreIncident(formData: FormData): Promise<ResultatIncident> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  const id = lireUuid(formData, "incidentId");
  if (!id) return { ok: false, erreur: INTROUVABLE };
  let numero: number;
  try {
    const l = await prisma.incidentDonnees.findUnique({
      where: { id },
      select: { numero: true, statut: true, declareCnil: true, motifNonDeclaration: true },
    });
    if (!l) return { ok: false, erreur: INTROUVABLE };
    numero = l.numero;
    if (l.statut === "clos") return { ok: false, erreur: "Incident déjà clos." };
    // Le motif est chiffré : non vide en clair ⇔ non vide chiffré.
    if (!decisionCnilPrise(l)) {
      return { ok: false, erreur: "Indiquez d'abord si la CNIL a été prévenue." };
    }
    await prisma.incidentDonnees.updateMany({
      where: { id, statut: "ouvert" },
      data: { statut: "clos", closLe: new Date() },
    });
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  await journaliser(prisma, {
    action: "conformite.incident.clos",
    targetType: "IncidentDonnees",
    targetId: id,
    session: { userId: garde.auteur.id },
    changes: { numero },
  });
  return { ok: true, numero };
}

// ─── Les actions des formulaires ───────────────────────────────────────────

function revenir(r: ResultatIncident, siErreur: string, siOk: (n: number) => string): never {
  const base = adminPath("fr", "conformite-rgpd");
  revalidatePath(base, "layout");
  if (r.ok) redirect(`${base}${siOk(r.numero)}`);
  redirect(`${base}${siErreur}erreur=${encodeURIComponent(r.erreur)}`);
}

/** L'état du formulaire : l'erreur, et la saisie renvoyée pour ne rien perdre. */
export interface EtatFormulaireIncident {
  erreur: string | null;
  valeurs: Record<string, string>;
  essai: number;
}

function saisieRenvoyee(formData: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of formData.entries()) {
    if (typeof x === "string" && !k.startsWith("$")) v[k] = x.slice(0, 5000);
  }
  return v;
}

/** Déclarer ou enregistrer : succès → la fiche ; erreur → le formulaire, saisie intacte. */
export async function formulaireIncidentAction(
  etat: EtatFormulaireIncident,
  formData: FormData,
): Promise<EtatFormulaireIncident> {
  const r = formData.has("incidentId")
    ? await enregistrerIncident(formData)
    : await declarerIncident(formData);
  if (!r.ok) {
    return { erreur: r.erreur, valeurs: saisieRenvoyee(formData), essai: etat.essai + 1 };
  }
  const base = adminPath("fr", "conformite-rgpd");
  revalidatePath(base, "layout");
  redirect(`${base}/incidents/${r.numero}?enregistre=1`);
}

/** Le numéro sert seulement à revenir sur la fiche ; l'identifiant fait foi. */
function numeroRetour(formData: FormData): string {
  const n = Number(formData.get("numero"));
  return Number.isInteger(n) && n > 0 ? `/incidents/${n}?` : "?onglet=incidents&";
}

export async function cloreIncidentAction(formData: FormData): Promise<void> {
  const r = await cloreIncident(formData);
  revenir(r, numeroRetour(formData), (n) => `/incidents/${n}?clos=1`);
}
