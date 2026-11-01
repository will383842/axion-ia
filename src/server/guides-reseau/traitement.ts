/**
 * TRAITEMENT D'UNE DEMANDE DE GUIDE VENUE D'UN RÉSEAU (lot PV-1, 2026-11-01).
 *
 * Le Studio (via Zernio) a obtenu l'adresse dans un message privé. Ici, côté site :
 *
 *   1. la demande du guide (`guide_requests`, origine `message_prive`, source
 *      `mot-{mot}:{reseau}`) est créée ou retrouvée — `derniereDemandeFormulaireAt` écrite ;
 *   2. le registre de preuve reçoit la ligne `information` (version du texte M1) ;
 *   3. SI « Oui » ET adresse non opposée ET pas déjà abonnée/désabonnée/rebondie : une
 *      inscription `pending` (double accord) — la ligne `optin` n'est écrite qu'au CLIC de
 *      confirmation (`confirmerLettre`), comme pour la lettre actuelle ;
 *   4. l'e-mail du guide part DANS TOUS LES CAS (accord, refus, ou opposition), derrière les
 *      plafonds du guide (`mettreEnFileGuide` : coupe-circuit, 3 par destinataire et par 24 h,
 *      30 par heure). Au-delà, la demande attend le rattrapage, qui la traite comme un formulaire.
 *
 * 🔴 Une opposition (`email_oppositions`) ne se lève JAMAIS par ce parcours : le guide part,
 * aucune inscription n'est créée, aucune donnée n'est supprimée.
 * 🔴 L'adresse n'est jamais journalisée en clair (`redactEmail`).
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { redactEmail } from "@/lib/pii-redaction";
import { recordConsentEvent } from "@/lib/consents";
import { estOpposee } from "@/server/email/opposition";
import { domaineRecoitDesEmails } from "@/server/guide-ia/mx";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "@/server/guide-ia/envoi";
import { lettreDansLEmail } from "@/server/guide-ia/lettre";
import {
  FORM_REF_ACCORD_RESEAU,
  FORM_REF_INFORMATION_RESEAU,
  sourceReseau,
} from "@/content/guides-reseau";
import { occurredAtValide, type DemandeGuideReseau } from "./contrat";

export type EtatAccord =
  | "non_demande"
  | "non"
  | "oui_en_attente_de_clic"
  | "oui_deja_confirme"
  /** Adresse opposée, désabonnée ou en rebond : le guide part, aucune campagne. */
  | "ecarte";

export type ResultatTraitement =
  | { readonly ok: false; readonly erreur: "adresse_refusee" }
  | {
      readonly ok: true;
      readonly demandeId: string;
      readonly nouvelle: boolean;
      readonly guide: ResultatEnvoiGuide;
      readonly accord: EtatAccord;
    };

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

async function retrouverOuCreerDemande(
  d: DemandeGuideReseau,
  emailKey: string,
  maintenant: Date,
): Promise<{ id: string; downloadToken: string; nouvelle: boolean }> {
  const source = sourceReseau(d.mot, d.reseau);
  const cle = { emailKey_aimant: { emailKey, aimant: d.guide } };
  const existante = await prisma.guideRequest.findUnique({
    where: cle,
    select: { id: true, downloadToken: true, origine: true },
  });
  if (existante) {
    await prisma.guideRequest.update({
      where: { id: existante.id },
      data: {
        locale: d.locale,
        version: d.versionTexteM1,
        derniereDemandeFormulaireAt: maintenant,
        // Une ligne née d'un envoi console devient celle de la personne (comme au formulaire).
        ...(existante.origine === "admin" ? { origine: "message_prive", source } : {}),
      },
      select: { id: true },
    });
    return { id: existante.id, downloadToken: existante.downloadToken, nouvelle: false };
  }
  try {
    const creee = await prisma.guideRequest.create({
      data: {
        email: d.email,
        emailKey,
        aimant: d.guide,
        origine: "message_prive",
        source,
        locale: d.locale,
        version: d.versionTexteM1,
        downloadToken: crypto.randomBytes(32).toString("hex"),
        derniereDemandeFormulaireAt: maintenant,
      },
      select: { id: true, downloadToken: true },
    });
    return { ...creee, nouvelle: true };
  } catch (e) {
    if (!estConflitUnique(e)) throw e;
    const gagnante = await prisma.guideRequest.findUniqueOrThrow({
      where: cle,
      select: { id: true, downloadToken: true },
    });
    return { ...gagnante, nouvelle: false };
  }
}

