/**
 * TRAITEMENT D'UNE DEMANDE DE GUIDE VENUE D'UN RÉSEAU (lot PV-1, 2026-11-01).
 *
 * Le Studio (via Zernio) a obtenu l'adresse dans un message privé. Ici, côté site :
 *
 *   1. la demande du guide (`guide_requests`, origine `message_prive`, source
 *      `mot-{mot}:{reseau}`) est créée ou retrouvée — `derniereDemandeFormulaireAt` écrite ;
 *   2. le registre de preuve reçoit la ligne `information` (version du texte M1) ;
 *   3. l'e-mail du guide part, derrière les plafonds du guide (`mettreEnFileGuide` : coupe-circuit,
 *      3 par destinataire et par 24 h, 30 par heure). Au-delà, la demande attend le rattrapage.
 *
 * 🔴 DÉCISION DE WILL DU 03/11/2026 : ce parcours LIVRE LE GUIDE ET RIEN D'AUTRE. Aucune
 * question « autres informations », aucun double accord, aucune ligne `newsletter_subscribers`
 * créée ou modifiée, aucune ligne `optin`. L'e-mail porte le lien de la politique de
 * confidentialité et aucune proposition d'autres envois.
 * 🔴 Une adresse OPPOSÉE (`email_oppositions`) ne reçoit ni guide ni bouton : aucune réponse à la
 * personne, aucune ligne créée. Rien n'est supprimé.
 * 🔴 L'adresse n'est jamais journalisée, même partiellement : seul le début de l'empreinte de
 * recherche (`empreinteCourte`, non réversible) identifie une ligne de journal.
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { recordConsentEvent } from "@/lib/consents";
import { estOpposee } from "@/server/email/opposition";
import { domaineRecoitDesEmails } from "@/server/guide-ia/mx";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "@/server/guide-ia/envoi";
import { FORM_REF_INFORMATION_RESEAU, sourceReseau } from "@/content/guides-reseau";
import { checkRateLimit } from "@/lib/rate-limit";
import { occurredAtValide, type DemandeGuideReseau } from "./contrat";
import { LIMITE_JOUR_PAR_PERSONNE, LIMITE_JOUR_PAR_POST } from "./config";
import * as Sentry from "@sentry/nextjs";
import {
  CleHmacManquanteError,
  cleDedoublonnage,
  construireOrigine,
  enregistrerOrigine,
  type OrigineAEcrire,
} from "./origines";
import { transmettreOriginesSuivantes } from "./synchro-v3";

export type ResultatTraitement =
  | { readonly ok: false; readonly erreur: "adresse_refusee" | "trop_de_requetes" }
  | {
      readonly ok: true;
      readonly demandeId: string;
      readonly nouvelle: boolean;
      /** `opposee` : adresse opposée, rien n'est parti ni écrit. */
      readonly guide: ResultatEnvoiGuide | "opposee";
    };

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Ce dont la création de la demande a besoin : la demande du Studio, ou celle de la page. */
export type EntreeDemande = Pick<
  DemandeGuideReseau,
  "email" | "mot" | "reseau" | "guide" | "locale" | "versionTexteM1"
>;

/** Client Prisma ou transaction : la page y écrit le contact dans la MÊME transaction. */
export type ClientDemande = Pick<typeof prisma, "guideRequest">;

/**
 * Crée ou retrouve la demande du guide (cœur réutilisé par la page, lot S2 — comportement du
 * chemin « adresse tapée dans la conversation » inchangé). Dans une transaction (`db` ≠ client
 * global), un conflit d'unicité n'est PAS rattrapé : l'erreur a déjà fait échouer la transaction,
 * l'appelant la rejoue ; la page se protège par un verrou consultatif de l'adresse.
 */
