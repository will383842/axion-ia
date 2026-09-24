/**
 * UNE DEMANDE DU GUIDE, de bout en bout côté serveur (lot L2, 2026-09-24).
 *
 * Appelée par la Server Action du formulaire APRÈS les contrôles d'entrée
 * (débit par IP, piège à robots, Turnstile bloquant, validation, MX). Elle :
 *
 *   1. enregistre (ou retrouve) la demande dans `guide_requests` — une ligne par
 *      adresse, le lien personnel ne change pas d'une demande à l'autre ;
 *   2. si — et seulement si — la case « lettre » est cochée, inscrit l'adresse
 *      en `pending` (double opt-in) ;
 *   3. met en file UN seul e-mail, « Votre guide », qui porte aussi le bouton de
 *      confirmation de la lettre quand il y a lieu ;
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
import { AIMANT_GUIDE_IA } from "./config";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "./envoi";
import { inscrireALaLettre } from "./lettre";

export interface NouvelleDemandeGuide {
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly source: string | null;
  /** Version de la mention d'information affichée. */
  readonly versionMention: string;
  /** Case « lettre » cochée : sa référence et sa version de texte. */
  readonly lettre: { readonly formRef: string; readonly version: string } | null;
  readonly ipHash: string | null;
}

export interface ResultatDemandeGuide {
  readonly demandeId: string;
  readonly envoi: ResultatEnvoiGuide;
  readonly lettre: "a-confirmer" | "deja-abonnee" | "non-demandee";
}

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Crée la ligne, ou retrouve celle de cette adresse (une par personne et par aimant). */
async function retrouverOuCreer(
  entree: NouvelleDemandeGuide,
  emailKey: string,
): Promise<{ id: string; downloadToken: string; nouvelle: boolean }> {
  const cle = { emailKey_aimant: { emailKey, aimant: AIMANT_GUIDE_IA } };
  const existante = await prisma.guideRequest.findUnique({
    where: cle,
    select: { id: true, downloadToken: true },
  });
  if (existante) {
    // La langue suit la DERNIÈRE demande ; la provenance reste la PREMIÈRE
    // (c'est elle qui dit par où la personne est arrivée).
    await prisma.guideRequest.update({
      where: { id: existante.id },
      data: { locale: entree.locale, version: entree.versionMention },
      select: { id: true },
    });
    return { ...existante, nouvelle: false };
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

  const demande = await retrouverOuCreer(entree, emailKey);

  let confirmToken: string | null = null;
  let abonneId: string | null = null;
  let lettre: ResultatDemandeGuide["lettre"] = "non-demandee";
  if (entree.lettre) {
    const r = await inscrireALaLettre({
      email: entree.email,
      locale: entree.locale,
      source: entree.source,
      ipHash: entree.ipHash,
      formRef: entree.lettre.formRef,
      version: entree.lettre.version,
    });
    lettre = r.etat;
    abonneId = r.id;
    if (r.etat === "a-confirmer") confirmToken = r.confirmToken;
  }

  const envoi = await mettreEnFileGuide(
    {
      id: demande.id,
      email: entree.email,
      locale: entree.locale,
      downloadToken: demande.downloadToken,
    },
    { confirmToken },
  );

  // La confirmation de la lettre voyage DANS l'e-mail du guide : elle n'est
  // « envoyée » que si cet e-mail est parti en file. Même contrat que le
  // 2026-09-05 — la trace suit l'envoi, jamais l'intention.
  if (confirmToken && abonneId && envoi === "en-file") {
    await prisma.newsletterSubscriber
      .update({ where: { id: abonneId }, data: { confirmSentAt: new Date() } })
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

  if (lettre === "a-confirmer") {
    await notify({
      category: "NEWSLETTER_PENDING",
      payload: { email: redactEmail(entree.email), locale: entree.locale },
      dedupKey: `newsletter-pending-${abonneId}`,
    }).catch(() => undefined);
  }

  return { demandeId: demande.id, envoi, lettre };
}
