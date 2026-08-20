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
import { propagateGdprToCrm } from "@/server/crm-sync/gdpr";
import { checkRateLimit } from "@/lib/rate-limit";
import { exportKbDataForEmail } from "@/lib/knowledge/rgpd-export";
import { exportChatDataForEmail } from "@/lib/rgpd-export-chat";
import { hashEmailForLookup } from "@/lib/security/email-hash";

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
  const rl = await checkRateLimit(`gdpr:export:${email}`, {
    limit: 3,
    windowSec: 86_400,
    surPanne: "refuser",
  });
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

  // 🔴 On interroge l'EMPREINTE, jamais `contactEmail`. Cette colonne est
  // chiffrée avec un IV aléatoire : l'égalité SQL qui se trouvait ici ne
  // pouvait JAMAIS correspondre, et l'export art. 15 renvoyait donc une liste
  // VIDE présentée comme complète. Le repli sur `contactEmail` couvre les
  // lignes stockées en clair et celles antérieures au remplissage rétroactif.
  const lookupHash = hashEmailForLookup(email);
  const submissions = await prisma.submission.findMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
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

  // Données chatbot RGPD art. 15 (T-23) : conversations + messages + escalades.
  const chat = await exportChatDataForEmail(email);

  // Registre de consentements (lot L4) — la PREUVE de ce que la personne a
  // accepté, et quand. Elle fait partie de « toutes les données la concernant ».
  const consentEvents = lookupHash
    ? await prisma.consentEvent.findMany({
        where: { personKey: lookupHash },
        orderBy: { occurredAt: "desc" },
        select: {
          formRef: true,
          consentVersion: true,
          action: true,
          occurredAt: true,
        },
      })
    : [];

  // ART. 15 BI-SYSTÈME (lot L4) — le CRM détient peut-être aussi des données.
  // NON BLOQUANT : s'il ne répond pas, l'export local part quand même. Rendre
  // une réponse partielle vaut infiniment mieux que rendre une erreur.
  const crm = await propagateGdprToCrm({ action: "export", personKey: lookupHash ?? "", email });

  // Activity log RGPD : tracé de l'export self-service
  await prisma.activityLog.create({
    data: {
      adminUserId: null,
      action: "gdpr.export.delivered",
      targetType: "self_service",
      targetId: v.jti,
      changes: {
        // 🔴 `D5-5-05` — même correctif que sur l'effacement : l'adresse en
        // clair a disparu du journal, qui est désormais conservé cinq ans.
        // `lookupHash` est déjà calculé plus haut pour la recherche.
        emailHash: lookupHash,
        submissionsCount: submissions.length,
        newsletterPresent: !!newsletter,
        kbBookmarksCount: kb.bookmarks.length,
        chatConversationsCount: chat.conversations.length,
        chatEscalationsCount: chat.escalations.length,
        consentEventsCount: consentEvents.length,
        crmStatus: crm.status,
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
    chat,
    consentEvents,
    // Volet CRM : soit son contenu (`status: "ok"`), soit la raison honnête
    // pour laquelle il est absent. On ne présente JAMAIS un export amputé comme
    // complet — c'est exactement le défaut qui rendait l'art. 15 muet avant.
    crm,
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
