// Server Action — dépôt public d'un avis client (multipart + photo optionnelle).
// Calquée sur submitJobApplicationAction : rate-limit / honeypot / Turnstile /
// consentement RGPD / Zod / encryptPii / hashIp / notify / email.
//
// ⚠️ MODÉRATION : l'avis est créé en `status = "pending"` (défaut DB) et reste
// invisible partout tant qu'un admin ne l'a pas publié en console.

"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncReviewToCrm } from "@/server/crm-sync";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { getClientIp } from "@/lib/client-ip";
import { parseLocale } from "@/lib/schemas/locale";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import { adminPath } from "@/lib/admin-path";
import { storeCv } from "@/server/careers/cv-storage";
import { reviewSubmissionSchema, deriveLastInitial } from "@/lib/schemas/review-submission-schema";
import { isClientSectorSlug, clientSectorLabel } from "@/content/sectors";
import { serviceLineLabel } from "@/lib/reviews/service-lines";
import { buildReviewSlugBase, buildReviewSlug, slugifyToken } from "@/lib/reviews/slug";
import type { Prisma, ServiceSector } from "../../../prisma/generated/client";

const CONSENT_VERSION = "reviews-v1-2026-07-06";
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

export type ReviewSubmissionState = { ok: true; reviewId: string } | { ok: false; error: string };

/** Validation photo (optionnelle) : taille + magic-bytes JPEG/PNG/WebP/HEIC. */
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
  const isHeif = s[4] === 0x66 && s[5] === 0x74 && s[6] === 0x79 && s[7] === 0x70;
  if (!isJpg && !isPng && !isWebp && !isHeif)
    return "Photo non supportée (JPG, PNG, WebP ou HEIC).";
  return null;
}

/** Hash IP tolérant : ne bloque JAMAIS la soumission si IP_HASH_SALT manque. */
function safeHashIp(ip: string): string | null {
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}

/** True si l'erreur Prisma est une violation de contrainte unique (P2002). */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
  );
}