export async function retrouverOuCreerDemande(
  d: EntreeDemande,
  emailKey: string,
  maintenant: Date,
  db: ClientDemande = prisma,
): Promise<{ id: string; downloadToken: string; nouvelle: boolean }> {
  const source = sourceReseau(d.mot, d.reseau);
  const cle = { emailKey_aimant: { emailKey, aimant: d.guide } };
  const existante = await db.guideRequest.findUnique({
    where: cle,
    select: { id: true, downloadToken: true, origine: true },
  });
  if (existante) {
    await db.guideRequest.update({
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
    const creee = await db.guideRequest.create({
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
    if (!estConflitUnique(e) || db !== prisma) throw e;
    const gagnante = await prisma.guideRequest.findUniqueOrThrow({
      where: cle,
      select: { id: true, downloadToken: true },
    });
    return { ...gagnante, nouvelle: false };
  }
}

/**
 * Limites par jour (cœur réutilisé par la page) : par personne, puis — si la demande vient d'un
 * post — par (post_ref, canal). `post` est `null` quand la demande n'en porte pas.
 */
export async function sousLesLimites(
  emailKey: string,
  maintenant: Date,
  post: { readonly ref: string; readonly canal: string | null } | null,
): Promise<boolean> {
  const jour = maintenant.toISOString().slice(0, 10);
  // Toutes versions signées (v1 comprise) : le débit par personne ne dépend pas du schéma.
  const parPersonne = await checkRateLimit(`guides-reseau:pers:${emailKey}:${jour}`, {
    limit: LIMITE_JOUR_PAR_PERSONNE,
    windowSec: 86_400,
  });
  if (!parPersonne.allowed) return false;
  if (post === null) return true;
  const parPost = await checkRateLimit(
    `guides-reseau:post:${post.ref}:${post.canal ?? "-"}:${jour}`,
    { limit: LIMITE_JOUR_PAR_POST, windowSec: 86_400 },
  );
  return parPost.allowed;
}

/** Historique d'origine (v3). Ne casse jamais la demande : le guide reste dû à la personne. */
export async function noterOrigineV3(
  d: DemandeGuideReseau,
  emailKey: string,
  quand: Date,
): Promise<void> {
  // Lot S3 (D1) : rien au CRM à la réception d'une PREMIÈRE demande ; l'événement part au clic du
  // lien. Lot guide réseau 4 : une origine suivante d'une personne qui a déjà cliqué part tout de
  // suite, en charge cumulative (interrupteur dédié, éteint par défaut).
  await noterOrigineAvec(() => construireOrigine(d, quand), d.email, emailKey);
}

/**
 * Cœur de `noterOrigineV3`, partagé avec la page « Recevoir le guide » (lot S2) : écrit l'origine
 * dans `guide_reseau_origines` puis tente la transmission des origines suivantes (jamais avant un
 * clic : `transmettreOriginesSuivantes` le vérifie). Ne lève jamais. La construction de l'origine
 * reste DANS le `try` (clé HMAC absente → alerte).
 */
export async function noterOrigineAvec(
  construire: () => OrigineAEcrire,
  email: string,
  emailKey: string,
): Promise<void> {
  try {
    const origine = construire();
    await enregistrerOrigine(emailKey, origine);
    await transmettreOriginesSuivantes({
      email,
      emailKey,
      guide: origine.guide,
      declenchante: cleDedoublonnage(origine),
    });
  } catch (e) {
    // Clé HMAC absente en production : ce n'est pas un aléa, c'est une panne de configuration.
    // JOURNAL + ALERTE (Sentry, sans donnée de personne) : jamais avalée en silence.
    const cleManquante = e instanceof CleHmacManquanteError;
    console.error(
      JSON.stringify({
        event: cleManquante ? "guides_reseau_origine_cle_manquante" : "guides_reseau_origine_echec",
        erreur: e instanceof Error ? e.name : "erreur",
      }),
    );
    if (cleManquante) {
      try {
        Sentry.captureException(e, {
          level: "error",
          tags: { area: "guides-reseau", action: "origine-cle-manquante" },
        });
      } catch {
        /* l'observabilité ne casse jamais la réponse */
      }
    }
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
  }) => Promise<void>;
}

/** Début (8 car.) de l'empreinte de recherche : suffit à relier deux lignes, ne dit rien de l'adresse. */
function empreinteCourte(emailKey: string): string {
  return emailKey.slice(0, 8);
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

  // Adresse opposée : ni guide, ni bouton, ni ligne. Réponse neutre (la clé se clôt).
  if (await estOpposee(d.email)) {
    console.warn(
      JSON.stringify({
        event: "guides_reseau_demande",
        adresse_empreinte: empreinteCourte(emailKey),
        reseau: d.reseau,
        guide: "opposee",
      }),
    );
    return { ok: true, demandeId: "", nouvelle: false, guide: "opposee" };
  }

  // I3 : limites par jour, par personne (v1 ET v3) et par (post_ref, canal) (v3). Rien n'est écrit avant.
  const post =
    d.schemaVersion === 3 && d.post_ref ? { ref: d.post_ref, canal: d.canal ?? null } : null;
  if (!(await sousLesLimites(emailKey, maintenant, post))) {
    return { ok: false, erreur: "trop_de_requetes" };
  }

  const quand = occurredAtValide(d.occurredAt, maintenant);
  const demande = await retrouverOuCreerDemande(d, emailKey, maintenant);

  // D4 (lot guide réseau 4) : une demande v1 laisse aussi une origine minimale (mot, réseau, guide).
  await noterOrigineV3(d, emailKey, quand);

  await recordConsentEvent({
    email: d.email,
    formRef: FORM_REF_INFORMATION_RESEAU,
    consentVersion: d.versionTexteM1,
    action: "information",
    occurredAt: quand,
  });

  const guide = await mettreEnFileGuide(
    {
      id: demande.id,
      email: d.email,
      locale: d.locale,
      downloadToken: demande.downloadToken,
    },
    { reseau: true, maintenant },
  );

  if (guide === "en-file" || guide === "en-validation") {
    await crochets.apresMiseEnFile?.({
      demandeId: demande.id,
      nouvelle: demande.nouvelle,
      guide,
    });
  }

  console.warn(
    JSON.stringify({
      event: "guides_reseau_demande",
      adresse_empreinte: empreinteCourte(emailKey),
      reseau: d.reseau,
      guide,
      nouvelle: demande.nouvelle,
    }),
  );
  return { ok: true, demandeId: demande.id, nouvelle: demande.nouvelle, guide };
}
