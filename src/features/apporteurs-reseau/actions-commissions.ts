// Réseau d'apporteurs (démarrage manuel) — actions de la console sur les COMMISSIONS.
//
// L'argent qui sort : même garde que la facturation (`peutEngager(role, "facturer")`,
// super-admin et admin). « Virement fait » exige `confirmer=oui`, posé par le bouton de
// confirmation seulement ; il ne génère AUCUN PDF (l'autofacture est déjà partie).

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";

import { classerActiviteCommission, qualifierCommission } from "./commissions";
import { marquerVerse } from "./facturation";
import { leverSuspension, suspendreCommission } from "./litige";
import { annulerRealisation, marquerPrestationRealisee } from "./realisation";
import { enregistrerReprise, montantEnCentimes, resilierApporteur } from "./resiliation";
import { euros } from "./regles";

export type EtatActionCommission =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessionArgent(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return "Seul un administrateur peut toucher aux commissions.";
  return null;
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

export async function qualifierCommissionAction(
  _prev: EtatActionCommission,
  fd: FormData,
): Promise<EtatActionCommission> {
  const refus = await sessionArgent();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  if (!UUID.test(id)) return { etat: "erreur", message: "Commission inconnue." };
  try {
    const quantite = Number(texte(fd, "quantite") || "1");
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > 99)
      return { etat: "erreur", message: "Le nombre de sessions doit être un entier de 1 à 99." };
    const r = await qualifierCommission(id, texte(fd, "palier"), quantite);
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    return { etat: "ok", message: `Qualifiée : ${euros(r.montantCents)}.` };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-qualifier" } });
    return { etat: "erreur", message: "Qualification impossible. Réessayez." };
  }
}

export async function marquerVerseAction(
  _prev: EtatActionCommission,
  fd: FormData,
): Promise<EtatActionCommission> {
  const refus = await sessionArgent();
  if (refus) return { etat: "erreur", message: refus };
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) return { etat: "erreur", message: "Apporteur inconnu." };
  if (texte(fd, "confirmer") !== "oui")
    return { etat: "erreur", message: "Confirme d'abord le virement." };
  const numero = texte(fd, "numero");
  if (numero && !/^AXI-APP-\d{4}-\d{4,}$/.test(numero))
    return { etat: "erreur", message: "Numéro d'autofacture inconnu." };
  try {
    const r = await marquerVerse(apporteurId, new Date(), numero || undefined);
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    return {
      etat: "ok",
      message: `Virement de ${euros(r.totalCents)} confirmé (${r.numeros.join(", ")}).`,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-verser" } });
    return {
      etat: "erreur",
      message: err instanceof Error ? err.message : "Confirmation impossible. Réessayez.",
    };
  }
}

// ── Fin de vie : résilier, enregistrer une reprise ───────────────────────
// Formulaires SANS JavaScript client (rendu serveur) : l'action redirige vers la fiche avec
// le résultat dans l'adresse (`?retour=` ou `?erreur=`), affiché par la page.

function versFiche(apporteurId: string, cle: "retour" | "erreur", message: string): never {
  redirect(`${adminPath("fr", `apporteurs/${apporteurId}`)}?${cle}=${encodeURIComponent(message)}`);
}

export async function resilierApporteurAction(fd: FormData): Promise<void> {
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) redirect(adminPath("fr", "apporteurs"));
  const refus = await sessionArgent();
  if (refus) versFiche(apporteurId, "erreur", refus);
  if (texte(fd, "confirmer") !== "oui")
    versFiche(apporteurId, "erreur", "Cochez la confirmation avant de résilier.");
  let r: Awaited<ReturnType<typeof resilierApporteur>>;
  try {
    r = await resilierApporteur(apporteurId);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-resilier" } });
    return versFiche(apporteurId, "erreur", "Résiliation impossible. Réessayez.");
  }
  revalidatePath(adminPath("fr", "apporteurs"));
  versFiche(apporteurId, r.ok ? "retour" : "erreur", r.message);
}

