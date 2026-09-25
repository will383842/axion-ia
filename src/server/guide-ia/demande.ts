/**
 * UNE DEMANDE DU GUIDE, de bout en bout côté serveur (lot L2, 2026-09-24).
 *
 * Appelée par la Server Action du formulaire APRÈS les contrôles d'entrée
 * (débit par IP, piège à robots, Turnstile bloquant, validation, MX). Elle :
 *
 *   1. enregistre (ou retrouve) la demande dans `guide_requests` — une ligne par
 *      adresse, le lien personnel ne change pas d'une demande à l'autre ;
 *   2. décide la LETTRE d'après la nature de l'adresse, CÔTÉ SERVEUR
 *      (amendement de Will du 24/09) : adresse professionnelle → inscrite
 *      (intérêt légitime) ; adresse personnelle → inscrite seulement si la case
 *      est cochée (consentement). Ce qu'envoie le navigateur ne décide pas de
 *      la nature ;
 *   3. met en file UN seul e-mail, « Votre guide », qui porte aussi le lien de
 *      désinscription de la lettre (abonnée) ou le bouton de réinscription
 *      (désabonnée à qui l'on propose de revenir) ;
 *   4. prévient Telegram, adresse MASQUÉE (ADR 0010).
 *
 * Elle ne lève pas pour un envoi retenu : l'internaute voit toujours « c'est
 * parti » (anti-énumération : une adresse bloquée ne doit pas apprendre son
 * statut). Le défaut est dit en console, et la demande attend le rattrapage.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { redactEmail } from "@/lib/pii-redaction";
import { notify } from "@/server/notifications";
import { natureAdresse, type NatureAdresse } from "@/lib/email/nature-adresse";
import {
  FORM_REF_LETTRE,
  VERSION_LETTRE,
  VERSION_MENTION,
  type VarianteFormulaireGuide,
} from "@/content/guide-ia-formulaire";
import { auPlus } from "@/server/crm-sync/enqueue";
import { transmettreInscriptionApresClic } from "@/server/crm-sync/lettre-guide";
import { AIMANT_GUIDE_IA } from "./config";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "./envoi";
import { inscrireALaLettre, lettreDansLEmail, type ResultatInscriptionLettre } from "./lettre";

export interface NouvelleDemandeGuide {
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly source: string | null;
  /** Point de collecte : il fixe la référence et la version des textes affichés. */
  readonly variante: VarianteFormulaireGuide;
  /** Case « lettre » cochée. Sans effet pour une adresse professionnelle. */
  readonly caseLettre: boolean;
  readonly ipHash: string | null;
  /** IP et agent du geste, hachés par le registre de preuve. */
  readonly ip?: string | null;
  readonly userAgent?: string | null;
}

export type EtatLettreDemande = ResultatInscriptionLettre["etat"] | "non-demandee";

export interface ResultatDemandeGuide {
  readonly demandeId: string;
  readonly envoi: ResultatEnvoiGuide;
  readonly nature: NatureAdresse;
  readonly lettre: EtatLettreDemande;
}

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Crée la ligne, ou retrouve celle de cette adresse (une par personne et par aimant). */
async function retrouverOuCreer(
  entree: NouvelleDemandeGuide & { readonly versionMention: string; readonly maintenant: Date },
  emailKey: string,
): Promise<{ id: string; downloadToken: string; nouvelle: boolean }> {
  const cle = { emailKey_aimant: { emailKey, aimant: AIMANT_GUIDE_IA } };
  const existante = await prisma.guideRequest.findUnique({
    where: cle,
    select: { id: true, downloadToken: true, origine: true },
  });
  if (existante) {
    // La langue suit la DERNIÈRE demande ; la provenance reste la PREMIÈRE
    // (c'est elle qui dit par où la personne est arrivée).
    //
    // 🔴 Lot L3 — sauf si la ligne est née d'un envoi CONSOLE (`origine =
    // admin`) : la personne vient de demander le guide elle-même, la ligne
    // devient la sienne (`formulaire`, avec la provenance du formulaire).
    // Restée `admin`, elle ne serait jamais reprise par le rattrapage, qui ne
    // rejoue que les demandes du formulaire.
    const repriseDeLaConsole = existante.origine === "admin";
    await prisma.guideRequest.update({
      where: { id: existante.id },
      data: {
        locale: entree.locale,
        version: entree.versionMention,
        // L6 (relecture du 25/09) — SEUL écrivain de cette date : une demande
        // de la personne, par le formulaire, fait courir les 3 ans de
        // conservation. La console et le rattrapage n'y touchent jamais
        // (cliquet : `retention.spec.ts`).
        derniereDemandeFormulaireAt: entree.maintenant,
        ...(repriseDeLaConsole ? { origine: "formulaire", source: entree.source } : {}),
      },
      select: { id: true },
    });
    return { id: existante.id, downloadToken: existante.downloadToken, nouvelle: false };
  }
  try {
    const creee = await prisma.guideRequest.create({
      data: {
        email: entree.email,
        emailKey,
        aimant: AIMANT_GUIDE_IA,
        origine: "formulaire",
        source: entree.source,
        locale: entree.locale,
        version: entree.versionMention,
        downloadToken: crypto.randomBytes(32).toString("hex"),
        derniereDemandeFormulaireAt: entree.maintenant,
      },
      select: { id: true, downloadToken: true },
    });
    return { ...creee, nouvelle: true };
  } catch (e) {
    // Deux soumissions simultanées de la même adresse : la seconde relit la
    // ligne que la première vient de créer.
    if (!estConflitUnique(e)) throw e;
    const gagnante = await prisma.guideRequest.findUniqueOrThrow({
      where: cle,
      select: { id: true, downloadToken: true },
    });
    return { ...gagnante, nouvelle: false };
  }
}

