// API /api/gdpr-export — RGPD self-service export (Sprint 24 / D2 + audit B5 2026-05-15).
//
// POST { email, token } : valide token signé HMAC-SHA256 (lib gdpr-token),
// vérifie que l'email du token = l'email du body (anti-replay), rate-limit
// 3/jour/email, retourne JSON avec :
//   - submissions: tous les Submission où contactEmail = email
//   - newsletter: ligne NewsletterSubscriber si elle existe
//   - bookings: les Booking liés via Submission (interventions ferme + cancelled)
//
// **Tables explicitement EXCLUES de l'export (logs techniques RGPD art. 23) :**
//   - generation_logs : audit trail content-gen (provider, model, tokens).
//     Lié à un `job_id` éditorial, jamais à un email visiteur. PII visiteur
//     impossible : les prompts content-gen sont éditoriaux (titres,
//     intent SEO, ville) et passent par le helper `pii-safe` côté Telegram.
//     Cf. politique-confidentialite § « IA générative et transparence ».
//   - cost_ledger : montants USD provider IA + tokens. Aucune PII.
//   - web_vital_samples : RUM agrégé, sessionId anonyme client.
//   - content_gen_jobs : pipeline interne, lié à templates éditoriaux.
//
// Ces tables sont purgées automatiquement par `retention-purge-worker.ts`
// (durées dans `_AUDIT/DPA-REGISTER.md` + politique-confidentialite).
//
// Le token est obtenu via POST /api/gdpr-export/request {email} qui envoie
// le lien par email (cf. request/route.ts).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyGdprToken } from "@/lib/gdpr-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { exportKbDataForEmail } from "@/lib/knowledge/rgpd-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(20),
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

  // Rate limit 3/jour/email pour empêcher abus token re-use
  const rl = await checkRateLimit(`gdpr:export:${email}`, { limit: 3, windowSec: 86_400 });
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

  const submissions = await prisma.submission.findMany({
    where: { contactEmail: email },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      locale: true,
      companyName: true,
      sector: true,
      contactName: true,
      contactRole: true,
      contactEmail: true,
      contactPhone: true,
      employeesCount: true,
      address: true,
      details: true,
      submittedAt: true,
      bookings: {
        select: {
          id: true,
          interventionType: true,
          bookingDate: true,
          participantsCount: true,
          status: true,
          pricePaidCents: true,
          createdAt: true,
        },
      },
    },
  });

  const newsletter = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      source: true,
      confirmedAt: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });

  // Sprint Correctif S+1 (P0-S1-2) : KB data RGPD art. 15 (bookmarks).
  const kb = await exportKbDataForEmail(email);

  // Activity log RGPD : tracé de l'export self-service
  await prisma.activityLog.create({
    data: {
      adminUserId: null,
      action: "gdpr.export.delivered",
      targetType: "self_service",
      targetId: v.jti,
      changes: {
        email,
        submissionsCount: submissions.length,
        newsletterPresent: !!newsletter,
        kbBookmarksCount: kb.bookmarks.length,
      },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    email,
    submissions,
    newsletter,
    kb,
    notice: {
      excludedTables: [
        "generation_logs (audit trail technique content-gen, sans PII visiteur)",
        "cost_ledger (montants USD provider IA, sans PII)",
        "web_vital_samples (RUM agrégé, sessionId client anonyme)",
        "content_gen_jobs (pipeline interne éditorial)",
      ],
      excludedReason:
        "Logs techniques RGPD art. 23 — voir politique-confidentialite § IA générative et transparence. Purgés automatiquement (cf. retention-purge-worker).",
      contactDpo: "contact@axion-ia.com",
    },
  });
}