export async function enregistrerRepriseAction(fd: FormData): Promise<void> {
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) redirect(adminPath("fr", "apporteurs"));
  const refus = await sessionArgent();
  if (refus) versFiche(apporteurId, "erreur", refus);
  const commissionId = texte(fd, "commissionId");
  const montant = montantEnCentimes(texte(fd, "montant"));
  if (!UUID.test(commissionId))
    versFiche(apporteurId, "erreur", "Choisissez la commission versée.");
  if (montant === null)
    versFiche(apporteurId, "erreur", "Indiquez un montant en euros, par exemple 150,50.");
  if (texte(fd, "confirmer") !== "oui")
    versFiche(apporteurId, "erreur", "Cochez la confirmation avant d'enregistrer la reprise.");
  // La VRAIE date de l'annulation (remboursement, avoir) : c'est d'elle que court le délai de 24 mois.
  const jour = texte(fd, "annulationLe");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour))
    versFiche(apporteurId, "erreur", "Indiquez la date de l'annulation (remboursement ou avoir).");
  const annulationLe = new Date(`${jour}T12:00:00.000Z`);
  let r: Awaited<ReturnType<typeof enregistrerReprise>>;
  try {
    r = await enregistrerReprise({
      commissionId,
      apporteurId,
      demandeeCents: montant!,
      motif: texte(fd, "motif"),
      annulationLe,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-reprise" } });
    return versFiche(apporteurId, "erreur", "Enregistrement impossible. Réessayez.");
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  versFiche(apporteurId, r.ok ? "retour" : "erreur", r.message);
}

/** Classe une ligne « à qualifier » dont la facture ne portait pas d'activité (formulaire sans JS). */
export async function classerActiviteAction(fd: FormData): Promise<void> {
  const retour = adminPath("fr", "apporteurs/commissions");
  const refus = await sessionArgent();
  const id = texte(fd, "id");
  if (refus || !UUID.test(id)) redirect(retour);
  try {
    await classerActiviteCommission(id, texte(fd, "activite"));
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-classer" } });
  }
  revalidatePath(retour);
  redirect(retour);
}

// ── Contestation écrite du client (contrat 2.3, art. 4.2 bis) ────────────
// Formulaires sans JavaScript client : retour à la page des commissions.

function versCommissions(cle: "retour" | "erreur", message: string): never {
  redirect(`${adminPath("fr", "apporteurs/commissions")}?${cle}=${encodeURIComponent(message)}`);
}

async function acteur(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function suspendreCommissionAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await suspendreCommission(id, texte(fd, "motif"), new Date(), await acteur());
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-suspendre" } });
    r = { ok: false, message: "La suspension n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok) versCommissions("retour", "Commission suspendue : ni facturée ni versée.");
  versCommissions("erreur", r.message);
}

export async function leverSuspensionAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await leverSuspension(id, await acteur());
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-lever" } });
    r = { ok: false, message: "La levée n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok) versCommissions("retour", "Suspension levée : la commission reprend son cours.");
  versCommissions("erreur", r.message);
}

// ── Prestation réalisée (contrat 2.3, art. 4.2) ──────────────────────────

export async function marquerRealiseeAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  const jour = texte(fd, "realiseeLe");
  const realiseeLe = /^\d{4}-\d{2}-\d{2}$/.test(jour)
    ? new Date(`${jour}T12:00:00.000Z`)
    : new Date(NaN);
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await marquerPrestationRealisee(id, realiseeLe, new Date(), await acteur());
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-realisee" } });
    r = { ok: false, message: "La réalisation n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok)
    versCommissions("retour", "Prestation marquée réalisée : la commission peut être facturée.");
  versCommissions("erreur", r.message);
}

export async function annulerRealisationAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await annulerRealisation(id, await acteur());
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-realisation-annulee" } });
    r = { ok: false, message: "L'annulation n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok)
    versCommissions("retour", "Réalisation annulée : la commission est de nouveau en attente.");
  versCommissions("erreur", r.message);
}