export async function enregistrerDemandeGuide(
  entree: NouvelleDemandeGuide,
): Promise<ResultatDemandeGuide> {
  const emailKey = hashEmailForLookup(entree.email);
  if (!emailKey) throw new Error("[guide-ia] adresse vide — la validation aurait dû l'arrêter");

  // 🔑 La nature se décide ICI, jamais d'après le navigateur.
  const nature = natureAdresse(entree.email);
  const versionMention = VERSION_MENTION[nature];
  const demande = await retrouverOuCreer(
    { ...entree, versionMention, maintenant: new Date() },
    emailKey,
  );

  let lettre: EtatLettreDemande = "non-demandee";
  let abonneId: string | null = null;
  const base = nature === "pro" ? "interet-legitime" : entree.caseLettre ? "consentement" : null;
  if (base !== null) {
    const r = await inscrireALaLettre({
      email: entree.email,
      locale: entree.locale,
      source: entree.source,
      base,
      formRef: FORM_REF_LETTRE[entree.variante],
      // Intérêt légitime : le texte prouvé est la MENTION ; consentement : la CASE.
      version: base === "interet-legitime" ? versionMention : VERSION_LETTRE[entree.variante],
      ipHash: entree.ipHash,
      ip: entree.ip ?? null,
      userAgent: entree.userAgent ?? null,
    });
    lettre = r.etat;
    abonneId = r.id;
  }

  // Lot L4-S (relecture du 25/09) — une inscription faite APRÈS un premier
  // clic déjà transmis au CRM (adresse perso : guide seul, puis la case à une
  // nouvelle demande) n'attend pas un second clic : l'adresse est déjà
  // vérifiée. Derrière `CRM_SYNC_GUIDE_ENABLED` (fermé : aucune lecture). Ne
  // lève pas ; attente bornée, la mise en file n'est jamais attendue.
  if (lettre === "inscrite") {
    await auPlus(transmettreInscriptionApresClic(demande.id), 1_500);
  }

  // Ce que l'e-mail porte pour la lettre se lit sur la ligne d'abonné, quelle
  // que soit la case : une personne déjà abonnée reçoit toujours son lien de
  // désinscription.
  const dansLEmail = await lettreDansLEmail(entree.email);

  const envoi = await mettreEnFileGuide(
    {
      id: demande.id,
      email: entree.email,
      locale: entree.locale,
      downloadToken: demande.downloadToken,
    },
    {
      confirmToken: dansLEmail.confirmToken ?? null,
      unsubscribeToken: dansLEmail.unsubscribeToken ?? null,
    },
  );

  // Le bouton de réinscription voyage DANS l'e-mail du guide : il n'est
  // « envoyé » que si cet e-mail est parti en file. Même contrat que le
  // 2026-09-05 — la trace suit l'envoi, jamais l'intention.
  if (dansLEmail.confirmToken && envoi === "en-file") {
    await prisma.newsletterSubscriber
      .updateMany({
        where: { email: entree.email, confirmToken: dansLEmail.confirmToken },
        data: { confirmSentAt: new Date() },
      })
      .catch(() => undefined);
  }

  // Telegram : adresse MASQUÉE (ADR 0010). Au-delà de quelques demandes par
  // heure, la catégorie est bridée (`routing.ts`) et le récapitulatif
  // quotidien de la sentinelle prend le relais.
  await notify({
    category: "GUIDE_REQUESTED",
    payload: {
      email: redactEmail(entree.email),
      locale: entree.locale,
      source: entree.source ?? "inconnue",
      lettre,
      envoi,
      nouvelle: demande.nouvelle,
    },
    dedupKey: `guide-ia-${demande.id}-${new Date().toISOString().slice(0, 13)}`,
  }).catch(() => undefined);

  if (lettre === "inscrite" && abonneId) {
    await notify({
      category: "NEWSLETTER_CONFIRMED",
      payload: { email: redactEmail(entree.email), locale: entree.locale },
      dedupKey: `newsletter-confirmed-${abonneId}`,
    }).catch(() => undefined);
  }

  return { demandeId: demande.id, envoi, nature, lettre };
}
