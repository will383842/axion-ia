"use server";

// « Étendre à toute l'entreprise » (contrat 2.6, art. 3.1 ; décision de Will, 09/10/2026) :
// l'apporteur qui a rencontré la direction d'une entreprise le demande à Williams, qui seul
// décide. Réservé aux ADMINISTRATEURS, journalisé (`etendreALEntreprise`).

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { notifierDecisionAttribution } from "./notification-attribution";
import {
  deciderAttribution,
  etendreALEntreprise,
  exclusionsDeLExtension,
  siretNet,
  siretValide,
  type Exclusion,
} from "./etablissement-presentation";
import type { EtatAction } from "./actions-presentations";

const ROLES = new Set(["super_admin", "admin"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(): Promise<{ id: string } | { erreur: string }> {
  const session = await auth();
  if (!session?.user?.id) return { erreur: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role)) return { erreur: "Réservé aux administrateurs." };
  return { id: session.user.id };
}

/** Avant de valider : ce que l'extension couvrira, et ce qu'elle exclura (art. 3.3). */
export async function apercuExtensionAction(
  id: string,
): Promise<{ ok: true; exclusions: Exclusion[] } | { ok: false; message: string }> {
  const a = await admin();
  if ("erreur" in a) return { ok: false, message: a.erreur };
  const pid = id.trim().toLowerCase();
  if (!UUID.test(pid)) return { ok: false, message: "Identifiant invalide." };
  try {
    const x = await exclusionsDeLExtension(pid);
    if (!x) return { ok: false, message: "Présentation introuvable." };
    return { ok: true, exclusions: x.exclusions };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apercu-extension" } });
    return { ok: false, message: "Aperçu impossible. Réessayez dans un instant." };
  }
}

/** Commande « à attribuer » : Williams choisit l'attribution candidate, ou aucune (art. 3.1). */
export async function deciderAttributionAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const a = await admin();
  if ("erreur" in a) return { etat: "erreur", message: a.erreur };
  const facture = String(fd.get("factureId") ?? "")
    .trim()
    .toLowerCase();
  const brut = String(fd.get("presentationId") ?? "")
    .trim()
    .toLowerCase();
  if (!UUID.test(facture)) return { etat: "erreur", message: "Identifiant invalide." };
  const presentationId = brut === "aucune" ? null : brut;
  if (presentationId !== null && !UUID.test(presentationId))
    return { etat: "erreur", message: "Choisissez l'attribution." };
  const motif = String(fd.get("motif") ?? "");
  try {
    const r = await deciderAttribution(facture, presentationId, a.id, new Date(), motif);
    if (!r.ok) return { etat: "erreur", message: r.message };
    await notifierDecisionAttribution({
      factureId: facture,
      choisie: presentationId,
      ecartes: r.ecartes,
      motif: r.motif,
    });
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    return {
      etat: "ok",
      message:
        presentationId === null
          ? "Aucun apporteur : aucune commission ne naîtra de cette commande. Le(s) candidat(s) écarté(s) en sont informés avec le motif."
          : "Attribuée : la commission naît au prochain passage (dans l'heure) ; l'apporteur est prévenu.",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "decider-attribution" } });
    return { etat: "erreur", message: "L'attribution a échoué. Réessayez dans un instant." };
  }
}

export async function etendreALEntrepriseAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const a = await admin();
  if ("erreur" in a) return { etat: "erreur", message: a.erreur };
  const brut = fd.get("id");
  const id = typeof brut === "string" ? brut.trim().toLowerCase() : "";
  if (!UUID.test(id)) return { etat: "erreur", message: "Identifiant invalide." };
  try {
    const r = await etendreALEntreprise(id, a.id);
    if (!r.ok) return { etat: "erreur", message: r.message };
    revalidatePath(adminPath("fr", "apporteurs/entreprises"));
    return {
      etat: "ok",
      message: r.exclusions.length
        ? `Attribution étendue à toute l'entreprise, sauf : ${r.exclusions.map((x) => `${x.siret} (${x.raison})`).join(" ; ")}.`
        : "Attribution étendue à toute l'entreprise.",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "etendre-a-l-entreprise" } });
    return { etat: "erreur", message: "L'extension a échoué. Réessayez dans un instant." };
  }
}

/**
 * Le SIRET de l'établissement qui COMMANDE, porté par le devis (facultatif ; contrat 2.6, art.
 * 3.1). Il passe avant celui de la fiche client pour attribuer la commande. Vide = retiré.
 */
export async function enregistrerSiretDevisAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const a = await admin();
  if ("erreur" in a) return { etat: "erreur", message: a.erreur };
  const devisId = String(fd.get("devisId") ?? "")
    .trim()
    .toLowerCase();
  if (!UUID.test(devisId)) return { etat: "erreur", message: "Identifiant invalide." };
  const brut = String(fd.get("siret") ?? "");
  const siret = siretNet(brut);
  if (brut.trim() !== "" && (!siret || !siretValide(siret)))
    return { etat: "erreur", message: "SIRET invalide : vérifiez les 14 chiffres." };
  try {
    await prisma.$transaction(async (tx) => {
      if (siret)
        await tx.devisEtablissement.upsert({
          where: { devisId },
          create: { devisId, siret },
          update: { siret },
        });
      else await tx.devisEtablissement.deleteMany({ where: { devisId } });
      await tx.activityLog.create({
        data: {
          adminUserId: a.id,
          action: "devis.siret_etablissement",
          targetType: "devis",
          targetId: devisId,
          changes: { siret } as object,
        },
      });
    });
    revalidatePath(adminPath("fr", `qualiopi/devis/${devisId}`));
    return {
      etat: "ok",
      message: siret ? `Établissement qui commande : ${siret}.` : "SIRET du devis retiré.",
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "siret-devis" } });
    return { etat: "erreur", message: "Enregistrement impossible. Réessayez dans un instant." };
  }
}