/** « Oui » : pose (ou retrouve) l'inscription EN ATTENTE du clic. Ne confirme jamais. */
async function demanderDoubleAccord(d: DemandeGuideReseau, opposee: boolean): Promise<EtatAccord> {
  if (opposee) return "ecarte";
  const source = sourceReseau(d.mot, d.reseau);
  const existant = await prisma.newsletterSubscriber.findUnique({
    where: { email: d.email },
    select: { id: true, status: true, confirmToken: true, unsubscribeToken: true },
  });
  if (existant === null) {
    try {
      await prisma.newsletterSubscriber.create({
        data: {
          email: d.email,
          locale: d.locale,
          status: "pending",
          confirmToken: crypto.randomBytes(32).toString("hex"),
          unsubscribeToken: crypto.randomBytes(32).toString("hex"),
          source,
          consentFormRef: FORM_REF_ACCORD_RESEAU,
          consentVersion: d.versionTexteM2 ?? null,
        },
        select: { id: true },
      });
      return "oui_en_attente_de_clic";
    } catch (e) {
      if (!estConflitUnique(e)) throw e;
      return "oui_en_attente_de_clic";
    }
  }
  switch (existant.status) {
    case "confirmed":
      return "oui_deja_confirme";
    case "pending": {
      // Le « Oui » le plus récent fait foi : une ligne `pending` ANCIENNE (ancien double
      // opt-in) est réécrite avec la référence et la version du texte réseau de CETTE
      // demande. Choix assumé ; elle reste `pending` tant que la personne n'a pas cliqué.
      // Jeton gardé s'il existe : le lien d'un e-mail précédent reste valable.
      await prisma.newsletterSubscriber.updateMany({
        where: { id: existant.id, status: "pending" },
        data: {
          locale: d.locale,
          source,
          consentFormRef: FORM_REF_ACCORD_RESEAU,
          consentVersion: d.versionTexteM2 ?? null,
          ...(existant.confirmToken
            ? {}
            : { confirmToken: crypto.randomBytes(32).toString("hex") }),
          ...(existant.unsubscribeToken
            ? {}
            : { unsubscribeToken: crypto.randomBytes(32).toString("hex") }),
        },
      });
      return "oui_en_attente_de_clic";
    }
    default:
      // `unsubscribed` / `bounced` : une demande de guide ne lève jamais une opposition.
      return "ecarte";
  }
}

export interface CrochetsTraitement {
  /**
   * Appelé DÈS que l'e-mail du guide est en file (`en-file` ou `en-validation`), avant tout
   * autre effet : l'appelant y écrit la marque « e-mail en file » du journal d'idempotence.
   */
  readonly apresMiseEnFile?: (r: {
    readonly demandeId: string;
    readonly nouvelle: boolean;
    readonly guide: ResultatEnvoiGuide;
    readonly accord: EtatAccord;
  }) => Promise<void>;
}

export async function traiterDemande(
  d: DemandeGuideReseau,
  maintenant: Date = new Date(),
  crochets: CrochetsTraitement = {},
): Promise<ResultatTraitement> {
  // Le domaine reçoit-il des e-mails ? « inconnu » (panne DNS) laisse passer.
  if ((await domaineRecoitDesEmails(d.email)) === "non") {
    return { ok: false, erreur: "adresse_refusee" };
  }
  const emailKey = hashEmailForLookup(d.email);
  if (!emailKey) throw new Error("[guides-reseau] empreinte d'adresse indisponible");

  const quand = occurredAtValide(d.occurredAt, maintenant);
  const opposee = await estOpposee(d.email);
  const demande = await retrouverOuCreerDemande(d, emailKey, maintenant);

  await recordConsentEvent({
    email: d.email,
    formRef: FORM_REF_INFORMATION_RESEAU,
    consentVersion: d.versionTexteM1,
    action: "information",
    occurredAt: quand,
  });

  let accord: EtatAccord;
  if (d.accord === "oui") accord = await demanderDoubleAccord(d, opposee);
  else accord = d.accord === "non" ? "non" : "non_demande";

  // L'e-mail porte ce que la ligne d'abonné dit AU MOMENT DE L'ENVOI.
  const dansLEmail = await lettreDansLEmail(d.email);
  const guide = await mettreEnFileGuide(
    {
      id: demande.id,
      email: d.email,
      locale: d.locale,
      downloadToken: demande.downloadToken,
    },
    {
      confirmToken: dansLEmail.confirmToken ?? null,
      // Le bloc « Oui, je confirme » n'est transmis que si CETTE demande dit « Oui » et que
      // l'adresse n'est pas écartée : une ancienne ligne `pending` réseau ne suffit pas
      // (opposition ultérieure, ou « Non » dit cette fois-ci).
      doubleAccordToken:
        accord === "oui_en_attente_de_clic" ? (dansLEmail.doubleAccordToken ?? null) : null,
      unsubscribeToken: dansLEmail.unsubscribeToken ?? null,
      maintenant,
    },
  );

  if (guide === "en-file" || guide === "en-validation") {
    await crochets.apresMiseEnFile?.({
      demandeId: demande.id,
      nouvelle: demande.nouvelle,
      guide,
      accord,
    });
  }

  // La trace d'envoi du bloc de confirmation suit l'envoi réel de l'e-mail.
  const jeton =
    (accord === "oui_en_attente_de_clic" ? dansLEmail.doubleAccordToken : undefined) ??
    dansLEmail.confirmToken;
  if (jeton && guide === "en-file") {
    await prisma.newsletterSubscriber
      .updateMany({
        where: { email: d.email, confirmToken: jeton },
        data: { confirmSentAt: maintenant },
      })
      .catch(() => undefined);
  }

  console.warn(
    JSON.stringify({
      event: "guides_reseau_demande",
      adresse: redactEmail(d.email),
      reseau: d.reseau,
      accord,
      guide,
      nouvelle: demande.nouvelle,
    }),
  );
  return { ok: true, demandeId: demande.id, nouvelle: demande.nouvelle, guide, accord };
}
