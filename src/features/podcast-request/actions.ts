// Server Action — demande publique de tournage podcast (`/podcast`).
//
// Calquée sur `submitReviewAction` / `submitJobApplicationAction` :
// rate-limit IP → honeypot → Turnstile → consentement RGPD → Zod → encryptPii →
// hashIp → prisma.create → notify() (Telegram, + WhatsApp si configuré).
//
// ⚠️ Offre GRATUITE, sans contrepartie ni lien avec l'achat d'une formation
// (décision Will 2026-07-21). Aucune logique commerciale ici : on enregistre un
// lead et on prévient Will, point.

"use server";

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
import { adminPath } from "@/lib/admin-path";
import { podcastRequestSchema } from "@/lib/schemas/podcast-request-schema";

const CONSENT_VERSION = "podcast-v1-2026-07-21";

/** Origines de lead acceptées (le flyer papier passe par `/qr/podcast?src=qr`). */
const ALLOWED_SOURCES = new Set(["form", "qr", "flyer"]);

export type PodcastRequestState = { ok: true; requestId: string } | { ok: false; error: string };

/** Hash IP tolérant : ne bloque JAMAIS la soumission si IP_HASH_SALT manque. */
function safeHashIp(ip: string): string | null {
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function submitPodcastRequestAction(
  _prev: PodcastRequestState,
  formData: FormData,
): Promise<PodcastRequestState> {
  const ip = await getClientIp();

  // 1. Rate-limit (3 demandes / 10 min / IP)
  const rl = await checkRateLimit(`podcast-request:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  // 2. Honeypot (bot → succès silencieux, on ne lui apprend rien)
  if (formData.get("website")) return { ok: true, requestId: "" };

  // 3. Turnstile (hard-fail)
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // 4. Consentement RGPD obligatoire
  const consent = formData.get("consent") === "true" || formData.get("consent") === "on";
  if (!consent) return { ok: false, error: "Le consentement RGPD est requis." };

  // 5. Zod
  const parsed = podcastRequestSchema.safeParse({
    companyName: formData.get("companyName"),
    leaderName: formData.get("leaderName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
    activity: formData.get("activity"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides — vérifiez le formulaire." };
  }
  const d = parsed.data;
  const locale = parseLocale(formData.get("locale") ?? "fr");

  const rawSource = String(formData.get("source") ?? "form");
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "form";

  const userAgent = (await headers()).get("user-agent") ?? null;
  void userAgent; // conservé pour audit éventuel (non persisté en V1)

  try {
    // 6. Persistance — PII chiffrée au repos (AES-256-GCM).
    const created = await prisma.podcastRequest.create({
      data: {
        companyName: d.companyName,
        leaderName: encryptPii(d.leaderName),
        email: encryptPii(d.email),
        phone: encryptPii(d.phone),
        city: d.city,
        postalCode: d.postalCode,
        activity: d.activity,
        locale,
        source,
        ipHash: safeHashIp(ip),
        consentVersion: CONSENT_VERSION,
      },
      select: { id: true },
    });

    // 7. Notification Will — Telegram (groupe « Messages »). Le canal WhatsApp
    // se greffe automatiquement dès que WHATSAPP_CALLMEBOT_APIKEY +
    // WHATSAPP_NOTIFY_PHONE sont définis (cf. `notifications/routing.ts`).
    // Best-effort : une notif KO ne doit jamais perdre le lead déjà enregistré.
    try {
      await notify({
        category: "PODCAST_REQUEST_SUBMITTED",
        payload: {
          requestId: created.id,
          companyName: d.companyName,
          leaderName: d.leaderName,
          contactEmail: d.email,
          contactPhone: d.phone,
          city: d.city,
          postalCode: d.postalCode,
          activityExcerpt: d.activity.slice(0, 200),
          source,
          locale,
        },
        dedupKey: created.id,
      });
    } catch (notifyErr) {
      Sentry.captureException(notifyErr, {
        tags: { action: "submitPodcastRequestAction", step: "notify" },
      });
    }

    revalidatePath(adminPath("fr", "podcast"));
    return { ok: true, requestId: created.id };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "submitPodcastRequestAction", locale },
    });
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}