export async function submitReviewAction(
  _prev: ReviewSubmissionState,
  formData: FormData,
): Promise<ReviewSubmissionState> {
  const ip = await getClientIp();

  // 1. Rate-limit (2 avis / 10 min / IP)
  const rl = await checkRateLimit(`review-submit:${ip}`, { limit: 2, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  // 2. Honeypot (bot → succès silencieux)
  if (formData.get("website")) return { ok: true, reviewId: "" };

  // 3. Turnstile (hard-fail)
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // 4. Consentement RGPD obligatoire
  const consent = formData.get("consent") === "true" || formData.get("consent") === "on";
  if (!consent) return { ok: false, error: "Le consentement RGPD est requis." };

  // 5. Zod
  const parsed = reviewSubmissionSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    companyName: formData.get("companyName"),
    clientSector: formData.get("clientSector"),
    city: formData.get("city"),
    serviceLine: formData.get("serviceLine"),
    rating: formData.get("rating"),
    title: formData.get("title"),
    comment: formData.get("comment"),
    photoKind: formData.get("photoKind"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Champs invalides — vérifiez votre avis (commentaire ≥ 120 caractères).",
    };
  }
  const d = parsed.data;
  const locale = parseLocale(formData.get("locale") ?? "fr");
  const lastInitial = deriveLastInitial(d.lastName);

  // 6. Normalisation secteur client (slug canonique si reconnu, sinon libre)
  let clientSector: string | null = null;
  if (d.clientSector) {
    clientSector = isClientSectorSlug(d.clientSector)
      ? d.clientSector
      : d.clientSector.trim().slice(0, 80);
  }

  // 7. Rattachement ville (best-effort → City) pour facettes géo + affichage
  let citySlug: string | null = null;
  let cityName: string | null = null;
  let departmentCode: string | null = null;
  let regionSlug: string | null = null;
  if (d.city) {
    const token = slugifyToken(d.city);
    const match = await prisma.city.findFirst({
      where: { OR: [{ slug: token }, { name: { equals: d.city.trim(), mode: "insensitive" } }] },
      select: { slug: true, name: true, departmentCode: true, regionSlug: true },
    });
    if (match) {
      citySlug = match.slug;
      cityName = match.name;
      departmentCode = match.departmentCode;
      regionSlug = match.regionSlug;
    } else {
      cityName = d.city.trim().slice(0, 120); // saisie libre conservée pour l'affichage
    }
  }

  // 8. Photo optionnelle (stockée en PRIVÉ ; variantes publiques à l'approbation)
  let photoStoragePath: string | null = null;
  let photoKind: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > PHOTO_MAX_BYTES)
      return { ok: false, error: "Photo trop volumineuse (5 Mo max)." };
    const pbuf = Buffer.from(await photo.arrayBuffer());
    const photoError = validatePhoto(photo, pbuf);
    if (photoError) return { ok: false, error: photoError };
    photoStoragePath = await storeCv(pbuf, photo.name);
    photoKind = d.photoKind;
  }

  const userAgent = (await headers()).get("user-agent") ?? null;
  void userAgent; // conservé pour audit éventuel (non persisté en V1)

  const slugBase = buildReviewSlugBase({
    firstName: d.firstName,
    lastInitial,
    company: d.companyName ?? null,
    sector: clientSector ? clientSectorLabel(clientSector) : null,
    city: cityName,
  });

  const baseData: Omit<Prisma.CustomerReviewCreateInput, "slug"> = {
    authorFirstName: d.firstName,
    authorLastInitial: lastInitial,
    companyName: d.companyName ?? null,
    clientSector,
    citySlug,
    cityName,
    departmentCode,
    regionSlug,
    serviceLine: (d.serviceLine as ServiceSector | undefined) ?? null,
    rating: d.rating,
    title: d.title ?? null,
    comment: d.comment,
    photoKind,
    photoStoragePath,
    contactEmailEnc: encryptPii(d.email),
    ipHash: safeHashIp(ip),
    consentVersion: CONSENT_VERSION,
    source: "form",
  };

  try {
    // 9. Création avec retry sur collision de slug (unicité garantie)
    let review: { id: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = buildReviewSlug(slugBase, randomUUID().slice(0, 6));
      try {
        review = await prisma.customerReview.create({
          data: { ...baseData, slug },
          select: { id: true },
        });
        break;
      } catch (e) {
        if (isUniqueViolation(e) && attempt < 4) continue;
        throw e;
      }
    }
    if (!review) return { ok: false, error: "Une erreur est survenue. Réessayez." };

    // 9 bis. Synchro CRM (lot L2) — l'auteur d'un avis certifie être un client
    // réel : c'est le seul événement entrant du site qui porte cette qualité.
    // Le CONTENU de l'avis reste sur le site ; le CRM ne reçoit que la fiche.
    await syncReviewToCrm({
      subjectRef: `site:customer_review:${review.id}`,
      person: { email: d.email, firstName: d.firstName, lastName: d.lastName ?? null },
      ...(d.companyName ? { company: { name: d.companyName } } : {}),
      consent: { version: CONSENT_VERSION, textRef: "review-form" },
      payload: { rating: d.rating },
    });

    // 10. Telegram (admin → modération)
    await notify({
      category: "REVIEW_SUBMITTED",
      payload: {
        reviewId: review.id,
        authorName: `${d.firstName} ${lastInitial}`.trim(),
        rating: d.rating,
        ...(d.companyName ? { companyName: d.companyName } : {}),
        ...(clientSector ? { clientSector: clientSectorLabel(clientSector) } : {}),
        ...(cityName ? { city: cityName } : {}),
        ...(d.serviceLine ? { serviceLine: serviceLineLabel(d.serviceLine) } : {}),
        hasPhoto: Boolean(photoStoragePath),
        excerpt: d.comment.slice(0, 160),
        locale,
      },
      dedupKey: review.id,
    });

    // 11. Remerciement au client.
    // 🔴 Gabarit DÉDIÉ depuis le 2026-08-13. Avant, `contact-confirmed`
    // annonçait « nous revenons vers vous sous 48 heures » à quelqu'un qui
    // venait simplement de laisser un avis — un avis n'est pas une demande, et
    // promettre un rappel donnait l'impression que le message n'avait pas été
    // lu. Le nouveau gabarit remercie et explique la modération.
    await enqueueEmail("avis-recu", d.email, locale, {
      contactName: `${d.firstName} ${lastInitial}`.trim(),
    });

    revalidatePath(adminPath("fr", "avis"));
    return { ok: true, reviewId: review.id };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "submitReviewAction", locale },
    });
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}
