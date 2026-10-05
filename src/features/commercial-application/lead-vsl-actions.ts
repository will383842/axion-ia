// Capture en DEUX TEMPS du tunnel apporteurs avec vidéo — Server Actions
// (2026-10-05, lot 2 du plan `_PLAN-VSL-TUNNEL-APPORTEURS-2026-10-05`).
//
//   · `capturerLeadVsl`  — étape 1 : prénom + e-mail + consentement. Crée (ou
//     retrouve) la ligne, renvoie un JETON signé, programme la branche A des
//     messages (03-MESSAGES §2). AUCUNE notification d'équipe : un lead partiel
//     n'est pas encore un candidat.
//   · `completerLeadVsl` — étape 2 : téléphone + une question fermée. Complète
//     LA MÊME ligne (jeton), annule la branche A, envoie B1 (« C'est noté » +
//     bouton de réservation), la notification d'équipe N1 (UNE fois) et le
//     récapitulatif interne.
//
// ── Le contrat, tel que le consomme la page (développeur « front ») ─────────
//   capturerLeadVsl(input) → { ok: true, jeton, leadId } | { ok: false, error }
//   completerLeadVsl(input) → { ok: true, merciUrl } | { ok: false, error }
// `merciUrl` est SANS préfixe de langue (comme `TUNNEL_FACEBOOK_MERCI_PATH`) :
// à passer au routeur i18n. Le jeton y est dans `?j=`. Les liens de reprise des
// e-mails portent `?r=<jeton>` sur la page vidéo.
//
// ── Ce que ces actions NE font PAS ──────────────────────────────────────────
//   · aucun envoi au CRM (règle du 19/09 B2, garde
//     `le-dossier-apporteur-ne-part-pas-au-crm`) ;
//   · aucun événement Meta : il arrive au lot 5 ;
//   · aucune promesse de délai ni de rappel dans les messages (R8).
//
// ── Anti-doublon (R3), dans l'ordre ─────────────────────────────────────────
//   1. verrou court Redis par empreinte d'adresse (double clic, réseau lent) ;
//   2. recherche des lignes apporteur vivantes de la même empreinte :
//        · une ligne qui N'EST PAS un lead vidéo (ancien formulaire, dossier
//          commencé ou complet, saisie manuelle) : on ne crée RIEN, on ne
//          rétrograde RIEN, on répond exactement comme un succès — avec un jeton
//          qui ne mène à aucune ligne (voir `jeton-lead.ts`) ;
//        · un lead vidéo existant : on le réutilise (même identifiant, jeton
//          rafraîchi), sans nouvel e-mail ;
//        · sinon on crée ;
//   3. le plafond « 3 par jour et par adresse » s'applique aux CRÉATIONS, pas
//      aux reprises : quelqu'un qui revient trois fois n'est pas bloqué à tort.
//
// ── Anti-spam ───────────────────────────────────────────────────────────────
// Leurre (honeypot) → succès silencieux, rien d'écrit. Limite par IP. Délai
// minimal entre l'affichage et l'étape 1 (< 3 s) : la ligne est créée mais
// marquée « suspecte » — ni e-mail, ni notification, ni Meta. Un faux lead coûte
// de l'argent (il fausse le coût par apporteur et entraîne Meta vers de mauvais
// profils) ; l'envoyer à une adresse qui n'est pas celle du robot serait de
// l'abus.
//
// ── Écriture de `details.vsl` ───────────────────────────────────────────────
// Ciblée, jamais en réécrivant `details` en entier (`lead-vsl-details.ts`) : le
// passage du worker (`invitation-auto.ts`) et l'étape 2 peuvent se croiser.

"use server";

