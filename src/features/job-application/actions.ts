// Server Action candidature à une offre d'emploi (multipart + upload CV).
// Calquée sur submitUnifiedContactAction pour rate-limit/honeypot/Turnstile/
// encryptPii/notify/email, mais gère un FICHIER (CV) — net-neuf (aucun upload
// dans les forms existants). Stockage disque dédié (cv-storage), hors web-root.

"use server";

import { z } from "zod";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashIp } from "@/lib/security/ip-hash";
import { getClientIp } from "@/lib/client-ip";
import { parseLocale } from "@/lib/schemas/locale";
// La provenance est LUE, jamais demandée : le cookie est posé par le proxy au
// premier clic, avant tout formulaire. Ajouter un champ « comment nous
// avez-vous connus ? » aurait produit une seconde vérité, divergente et
// facultative — celle du tunnel commercial diverge déjà de ses UTM, et c'est
// justement l'écart qu'on veut pouvoir lire plutôt que subir.
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { provenanceDepuisLeTunnel } from "@/lib/careers/provenance";
import { notify } from "@/server/notifications";
import { isVideoEditorOffer } from "@/lib/careers/video-editor-offer";
import { candidateFamilyForOffer } from "@/lib/careers/candidate-family";
import { syncCandidateToCrm } from "@/server/crm-sync";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { enqueueEmail } from "@/server/queue/queues";
import { adminPath } from "@/lib/admin-path";
import {
  storeCv,
  CV_MAX_BYTES,
  CV_ALLOWED_EXTENSIONS,
  CV_ALLOWED_MIME,
} from "@/server/careers/cv-storage";
import type { Prisma } from "../../../prisma/generated/client";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";

/**
 * Version v2 (lot L4) — FERME, décidée au plan §2.3. Elle recouvre DEUX textes
 * affichés ensemble : la case obligatoire (étude de la candidature) et la case
 * optionnelle, décochée par défaut (conservation en vivier 2 ans).
 *
 * 🔴 Le CRM REJETTE en 422 toute fiche candidat dont la version n'est pas v2 :
 * cette constante et la liste côté CRM doivent bouger ensemble. Elle tient dans
 * `consent_version VARCHAR(40)` (21 caractères).
 */
const CONSENT_VERSION = "careers-v2-2026-08-13";

export type JobApplicationState =
  { ok: true; applicationId: string } | { ok: false; error: string };

const opt = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(max).optional());

const appSchema = z.object({
  /**
   * L'offre visée — ABSENTE pour une candidature spontanée.
   *
   * 🔑 `.optional()` et non une chaîne vide : `z.string().uuid()` refuserait
   * `""` avec « Champs invalides », un message qui n'accuse rien et que le
   * candidat ne peut pas corriger.
   */
  offerId: z.preprocess(
    // 🔴 `formData.get()` rend **`null`**, pas `undefined`, quand le champ est
    // absent — et `.optional()` n'accepte que `undefined`. Sans ce
    // prétraitement, toute candidature spontanée était refusée par « Champs
    // invalides », un message qui n'accuse rien et que le candidat ne peut pas
    // corriger. Mesuré : le premier test l'a attrapé immédiatement.
    (v) => (v === "" || v == null ? undefined : v),
    z.string().uuid().optional(),
  ),
  /**
   * Le poste visé, SAISI, quand aucune offre n'est visée.
   *
   * ⚠️ Il alimente `offerTitleSnap`, qui reste NOT NULL : la console, les
   * e-mails et l'export continuent de dire « pour quel poste » sans jamais
   * consulter la table des offres. La cohérence des deux cas est vérifiée par
   * le raffinement ci-dessous — l'un OU l'autre, jamais ni l'un ni l'autre.
   */
  posteVise: opt(160),
  civility: opt(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(180),
  phone: z.string().min(4).max(40),
  city: opt(120),
  motivation: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(4000).optional(),
  ),
  currentRole: opt(200),
  experienceBand: opt(40),
  availability: opt(120),
  linkedinUrl: opt(255),
  salaryExpectation: opt(80),
});

