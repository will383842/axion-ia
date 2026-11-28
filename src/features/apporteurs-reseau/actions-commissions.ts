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

import { annulerCommission, reduireCommission } from "./ajustement";
import { constaterNonCommissionne, marquerHorsGrille } from "./hors-grille";
import { classerActiviteCommission, qualifierCommission } from "./commissions";
import { marquerVerse } from "./facturation";
import { ouvrirRibAVirer } from "./rib-a-virer";
import { leverSuspension, suspendreCommission } from "./litige";
import { annulerRealisation, marquerPrestationRealisee } from "./realisation";
import { enregistrerReprise, montantEnCentimes, notifierResiliation } from "./resiliation";
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
  const compte = texte(fd, "compte");
  try {
    const r = await marquerVerse(apporteurId, new Date(), numero || undefined, {
      fin4Lue: texte(fd, "fin4"),
      compte: compte === "actuel" || compte === "precedent" ? compte : null,
      acteurId: (await auth())?.user?.id,
    });
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

/**
 * « Ouvrir le RIB à virer » (lot 7, D-6 option A). Formulaire sans JavaScript client : ouvre la pièce
 * RIB COURANTE par la route d'administration des pièces (antivirus compris) ; refus : retour à la fiche.
 * Aucun IBAN n'est rendu ; l'ouverture est journalisée.
 */
export async function ouvrirRibAVirerAction(fd: FormData): Promise<void> {
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) redirect(adminPath("fr", "apporteurs/commissions"));
  const refus = await sessionArgent();
  if (refus) versFiche(apporteurId, "erreur", refus);
  const session = await auth();
  const r = await ouvrirRibAVirer({
    apporteurId,
    acteur: { id: session!.user!.id!, role: (session!.user as { role?: string }).role },
  });
  if (!r.ok) versFiche(apporteurId, "erreur", r.message);
  redirect(adminPath("fr", `apporteurs/${apporteurId}/pieces/${r.pieceId}`));
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
  const adminId = (await auth())?.user?.id;
  if (!adminId) versFiche(apporteurId, "erreur", "Session expirée : reconnectez-vous.");
  const initiative = texte(fd, "initiative");
  const fondement = texte(fd, "fondement");
  if (initiative !== "societe" && initiative !== "apporteur")
    versFiche(apporteurId, "erreur", "Indiquez qui résilie.");
  if (fondement !== "11.1" && fondement !== "11.2" && fondement !== "12.5")
    versFiche(apporteurId, "erreur", "Choisissez le fondement de la résiliation.");
  const jour = (cle: string): Date | null => {
    const v = texte(fd, cle);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T12:00:00Z`);
    // Aller-retour : « 2026-02-31 » n'est pas une date.
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
  };
  const notifieeLe = jour("notifieeLe");
  if (!notifieeLe) versFiche(apporteurId, "erreur", "Indiquez la date de la notification écrite.");
  let r: Awaited<ReturnType<typeof notifierResiliation>>;
  try {
    r = await notifierResiliation({
      apporteurId,
      adminId: adminId!,
      initiative: initiative as "societe" | "apporteur",
      fondement: fondement as "11.1" | "11.2" | "12.5",
      notifieeLe: notifieeLe!,
      miseEnDemeureLe: jour("miseEnDemeureLe"),
      motif: texte(fd, "motif"),
    });
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
  let r: Awaited<ReturnType<typeof classerActiviteCommission>> | null = null;
  try {
    r = await classerActiviteCommission(id, texte(fd, "activite"));
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-classer" } });
  }
  revalidatePath(retour);
  // Le motif renvoyé (ex. « Commande antérieure au contrat 2.8 ») arrive à l'écran.
  if (r) versCommissions(r.ok ? "retour" : "erreur", r.message);
  versCommissions("erreur", "Classement impossible. Réessayez.");
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

// ── Réduire ou annuler une commission pas encore facturée ─────────────────

export async function ajusterCommissionAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  if (texte(fd, "confirmer") !== "oui")
    versCommissions("erreur", "Cochez la confirmation avant de modifier la commission.");
  const mode = texte(fd, "mode");
  const motif = texte(fd, "motif");
  let r: Awaited<ReturnType<typeof reduireCommission>>;
  try {
    if (mode === "annuler") {
      r = await annulerCommission(id, motif, await acteur());
    } else {
      // Le PRIX HT net conservé est saisi ; la commission est recalculée par la règle du contrat.
      const prix = montantEnCentimes(texte(fd, "prix"));
      r =
        prix === null
          ? { ok: false, message: "Indiquez le prix HT net conservé en euros, par exemple 1500." }
          : await reduireCommission(id, prix, motif, await acteur());
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-commission-ajuster" } });
    r = { ok: false, message: "La modification n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok) {
    const base =
      mode === "annuler"
        ? "Commission annulée : elle reste visible dans l'onglet « Annulées »."
        : `Commission recalculée : ${euros(r.montantCents ?? 0)}.`;
    versCommissions("retour", r.avertissement ? `${base} ⚠️ ${r.avertissement}` : base);
  }
  versCommissions("erreur", (r as { message: string }).message);
}

// ── Prestation hors grille (annexe 1, A1.7) ──────────────────────────────

export async function marquerHorsGrilleAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  const r = await marquerHorsGrille(id, await acteur());
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok)
    versCommissions(
      "retour",
      "Marquée hors grille : publiez sa commission (palier) ou constatez qu'elle n'est pas commissionnée, sous 60 jours.",
    );
  versCommissions("erreur", r.message);
}

export async function constaterNonCommissionneAction(fd: FormData): Promise<void> {
  const refus = await sessionArgent();
  if (refus) versCommissions("erreur", refus);
  const id = texte(fd, "id");
  if (!UUID.test(id)) versCommissions("erreur", "Commission inconnue.");
  if (texte(fd, "confirmer") !== "oui")
    versCommissions(
      "erreur",
      "Cochez la confirmation : l'apporteur reçoit la décision et son motif.",
    );
  let r: { ok: true } | { ok: false; message: string };
  try {
    r = await constaterNonCommissionne(id, texte(fd, "motif"), await acteur());
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-non-commissionne" } });
    r = { ok: false, message: "La décision n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(adminPath("fr", "apporteurs/commissions"));
  if (r.ok)
    versCommissions(
      "retour",
      "Constaté non commissionné : l'apporteur a reçu la décision et son motif.",
    );
  versCommissions("erreur", r.message);
}