import { randomUUID } from "node:crypto";
import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { destinataireCandidatures } from "@/lib/destinataires-internes";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { SubmissionType } from "../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptPii, decryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import { getClientIp } from "@/lib/client-ip";
import { parseUtmFromUrl, readUtmCookie, UTM_COOKIE_NAME, type UtmParams } from "@/lib/utm";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/site-url";
import { estLienCalendlyValide } from "@/lib/calendly/lien-valide";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import {
  CANDIDATURE_COMMERCIALE_SUBTYPE,
  SOURCE_OPTIONS,
  optionLabel,
} from "@/lib/commercial-application/model";
import {
  DOSSIER_COMPLET_PATH,
  LEAD_APPORTEUR_ETAPE,
  extraireFbclid,
  sourceDepuisUtm,
} from "@/lib/commercial-application/lead-apporteur";
import {
  DELAI_MIN_ETAPE1_MS,
  DELAI_MIN_ETAPE2_MS,
  LEAD_APPORTEUR_VSL_CONSENT_VERSION,
  VSL_MERCI_PATH,
  VSL_PAGE_PATH,
  VSL_VERSION,
  libelleReponseVsl,
} from "@/lib/commercial-application/vsl-apporteur";
import {
  capturerLeadVslSchema,
  completerLeadVslSchema,
  type CapturerLeadVslParsed,
} from "@/lib/commercial-application/vsl-schemas";
import { creerJeton, verifierJeton } from "./jeton-lead";
import { avancerVslEtape2, lireVsl, majVslCible } from "./lead-vsl-details";
import {
  annulerRelancesLeadApporteur,
  envoyerEtape2Vsl,
  planifierRelancesVsl,
} from "./relances-lead-apporteur";

export type CapturerLeadVslResultat =
  | { ok: true; jeton: string; leadId: string }
  | { ok: false; error: "invalid" | "rate" | "unknown" };

export type CompleterLeadVslResultat =
  { ok: true; merciUrl: string } | { ok: false; error: "invalid" | "jeton" | "rate" | "unknown" };

export interface CapturerLeadVslInput {
  prenom: string;
  email: string;
  consent: boolean;
  consentPub?: boolean;
  honeypot?: string;
  ctx: {
    query: string;
    fbp?: string;
    referrer?: string;
    fbclid?: string;
    fbclidAt?: number;
    renderedAt: number;
  };
}

export interface CompleterLeadVslInput {
  jeton: string;
  telephone: string;
  reponseId: "moins-5" | "5-20" | "20-50" | "plus-50";
  consent: boolean;
}

/** Une fenêtre de plausibilité pour une heure donnée par le navigateur (jamais fiable). */
const FBCLID_AGE_MAX_MS = 90 * 24 * 3_600_000;

function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[lead-vsl] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

/** Un identifiant qui a la forme d'un UUID v4, déduit de l'empreinte d'adresse. */
function idSansLigne(emailKey: string | null): string {
  if (!emailKey || emailKey.length < 32) return randomUUID();
  const h = emailKey;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function fusionnerUtm(cookie: UtmParams, query: string | undefined): UtmParams {
  const depuisQuery = query ? parseUtmFromUrl(query) : {};
  return { ...depuisQuery, ...cookie };
}

/** Lien de réservation de l'échange apporteur, valide, ou `null`. */
function lienReservation(): string | null {
  const url = process.env["CALENDLY_APPORTEUR_URL"]?.trim();
  return url && estLienCalendlyValide(url) ? url : null;
}

interface LigneApporteur {
  id: string;
  details: unknown;
}

/** Les lignes apporteur VIVANTES (hors corbeille) d'une même personne, par empreinte. */
async function lignesDeLaPersonne(emailKey: string): Promise<LigneApporteur[]> {
  return prisma.submission.findMany({
    where: {
      contactEmailHash: emailKey,
      type: SubmissionType.contact,
      deletedAt: null,
      AND: [{ details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } }],
    },
    select: { id: true, details: true },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });
}

/** Ce que l'adresse a déjà chez nous : rien, un lead vidéo, ou autre chose (ancien parcours, dossier). */
type Existant =
  { genre: "aucun" } | { genre: "autre" } | { genre: "lead-vsl"; id: string; suspect: boolean };

function qualifier(lignes: LigneApporteur[]): Existant {
  if (lignes.length === 0) return { genre: "aucun" };
  // R3 : une ligne qui n'est pas un lead vidéo (ancien formulaire, dossier
  // commencé ou complet, saisie manuelle) PRIME — on ne rétrograde jamais.
  if (lignes.some((l) => !lireVsl(l.details))) return { genre: "autre" };
  const l = lignes[0] as LigneApporteur;
  return { genre: "lead-vsl", id: l.id, suspect: lireVsl(l.details)?.suspect === true };
}