const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Validation photo (optionnelle) : taille + magic-bytes JPEG/PNG/WebP. */
function validatePhoto(file: File, buf: Buffer): string | null {
  if (file.size > PHOTO_MAX_BYTES) return "Photo trop volumineuse (5 Mo max).";
  const s = buf.subarray(0, 12);
  const isJpg = s[0] === 0xff && s[1] === 0xd8 && s[2] === 0xff;
  const isPng = s[0] === 0x89 && s[1] === 0x50 && s[2] === 0x4e && s[3] === 0x47;
  const isWebp =
    s[0] === 0x52 &&
    s[1] === 0x49 &&
    s[2] === 0x46 &&
    s[3] === 0x46 &&
    s[8] === 0x57 &&
    s[9] === 0x45 &&
    s[10] === 0x42 &&
    s[11] === 0x50;
  // HEIC/HEIF (photos iPhone prises en direct) : conteneur ISO-BMFF → "ftyp" à l'offset 4.
  const isHeif = s[4] === 0x66 && s[5] === 0x74 && s[6] === 0x79 && s[7] === 0x70;
  if (!isJpg && !isPng && !isWebp && !isHeif)
    return "Photo non supportée (JPG, PNG, WebP ou HEIC).";
  return null;
}

/** Tri-état Oui/Non/(vide) depuis un radio. */
function triState(v: FormDataEntryValue | null): boolean | null {
  if (v === "true" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "no") return false;
  return null;
}

/** Validation basique du fichier CV (taille, extension, MIME, magic-bytes). */
function validateCv(file: File, buf: Buffer): string | null {
  if (file.size > CV_MAX_BYTES) return "CV trop volumineux (8 Mo max).";
  const lower = file.name.toLowerCase();
  const extOk = CV_ALLOWED_EXTENSIONS.some((e) => lower.endsWith(e));
  if (!extOk) return "Format de CV non supporté (PDF, DOC ou DOCX).";
  const mimeOk =
    !file.type || CV_ALLOWED_MIME.includes(file.type as (typeof CV_ALLOWED_MIME)[number]);
  if (!mimeOk) return "Type de fichier CV non supporté.";
  // Magic-bytes : %PDF / PK(zip→docx) / D0CF11E0(ole→doc).
  const sig = buf.subarray(0, 4);
  const isPdf = sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46;
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  const isOle = sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0;
  if (!isPdf && !isZip && !isOle) return "Fichier CV illisible ou corrompu.";
  return null;
}

