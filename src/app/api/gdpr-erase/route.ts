// API /api/gdpr-erase — RGPD self-service erase (Sprint Correctif S+1 / P0-S1-2 2026-05-16).
//
// POST { email, token, confirm: "ERASE_MY_DATA" }
//
// Flow :
//   1. Vérifie token HMAC (même schéma que /api/gdpr-export, lib `gdpr-token`).
//   2. Anti-replay : token email === body email.
//   3. Confirmation littérale "ERASE_MY_DATA" (anti-clic-accidentel).
//   4. Rate limit 1/jour/email (l'erase ne se rejoue pas).
//   5. Pour chaque type de données :
//      - Submission : anonymisation in-place (audit business conservé)
//      - NewsletterSubscriber : suppression hard
//      - KnowledgeBookmark : suppression hard
//   6. ActivityLog `gdpr.erase.completed` (forensique) + alerte Telegram canal Will.
//
// **Important** : pas d'undo. Le token est consommé pour 1 erase ; au prochain
// export, l'email est anonymisé donc inacessible. Le contrat utilisateur
// implicite est explicité dans la confirmation UI (composant `/admin/rgpd/...`).
//
// Tables NON-touchées (legal hold) :
//   - generation_logs / cost_ledger / web_vital_samples / content_gen_jobs
//     (logs techniques sans PII visiteur — voir politique-confidentialite).
//   - ActivityLog : conservé (immuable, art. 30 RGPD register).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyGdprToken } from "@/lib/gdpr-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { eraseKbDataForEmail } from "@/lib/knowledge/rgpd-export";
import {
  eraseChatDataForEmail,
  eraseNewsletterForEmail,
  eraseSubmissionsForEmail,
} from "@/lib/rgpd-erase";
import { alertIncident } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(20),
  confirm: z.literal("ERASE_MY_DATA"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const { email, token } = parsed.data;

  // Rate limit 1/jour/email — l'erase est one-shot
  const rl = await checkRateLimit(`gdpr:erase:${email}`, { limit: 1, windowSec: 86_400 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const v = await verifyGdprToken(token);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.reason }, { status: 401 });
  }
  if (v.email !== email) {
    return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 401 });
  }

  // Données chatbot (chat_*) AVANT l'anonymisation des Submissions : le
  // rattachement conversation↔lead se fait par `contactEmail`, qui sera hashé
  // par eraseSubmissionsForEmail.
  const chatResult = await eraseChatDataForEmail(email);

  // Exécution des effacements
  const [submissionsResult, newsletterResult, kbResult] = await Promise.all([
    eraseSubmissionsForEmail(email),
    eraseNewsletterForEmail(email),
    eraseKbDataForEmail(email),
  ]);

  // Activity log RGPD : trace forensique immuable
  await prisma.activityLog.create({
    data: {
      adminUserId: null,
      action: "gdpr.erase.completed",
      targetType: "self_service",
      targetId: v.jti,
      changes: {
        email,
        submissionsAnonymized: submissionsResult.anonymized,
        newsletterDeleted: newsletterResult.deleted,
        kbBookmarksDeleted: kbResult.bookmarksDeleted,
        chatConversationsDeleted: chatResult.conversationsDeleted,
        chatEscalationsAnonymized: chatResult.escalationsAnonymized,
      },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  // Telegram alert (DPO doit savoir — art. 30 RGPD register update)
  try {
    await alertIncident(
      `🗑️ RGPD art. 17 effacement effectué : ${submissionsResult.anonymized} submissions anonymisées, ${newsletterResult.deleted} newsletter, ${kbResult.bookmarksDeleted} KB bookmarks, ${chatResult.conversationsDeleted} conversations chatbot supprimées, ${chatResult.escalationsAnonymized} escalades anonymisées.`,
      { userId: v.jti },
    );
  } catch {
    // Telegram alert non-bloquant
  }

  return NextResponse.json({
    ok: true,
    erasedAt: new Date().toISOString(),
    summary: {
      submissionsAnonymized: submissionsResult.anonymized,
      newsletterDeleted: newsletterResult.deleted,
      kbBookmarksDeleted: kbResult.bookmarksDeleted,
      chatConversationsDeleted: chatResult.conversationsDeleted,
      chatEscalationsAnonymized: chatResult.escalationsAnonymized,
    },
    notice: {
      explanation:
        "Vos données identifiantes ont été effacées ou anonymisées. Les lignes business (factures, audit comptable) sont conservées sous forme anonymisée conformément à l'art. 30 RGPD (legal hold).",
      retentionExceptions: [
        "Submissions : anonymisées in-place (audit business + facturation préservés sans PII).",
        "ActivityLog : conservé (immuable, art. 30 RGPD register).",
        "generation_logs / cost_ledger / web_vital_samples : logs techniques sans PII visiteur (purgés par retention-purge-worker).",
      ],
      contactDpo: "contact@axion-ia.com",
    },
  });
}
