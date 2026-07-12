// Server Action candidature à une offre d'emploi (multipart + upload CV).
// Calquée sur submitUnifiedContactAction pour rate-limit/honeypot/Turnstile/
// encryptPii/notify/email, mais gère un FICHIER (CV) — net-neuf (aucun upload
// dans les forms existants). Stockage disque dédié (cv-storage), hors web-root.

"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { getClientIp } from "@/lib/client-ip";
import { parseLocale } from "@/lib/schemas/locale";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { adminPath } from "@/lib/admin-path";
import {
  storeCv,
  CV_MAX_BYTES,
  CV_ALLOWED_EXTENSIONS,
  CV_ALLOWED_MIME,
} from "@/server/careers/cv-storage";
import type { Prisma } from "../../../prisma/generated/client";

const CONSENT_VERSION = "careers-v1-2026-06-09";

export type JobApplicationState =
  | { ok: true; applicationId: string }
  | { ok: false; error: string };

const opt = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(max).optional());

const appSchema = z.object({
  offerId: z.string().uuid(),
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

  // 1. Rate-limit
  const rl = await checkRateLimit(`job-application:${ip}`, {
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  // 2. Honeypot
  if (formData.get("website")) return { ok: true, applicationId: "" };

  // 3. Turnstile
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // 4. Consentement RGPD obligatoire
  const consent = formData.get("consent") === "true" || formData.get("consent") === "on";
  if (!consent) return { ok: false, error: "Le consentement RGPD est requis." };

  // 5. Zod
  const parsed = appSchema.safeParse({
    offerId: formData.get("offerId"),
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

  // 6. Offre cible
  const offer = await prisma.jobOffer.findUnique({
    where: { id: d.offerId },
    select: {
      id: true,
      titleFr: true,
      category: true,
      status: true,
      filledAt: true,
      validThrough: true,
    },
  });
  const expired = offer?.validThrough != null && offer.validThrough.getTime() < Date.now();
  if (!offer || offer.status !== "published" || offer.filledAt || expired) {
    return {
      ok: false,
      error: "Cette offre n'est plus ouverte aux candidatures.",
    };
  }

  // 7. CV (optionnel)
  let cvStoragePath: string | null = null;
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
    cvStoragePath = await storeCv(buf, cv.name);
    cvOriginalName = cv.name.slice(0, 255);
    cvMimeType = cv.type || null;
    cvSizeBytes = cv.size;
  }

  // 7bis. Photo (OPTIONNELLE — réutilise le stockage CV, hors web-root, admin-only)
  let photoStoragePath: string | null = null;
  let photoOriginalName: string | null = null;
  let photoMimeType: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > PHOTO_MAX_BYTES)
      return { ok: false, error: "Photo trop volumineuse (5 Mo max)." };
    const pbuf = Buffer.from(await photo.arrayBuffer());
    const photoError = validatePhoto(photo, pbuf);
    if (photoError) return { ok: false, error: photoError };
    photoStoragePath = await storeCv(pbuf, photo.name);
    photoOriginalName = photo.name.slice(0, 255);
    photoMimeType = photo.type || null;
  }

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

  try {
    const app = await prisma.jobApplication.create({
      data: {
        offerId: offer.id,
        offerTitleSnap: offer.titleFr,
        civility: d.civility ?? null,
        firstName: encryptPii(d.firstName),
        lastName: encryptPii(d.lastName),
        email: encryptPii(d.email),
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
        locale,
        ...(Object.keys(answers).length > 0 ? { answers: answers as Prisma.InputJsonValue } : {}),
      },
    });

    // 9. Telegram
    await notify({
      category: "JOB_APPLICATION_RECEIVED",
      payload: {
        applicationId: app.id,
        contactName: `${d.firstName} ${d.lastName}`.trim(),
        contactEmail: d.email,
        ...(d.phone ? { contactPhone: d.phone } : {}),
        offerTitle: offer.titleFr,
        offerCategory: offer.category,
        ...(d.city ? { city: d.city } : {}),
        ...(d.salaryExpectation ? { salaryExpectation: d.salaryExpectation } : {}),
        hasCv: Boolean(cvStoragePath),
        hasPhoto: Boolean(photoStoragePath),
        locale,
      },
      dedupKey: app.id,
    });

    // 10. Email accusé (réutilise contact-confirmed, 0 nouveau template)
    await enqueueEmail("contact-confirmed" as EmailJobName, d.email, locale, {
      contactName: `${d.firstName} ${d.lastName}`.trim(),
      submissionId: app.id,
      type: "recrutement",
      subType: offer.titleFr,
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