export async function submitJobApplicationAction(
  _prev: JobApplicationState,
  formData: FormData,
): Promise<JobApplicationState> {
  const ip = await getClientIp();

  // 1. Anti-martèlement — compteur de TENTATIVES, volontairement large.
  //
  // 🔴 Il était à 3 par 10 minutes, et il était consommé ICI, AVANT le captcha
  // et avant la validation. Autrement dit : le seul compteur du formulaire
  // punissait les gens qui échouaient déjà. Un candidat à qui Cloudflare sert
  // un défi interactif voit « Captcha échoué », réessaie deux fois, et bascule
  // au 4e essai sur « Trop de tentatives » — un second message d'erreur, qui
  // ressemble au premier, et qui verrouille 10 minutes. Deux personnes derrière
  // la même box partagent ce compteur : changer d'ordinateur ne débloque rien.
  // C'est exactement le récit d'un candidat le 2026-08-19.
  //
  // Ce compteur-ci ne sert donc plus qu'à borner le coût d'un flood (un appel
  // Turnstile par essai). Ce qui protège du spam de VRAIES candidatures, c'est
  // le compteur d'envois aboutis, plus bas — celui qu'un échec ne touche pas.
  const attempts = await checkRateLimit(`job-application:attempt:${ip}`, {
    limit: 20,
    windowSec: 600,
  });
  if (!attempts.allowed)
    return {
      ok: false,
      error:
        "Trop d'essais depuis cette connexion. Patientez quelques minutes, puis réessayez — ou écrivez-nous à contact@axion-ia.com.",
    };

  // 2. Honeypot
  const leurre = formData.get("website");
  if (leurre) {
    signalerHoneypot("candidature-emploi", leurre);
    return { ok: true, applicationId: "" };
  }

  // 3. Turnstile
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // 4. Consentement RGPD obligatoire
  const consent = formData.get("consent") === "true" || formData.get("consent") === "on";
  if (!consent) return { ok: false, error: "Le consentement RGPD est requis." };

  // 4bis. Accord OPTIONNEL de conservation en vivier (case décochée par
  // défaut, textes v2). Il n'est JAMAIS bloquant : refuser le vivier n'empêche
  // pas de postuler — c'est ce qui en fait un consentement libre, donc valide.
  // Toute absence, valeur vide ou valeur inattendue vaut REFUS.
  const consentVivier =
    formData.get("consentVivier") === "true" || formData.get("consentVivier") === "on";

  // 5. Zod
  const parsed = appSchema.safeParse({
    offerId: formData.get("offerId"),
    // ⚠️ Ajouté au SCHÉMA et oublié ICI dans une première version : le champ
    // n'arrivait jamais, et la candidature spontanée était refusée sans que
    // rien ne dise pourquoi. Un schéma et sa source d'entrée sont deux listes
    // qu'il faut tenir ensemble — c'est le test qui l'a dit, pas la relecture.
    posteVise: formData.get("posteVise"),
    civility: formData.get("civility"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    motivation: formData.get("motivation"),
    currentRole: formData.get("currentRole"),
    experienceBand: formData.get("experienceBand"),
    availability: formData.get("availability"),
    linkedinUrl: formData.get("linkedinUrl"),
    salaryExpectation: formData.get("salaryExpectation"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: "Champs invalides — vérifiez vos informations.",
    };
  const d = parsed.data;
  const locale = parseLocale(formData.get("locale") ?? "fr");

  // ── 6. L'OFFRE CIBLE, OU LE POSTE VISÉ ────────────────────────────────────
  //
  // 🔴 UNE CANDIDATURE SPONTANÉE N'A PAS D'OFFRE, ET N'EN CHERCHE DONC AUCUNE.
  //
  // Le contrôle « cette offre est-elle encore ouverte ? » n'a de sens que s'il
  // y a une offre. L'appliquer à une spontanée l'aurait refusée pour un motif
  // qui ne la concerne pas. ⚠️ Et le passer quand même ne « ne trouverait
  // rien » : `findUnique` VALIDE son argument et LÈVE sur `null` — mesuré le
  // 2026-09-04. Le conditionnel n'est donc pas une optimisation, il évite une
  // exception au milieu d'une soumission de candidature.
  //
  // ⚠️ Les deux cas doivent être MUTUELLEMENT EXCLUSIFS et EXHAUSTIFS. Sans ce
  // refus explicite, une soumission sans offre NI poste visé passerait, et
  // `offerTitleSnap` — qui est NOT NULL — ferait échouer l'insertion tout au
  // fond de la pile, sur un message Postgres que le candidat verrait comme
  // « une erreur est survenue ».
  if (!d.offerId && !d.posteVise) {
    return { ok: false, error: "Indiquez le poste qui vous intéresse." };
  }

  const offer = d.offerId
    ? await prisma.jobOffer.findUnique({
        where: { id: d.offerId },
        select: {
          id: true,
          slug: true,
          titleFr: true,
          category: true,
          status: true,
          filledAt: true,
          validThrough: true,
        },
      })
    : null;

  if (d.offerId) {
    const expired = offer?.validThrough != null && offer.validThrough.getTime() < Date.now();
    if (!offer || offer.status !== "published" || offer.filledAt || expired) {
      return {
        ok: false,
        error: "Cette offre n'est plus ouverte aux candidatures.",
      };
    }
  }

  /**
   * Le titre du poste, TOUJOURS connu — c'est l'invariant de tout l'aval.
   *
   * 🔑 Une seule expression pour les deux cas : e-mails, notifications, export
   * et console lisent ce titre sans jamais avoir à savoir s'il y avait une
   * offre derrière. C'est ce qui rend la candidature spontanée presque gratuite
   * en aval.
   */
  const titrePoste = offer?.titleFr ?? (d.posteVise as string);

  // 7. CV (optionnel) — VALIDATION seulement. L'écriture disque est reportée
  // après le compteur d'envois aboutis (§7ter) : un refus ne doit jamais
  // laisser un fichier orphelin hors web-root que plus rien ne référence.
  let cvBuffer: Buffer | null = null;
  // Nom BRUT, tel que reçu : c'est lui que `storeCv` assainit pour nommer le
  // fichier sur disque. La version tronquée à 255 (`cvOriginalName`) ne sert
  // qu'à la colonne — la passer à `storeCv` amputerait l'extension d'un nom
  // très long, et le CV cesserait d'être reconnu comme un PDF.
  let cvRawName = "cv";
  let cvOriginalName: string | null = null;
  let cvMimeType: string | null = null;
  let cvSizeBytes: number | null = null;
  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0) {
    // Vérifier la taille AVANT de charger le buffer en mémoire (anti-DoS RAM).
    if (cv.size > CV_MAX_BYTES) return { ok: false, error: "CV trop volumineux (8 Mo max)." };
    const buf = Buffer.from(await cv.arrayBuffer());
    const cvError = validateCv(cv, buf);
    if (cvError) return { ok: false, error: cvError };
    cvBuffer = buf;
    cvRawName = cv.name;
    cvOriginalName = cv.name.slice(0, 255);
    cvMimeType = cv.type || null;
    cvSizeBytes = cv.size;
  }

  // 7bis. Photo (OPTIONNELLE — réutilise le stockage CV, hors web-root, admin-only)
  let photoBuffer: Buffer | null = null;
  let photoRawName = "photo";
  let photoOriginalName: string | null = null;
  let photoMimeType: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > PHOTO_MAX_BYTES)
      return { ok: false, error: "Photo trop volumineuse (5 Mo max)." };
    const pbuf = Buffer.from(await photo.arrayBuffer());
    const photoError = validatePhoto(photo, pbuf);
    if (photoError) return { ok: false, error: photoError };
    photoBuffer = pbuf;
    photoRawName = photo.name;
    photoOriginalName = photo.name.slice(0, 255);
    photoMimeType = photo.type || null;
  }

  // 7ter. Anti-spam — compteur d'envois ABOUTIS.
  //
  // C'est LE verrou qui protège du spam de candidatures, et il est atteint
  // seulement quand tout le reste a déjà passé : captcha, champs valides, offre
  // ouverte, pièces jointes lisibles. Un candidat qui bute sur le captcha ou
  // sur un format de CV n'en consomme donc AUCUNE unité — c'est toute la
  // différence avec le compteur unique d'avant, qui comptait les échecs.
  //
  // 8 par heure : très au-dessus d'un usage humain (postuler à plusieurs offres
  // d'affilée reste confortable), très en dessous de ce qui rendrait le spam
  // rentable une fois le captcha franchi.
  const accepted = await checkRateLimit(`job-application:accepted:${ip}`, {
    limit: 8,
    windowSec: 3600,
  });
  if (!accepted.allowed)
    return {
      ok: false,
      error:
        "Vous avez déjà envoyé plusieurs candidatures dans l'heure. Réessayez plus tard — ou écrivez-nous à contact@axion-ia.com.",
    };

  // 7quater. Écriture disque, maintenant qu'aucun refus ne peut plus survenir
  // avant la création de la ligne.
  const cvStoragePath = cvBuffer ? await storeCv(cvBuffer, cvRawName) : null;
  const photoStoragePath = photoBuffer ? await storeCv(photoBuffer, photoRawName) : null;

  // 8. Réponses aux questions de l'offre (champs answer_<id>)
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_") && typeof value === "string" && value.trim()) {
      answers[key.slice("answer_".length)] = value.slice(0, 2000);
    }
  }

  const userAgent = (await headers()).get("user-agent") ?? null;
  const hasDriverLicense = triState(formData.get("hasDriverLicense"));
  const hasVehicle = triState(formData.get("hasVehicle"));

  // ── LA PROVENANCE — lue, jamais demandée ──────────────────────────────────
  //
  // 🔑 Le cookie est posé par `proxy.ts` au PREMIER clic portant des balises,
  // donc bien avant ce formulaire : il dit ce que le lien PROUVE. Le champ
  // caché `landingPath` dit, lui, quelle page a été cliquée quand aucune balise
  // n'accompagnait le lien — le cas des annonces qui ne savent pas en poser.
  //
  // ⚠️ Best-effort intégral : aucune de ces lectures ne peut faire échouer une
  // candidature. Une provenance perdue coûte une ligne de statistique ; une
  // candidature perdue coûte un candidat.
  const provenance = provenanceDepuisLeTunnel(
    readUtmCookie((await cookies()).get(UTM_COOKIE_NAME)?.value),
    typeof formData.get("landingPath") === "string"
      ? (formData.get("landingPath") as string)
      : null,
  );

  try {
    const app = await prisma.jobApplication.create({
      data: {
        // `null` pour une spontanée : la colonne est nullable depuis la
        // migration `20260904010000_candidature_sans_offre`.
        offerId: offer?.id ?? null,
        offerTitleSnap: titrePoste,
        civility: d.civility ?? null,
        firstName: encryptPii(d.firstName),
        lastName: encryptPii(d.lastName),
        email: encryptPii(d.email),
        // 🔴 `D5-5-03` (2026-08-20) — empreinte de recherche RGPD.
        // `encryptPii` utilise un IV aléatoire : sans cette empreinte, la
        // candidature est INTROUVABLE par son adresse, donc ni exportable
        // (art. 15) ni effaçable (art. 17). Même remède que
        // `contactEmailHash` sur les `Submission`.
        emailHash: hashEmailForLookup(d.email),
        phone: encryptPii(d.phone),
        city: d.city ?? null,
        motivation: d.motivation ?? null,
        currentRole: d.currentRole ?? null,
        experienceBand: d.experienceBand ?? null,
        availability: d.availability ?? null,
        linkedinUrl: d.linkedinUrl ?? null,
        hasDriverLicense,
        hasVehicle,
        cvStoragePath,
        cvOriginalName,
        cvMimeType,
        cvSizeBytes,
        photoStoragePath,
        photoOriginalName,
        photoMimeType,
        salaryExpectation: d.salaryExpectation ?? null,
        ipHash: hashIp(ip),
        userAgent,
        consentVersion: CONSENT_VERSION,
        // Accord vivier : un HORODATAGE, pas un booléen. « Oui » sans date ne
        // prouve rien ; c'est la date qui fait courir les 2 ans de conservation
        // et qui se transmet au CRM. `null` = refus, et c'est le défaut.
        ...(consentVivier ? { consentVivierAt: new Date() } : {}),
        locale,
        // Lot 5 — d'où vient cette candidature. Les quatre champs sont posés
        // même à `null` : une colonne absente et une colonne nulle se lisent
        // pareil en base, et écrire explicitement « on ne sait pas » évite de
        // se demander plus tard si la capture était branchée ce jour-là.
        utmSource: provenance.utmSource,
        utmMedium: provenance.utmMedium,
        utmCampaign: provenance.utmCampaign,
        landingPath: provenance.landingPath,
        ...(Object.keys(answers).length > 0 ? { answers: answers as Prisma.InputJsonValue } : {}),
      },
    });

    // 8 ter. REGISTRE DE PREUVE (lot L4) — une ligne par consentement recueilli,
    // best-effort : il ne fait jamais échouer une candidature. Les deux accords
    // sont consignés SÉPARÉMENT parce qu'ils ont deux finalités distinctes ;
    // les fondre en une ligne rendrait impossible de prouver lequel a été donné.
    await recordConsentEvent({
      email: d.email,
      formRef: CONSENT_FORM_REFS.jobApplication,
      consentVersion: CONSENT_VERSION,
      action: "optin",
      occurredAt: app.submittedAt,
      ip,
      userAgent,
    });
    if (consentVivier) {
      await recordConsentEvent({
        email: d.email,
        formRef: CONSENT_FORM_REFS.jobApplicationVivier,
        consentVersion: CONSENT_VERSION,
        action: "optin",
        occurredAt: app.submittedAt,
        ip,
        userAgent,
      });
    }

    // ── 8 bis. Synchro CRM — univers VIVIER (lot L2) ──────────────────────
    //
    // 🔴 UNE CANDIDATURE SPONTANÉE NE FRANCHIT PAS LA FRONTIÈRE. Décision
    // conservatrice, écrite et motivée dans l'ADR 0047 §4 (arbitrage 1,
    // option C), et voici la mine qu'elle désamorce :
    //
    // `candidateFamilyForOffer` produit une valeur qui doit exister dans un
    // `CHECK` SQL **de l'autre dépôt**. Une famille inconnue là-bas fait
    // refuser TOUTES les fiches qui la portent — pas seulement les nouvelles.
    // Émettre une spontanée exigerait donc soit une migration distante
    // déployée AVANT, soit de la ranger dans `candidat_autre`, ce qui perdrait
    // l'information à la lecture.
    //
    // 🔑 Ne rien émettre est la seule option qui ne dépende d'aucun
    // déploiement ailleurs, et elle est réversible : le jour où Will tranche,
    // `reconcile.ts` sait rattraper un stock non émis. Une spontanée qu'on n'a
    // pas encore lue n'a de toute façon rien à faire dans un vivier long terme.
    //
    // 🔴 DOUBLE VERROU, et le second est le vrai : le drapeau
    // `CRM_SYNC_CANDIDATES_ENABLED` évite d'émettre pour rien, mais c'est le
    // CRM qui REFUSE (422) toute fiche candidat dont la version de
    // consentement n'est pas v2. Les 71 candidatures du stock portent
    // `careers-v1-2026-06-09`, dont le texte ne couvre QUE l'étude de la
    // candidature en cours : elles ne peuvent pas entrer au vivier tant que le
    // texte v2 n'est pas servi. Le refus est donc attendu, et sain.
    if (offer)
      await syncCandidateToCrm({
        subjectRef: `site:job_application:${app.id}`,
        family: candidateFamilyForOffer(offer.slug, offer.category),
        offerSlug: offer.slug,
        sourceSlug: "site-candidature-offre",
        occurredAt: app.submittedAt,
        person: {
          email: d.email,
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone ?? null,
        },
        consent: {
          version: CONSENT_VERSION,
          at: app.submittedAt,
          textRef: "job-application-form",
          // Renseigné UNIQUEMENT si la case optionnelle a été cochée. Le CRM lit
          // `consent.vivier_at` pour savoir s'il a le droit de conserver la fiche
          // au-delà du recrutement en cours.
          vivierAt: consentVivier ? app.submittedAt : null,
        },
        cvRef: cvStoragePath ? `site:cv:${app.id}` : null,
        attributes: {
          ...(d.experienceBand ? { experienceBand: d.experienceBand } : {}),
          ...(d.availability ? { availability: d.availability } : {}),
          ...(d.city ? { city: d.city } : {}),
          hasDriverLicense,
          hasVehicle,
        },
        payload: { offerTitle: titrePoste },
      });

    // 9. Telegram (+ WhatsApp pour l'offre monteur vidéo) — catégorie séparée
    // pour cette offre : salon 🎬 dédié, pas mélangée aux autres candidatures.
    await notify({
      category:
        offer && isVideoEditorOffer(offer.slug)
          ? "VIDEO_EDITOR_APPLICATION_RECEIVED"
          : "JOB_APPLICATION_RECEIVED",
      payload: {
        applicationId: app.id,
        contactName: `${d.firstName} ${d.lastName}`.trim(),
        contactEmail: d.email,
        ...(d.phone ? { contactPhone: d.phone } : {}),
        offerTitle: titrePoste,
        ...(offer ? { offerCategory: offer.category } : {}),
        ...(d.city ? { city: d.city } : {}),
        ...(d.salaryExpectation ? { salaryExpectation: d.salaryExpectation } : {}),
        ...(d.motivation ? { motivationExcerpt: d.motivation.slice(0, 500) } : {}),
        hasCv: Boolean(cvStoragePath),
        hasPhoto: Boolean(photoStoragePath),
        locale,
      },
      dedupKey: app.id,
    });

    // 10. Accusé de réception au candidat.
    // 🔴 Gabarit DÉDIÉ depuis le 2026-08-13. Avant, on réutilisait
    // `contact-confirmed`, qui promet « une réponse sous 48 heures ouvrées » —
    // promesse FAUSSE pour un recrutement, et démentie par le stock de
    // candidatures en attente. Le nouveau gabarit n'annonce aucun délai : il
    // dit qu'on lit, qu'on répondra, y compris négativement. C'est le seul
    // engagement tenable.
    await enqueueEmail("candidature-recue", d.email, locale, {
      contactName: `${d.firstName} ${d.lastName}`.trim(),
      offerTitle: titrePoste,
    });

    revalidatePath(adminPath("fr", "contacts/candidatures"));
    return { ok: true, applicationId: app.id };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "submitJobApplicationAction", locale },
    });
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}