const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Verrou court par adresse. Redis muet : on continue SANS verrou (la recherche
 * de ligne protège déjà la plupart des doublons) plutôt que de bloquer le tunnel.
 */
async function prendreVerrou(emailKey: string): Promise<boolean> {
  try {
    const r = await redis.set(`lead-vsl:verrou:${emailKey}`, "1", "EX", 10, "NX");
    return r === "OK";
  } catch {
    return true;
  }
}

async function rendreVerrou(emailKey: string): Promise<void> {
  try {
    await redis.del(`lead-vsl:verrou:${emailKey}`);
  } catch {
    // Expire seul au bout de 10 s.
  }
}

function reponseJeton(
  leadId: string,
  suspect: boolean,
): { ok: true; jeton: string; leadId: string } {
  return { ok: true, jeton: creerJeton({ lead: leadId, suspect }), leadId };
}

// ───────────────────────────────────────────────────────────────────────────
// ÉTAPE 1
// ───────────────────────────────────────────────────────────────────────────

export async function capturerLeadVsl(
  input: CapturerLeadVslInput,
): Promise<CapturerLeadVslResultat> {
  const ip = await getClientIp();

  // 1. Anti-martèlement par IP, consommé AVANT le parsing.
  const rl = await checkRateLimit(`lead-vsl:${ip}`, { limit: 20, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "rate" };

  // 2. Leurre : succès silencieux pour le robot, rien d'écrit, jeton sans ligne.
  if (typeof input?.honeypot === "string" && input.honeypot.length > 0) {
    await signalerHoneypot("lead-apporteur-vsl", input.honeypot);
    return reponseJeton(randomUUID(), true);
  }

  // 3. Parse.
  const parsed = capturerLeadVslSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  const emailKey = hashEmailForLookup(d.email);
  if (!emailKey) return { ok: false, error: "invalid" };

  try {
    const maintenant = Date.now();

    // 4. Verrou, puis ce que l'adresse a déjà chez nous.
    let verrouPris = await prendreVerrou(emailKey);
    let existant: Existant;
    if (verrouPris) {
      existant = qualifier(await lignesDeLaPersonne(emailKey));
    } else {
      // Un premier appel de la même adresse est en cours (double clic) : on
      // attend qu'il ait écrit sa ligne, puis on se comporte comme une reprise.
      existant = { genre: "aucun" };
      for (let i = 0; i < 6 && existant.genre === "aucun"; i++) {
        await attendre(300);
        existant = qualifier(await lignesDeLaPersonne(emailKey));
      }
      if (existant.genre === "aucun") return { ok: false, error: "unknown" };
    }

    try {
      if (existant.genre === "autre") {
        // Déjà connue (ancien parcours, dossier…) : aucun écrit, aucun e-mail, et
        // une réponse indiscernable d'un succès.
        return reponseJeton(idSansLigne(emailKey), false);
      }

      if (existant.genre === "lead-vsl") {
        // Reprise : même ligne, aucun nouvel e-mail ; seule la date du jeton bouge.
        try {
          await majVslCible(existant.id, { jetonVuLe: new Date(maintenant).toISOString() });
        } catch (err) {
          Sentry.captureException(err, { tags: { action: "capturerLeadVsl", step: "reprise" } });
        }
        return reponseJeton(existant.id, existant.suspect);
      }

      // 5. Création — le plafond par adresse ne compte QUE les créations.
      const rlEmail = await checkRateLimit(`lead-vsl:email:${emailKey}`, {
        limit: 3,
        windowSec: 86_400,
      });
      if (!rlEmail.allowed) return { ok: false, error: "rate" };

      return await creerLead(d, emailKey, ip, maintenant);
    } finally {
      if (verrouPris) await rendreVerrou(emailKey);
      verrouPris = false;
    }
  } catch (err) {
    console.error("[lead-vsl] échec de la capture:", err);
    Sentry.captureException(err, { tags: { action: "capturerLeadVsl", step: "persist" } });
    return { ok: false, error: "unknown" };
  }
}

async function creerLead(
  d: CapturerLeadVslParsed,
  emailKey: string,
  ip: string | null,
  maintenant: number,
): Promise<{ ok: true; jeton: string; leadId: string }> {
  // Attribution : cookie UTM du proxy (ce que le LIEN prouve) + requête d'arrivée.
  const c = await cookies();
  const utm = fusionnerUtm(readUtmCookie(c.get(UTM_COOKIE_NAME)?.value), d.ctx.query);
  const source = sourceDepuisUtm(utm.utm_source);
  const libelleSource = optionLabel(SOURCE_OPTIONS, source);
  const userAgent = (await headers()).get("user-agent") ?? null;
  const consentPub = d.consentPub;

  // Délai minimal : l'heure d'affichage est celle du NAVIGATEUR (jamais fiable) —
  // elle sert à écarter les robots pressés, pas à autoriser quoi que ce soit.
  const renderedAt = d.ctx.renderedAt;
  const suspect = renderedAt > maintenant + 5_000 || maintenant - renderedAt < DELAI_MIN_ETAPE1_MS;

  // fbclid : la VALEUR n'est gardée qu'avec le consentement publicitaire (le
  // navigateur ne la garde lui-même qu'avec) ; sans lui, seule sa présence l'est.
  const fbclid = d.ctx.fbclid ?? extraireFbclid(d.ctx.query);
  const fbclidAt =
    d.ctx.fbclidAt &&
    d.ctx.fbclidAt <= maintenant + 60_000 &&
    maintenant - d.ctx.fbclidAt <= FBCLID_AGE_MAX_MS
      ? d.ctx.fbclidAt
      : undefined;
  const funnel: Record<string, unknown> = {};
  if (Object.keys(utm).length > 0) funnel["utm"] = utm;
  if (fbclid) funnel["fbclid"] = true;
  if (fbclid && consentPub === true) {
    funnel["fbclidValeur"] = fbclid;
    funnel["fbcCreeLe"] = new Date(fbclidAt ?? maintenant).toISOString();
  }
  if (d.ctx.fbp && consentPub === true) funnel["fbp"] = d.ctx.fbp;
  const referrer = d.ctx.referrer?.trim();
  if (referrer) funnel["referrer"] = referrer.slice(0, 300);
  // Réponse à la bannière GARDÉE sur la fiche, avec sa date : un événement
  // envoyé plus tard (réservation) doit pouvoir savoir s'il en a le droit (lot 5).
  if (typeof consentPub === "boolean") {
    funnel["consentPub"] = { accepte: consentPub, le: new Date(maintenant).toISOString() };
  }

  const iso = new Date(maintenant).toISOString();
  const submission = await prisma.submission.create({
    data: {
      type: SubmissionType.contact,
      locale: "fr",
      companyName: "—",
      contactName: encryptPii(d.prenom),
      contactEmail: encryptPii(d.email),
      // 🔴 La clé de personne : sans elle, l'effacement art. 17 et l'export art. 15
      // raterait cette ligne en silence (cf. `lead-actions.ts`, PR #982).
      contactEmailHash: emailKey,
      details: {
        unifiedType: "recrutement",
        subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
        // Même échelle d'étapes qu'aujourd'hui : un lead vidéo est un « premier
        // contact » (`etapeDeLaLigne` n'a rien à changer).
        etape: LEAD_APPORTEUR_ETAPE,
        ville: "",
        message: `Inscription en cours depuis la page vidéo ${VSL_PAGE_PATH} (source : ${libelleSource}) — étape 1 sur 2 : le téléphone n'est pas encore donné.`,
        source: VSL_PAGE_PATH,
        consentVersion: LEAD_APPORTEUR_VSL_CONSENT_VERSION,
        ...(Object.keys(funnel).length > 0 ? { funnel: funnel as object } : {}),
        candidature: {
          version: 2,
          etape: LEAD_APPORTEUR_ETAPE,
          ville: "",
          experiences: [],
          sourceConnaissance: source,
        },
        vsl: {
          version: VSL_VERSION,
          etapeAtteinte: 1,
          atteinte: { e1: iso },
          jetonVuLe: iso,
          ...(suspect ? { suspect: true } : {}),
        },
      } as object,
      ipAddress: ip,
      ipHash: safeHashIp(ip),
      userAgent,
    },
  });

  if (suspect) {
    // Ligne gardée (on voit le robot), mais ni preuve de consentement d'une
    // personne, ni message, ni notification.
    return reponseJeton(submission.id, true);
  }

  // Preuve de consentement : le texte v3, celui de la case réellement cochée.
  try {
    await recordConsentEvent({
      email: d.email,
      formRef: CONSENT_FORM_REFS.leadApporteur,
      consentVersion: LEAD_APPORTEUR_VSL_CONSENT_VERSION,
      action: "optin",
      occurredAt: submission.submittedAt,
      ip,
      userAgent,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "capturerLeadVsl", step: "consentement" } });
  }

  // Branche A (03-MESSAGES §2) : A1 à +30 min, A2 à +2 j, A3 à +7 j, tous
  // annulés par l'étape 2, le dossier complet ou une réservation. Le lien de
  // REPRISE vit 10 jours : il doit encore valoir au dernier rappel.
  try {
    const reprise = creerJeton({ lead: submission.id, genre: "reprise" });
    await planifierRelancesVsl({
      email: d.email,
      prenom: d.prenom,
      reprendreUrl: `${SITE_URL}/fr${VSL_PAGE_PATH}?r=${encodeURIComponent(reprise)}`,
      submissionId: submission.id,
    });
  } catch (err) {
    console.error("[lead-vsl] relances non planifiées:", err);
    Sentry.captureException(err, { tags: { action: "capturerLeadVsl", step: "relances" } });
  }

  // L'événement Meta `Lead` (étape 1) est posé au lot 5.
  return reponseJeton(submission.id, false);
}

// ───────────────────────────────────────────────────────────────────────────
// ÉTAPE 2
// ───────────────────────────────────────────────────────────────────────────

function urlMerci(leadId: string, suspect: boolean): string {
  return `${VSL_MERCI_PATH}?j=${encodeURIComponent(creerJeton({ lead: leadId, suspect }))}`;
}

export async function completerLeadVsl(
  input: CompleterLeadVslInput,
): Promise<CompleterLeadVslResultat> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`lead-vsl-2:${ip}`, { limit: 30, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "rate" };

  const parsed = completerLeadVslSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;

  // Le jeton prouve QUI complète : sans jeton valide et non expiré, rien n'est
  // ni lu ni écrit.
  const jeton = verifierJeton(d.jeton);
  if (!jeton) return { ok: false, error: "jeton" };

  try {
    const ligne = await prisma.submission.findFirst({
      where: { id: jeton.lead, deletedAt: null },
      select: {
        id: true,
        contactName: true,
        contactEmail: true,
        details: true,
      },
    });
    // Aucune ligne derrière le jeton (adresse déjà connue, robot, ligne effacée)
    // ou ligne qui n'est pas un lead vidéo : même réponse qu'un succès, rien
    // d'écrit — c'est ce qui empêche de découvrir qu'une adresse existe.
    if (!ligne || !lireVsl(ligne.details)) {
      return { ok: true, merciUrl: urlMerci(jeton.lead, jeton.suspect) };
    }

    const vsl = lireVsl(ligne.details);
    const maintenant = Date.now();
    const tropRapide = jeton.genre === "saisie" && maintenant - jeton.iat < DELAI_MIN_ETAPE2_MS;
    const suspect = jeton.suspect || vsl?.suspect === true || tropRapide;

    const issue = await avancerVslEtape2({
      id: ligne.id,
      telephoneChiffre: encryptPii(d.telephone) ?? null,
      reponseId: d.reponseId,
      suspect,
      maintenant: new Date(maintenant),
    });
    if (issue === "introuvable") {
      return { ok: true, merciUrl: urlMerci(jeton.lead, jeton.suspect) };
    }
    const merciUrl = urlMerci(ligne.id, suspect);
    // Étape 2 déjà atteinte (double clic, retour en arrière) : même réponse,
    // aucun second message, aucune seconde notification.
    if (issue === "deja") return { ok: true, merciUrl };
    if (suspect) return { ok: true, merciUrl };

    await suiteEtape2({
      ligne,
      telephone: d.telephone,
      reponseId: d.reponseId,
      merciUrl,
    });
    return { ok: true, merciUrl };
  } catch (err) {
    console.error("[lead-vsl] échec de l'étape 2:", err);
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "persist" } });
    return { ok: false, error: "unknown" };
  }
}

/**
 * Ce qui part APRÈS une transition réussie vers l'étape 2 (best-effort, chaque
 * geste isolé : un échec de notification ne perd ni la ligne ni l'e-mail).
 */
async function suiteEtape2(a: {
  ligne: { id: string; contactName: string; contactEmail: string; details: unknown };
  telephone: string;
  reponseId: string;
  merciUrl: string;
}): Promise<void> {
  let email: string | null = null;
  let prenom = "";
  try {
    email = decryptPii(a.ligne.contactEmail);
    prenom = decryptPii(a.ligne.contactName) ?? "";
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "pii" } });
  }
  // Une fiche effacée (art. 17) ne reçoit rien.
  if (!email || prenom === ERASED_PLACEHOLDER || email.endsWith("@erased.local")) return;

  // R1/R2 : toute avancée annule les tâches des états précédents (A1, A2, A3).
  try {
    await annulerRelancesLeadApporteur(
      email,
      "Envoi annulé : l'étape 2 de l'inscription est validée.",
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "annuler" } });
  }

  // B1 : « C'est noté » + bouton de réservation. Un seul par adresse.
  try {
    await envoyerEtape2Vsl({
      email,
      prenom,
      // Sans lien Calendly valide, le bouton mène à la page de remerciement,
      // qui sait afficher le choix du créneau.
      calendlyUrl: lienReservation() ?? `${SITE_URL}/fr${a.merciUrl}`,
      dossierUrl: `${SITE_URL}/fr${DOSSIER_COMPLET_PATH}`,
      submissionId: a.ligne.id,
    });
  } catch (err) {
    console.error("[lead-vsl] e-mail B1 non envoyé:", err);
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "email-b1" } });
  }

  const details =
    a.ligne.details && typeof a.ligne.details === "object"
      ? (a.ligne.details as Record<string, unknown>)
      : {};
  const funnel = (details["funnel"] ?? {}) as { utm?: UtmParams };
  const candidature = (details["candidature"] ?? {}) as { sourceConnaissance?: string };
  const libelleSource = optionLabel(SOURCE_OPTIONS, candidature.sourceConnaissance ?? "facebook");

  // N1 : UNE seule notification à l'équipe, au moment où le lead est « qualifié ».
  try {
    await notify({
      category: "COMMERCIAL_APPLICATION_RECEIVED",
      payload: {
        submissionId: a.ligne.id,
        contactName: prenom,
        contactEmail: email,
        contactPhone: a.telephone,
        ville: "— à demander lors de l'échange",
        zone: "—",
        b2bYears: `à qualifier (page vidéo ${libelleSource})`,
        availability: "—",
        usesAi: false,
        locale: "fr",
      },
      dedupKey: a.ligne.id,
    });
  } catch (err) {
    console.error("[lead-vsl] notify best-effort a échoué:", err);
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "notify" } });
  }

  // Récapitulatif interne — même gabarit que le formulaire court.
  try {
    await enqueueEmail("candidature-commercial-recap", destinataireCandidatures(), "fr", {
      prenom,
      nom: "",
      ville: "",
      rows: [
        {
          label: "Étape",
          value: `Inscription terminée (page vidéo, ${libelleSource}) — le choix du créneau suit`,
        },
        { label: "Prénom", value: prenom },
        { label: "Email", value: email },
        { label: "Téléphone", value: a.telephone },
        { label: "Dirigeants connus", value: libelleReponseVsl(a.reponseId) },
        ...(funnel.utm
          ? [
              {
                label: "Campagne",
                value: [funnel.utm.utm_campaign, funnel.utm.utm_content]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]
          : []),
      ],
      experiences: [],
      pitch: "",
      submissionId: a.ligne.id,
      consoleUrl: `${SITE_URL}${adminPath("fr", "contacts/commercial")}/${a.ligne.id}`,
    });
  } catch (err) {
    console.error("[lead-vsl] récap interne a échoué:", err);
    Sentry.captureException(err, { tags: { action: "completerLeadVsl", step: "email-recap" } });
  }
}
