// API /api/gdpr-export/request — RGPD self-service request token (Sprint 24 / D2).
//
// POST { email, locale? } : rate-limit 3/jour/email, signe un token JWT-like
// HMAC-SHA256 (24h TTL), envoie un email avec le lien d'accès au formulaire
// d'export. Le user doit posséder accès à sa boîte mail (vérification implicite).
//
// Anti-énumération : retourne toujours 200 même si l'email n'existe pas, pour
// ne pas révéler la présence/absence dans la base.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signGdprToken } from "@/lib/gdpr-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/server/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  locale: z.enum(["fr", "en"]).default("fr"),
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
  const { email, locale } = parsed.data;

  const rl = await checkRateLimit(`gdpr:export:request:${email}`, {
    limit: 3,
    windowSec: 86_400,
    surPanne: "refuser",
  });
  // On ne révèle pas le rate-limit côté response (anti-enumération) ; on log silently
  if (!rl.allowed) {
    return NextResponse.json({ ok: true });
  }

  const token = await signGdprToken(email);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const exportUrl = `${baseUrl}/${locale}/${locale === "fr" ? "mes-donnees" : "my-data"}/export?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  await enqueueEmail("gdpr-export-link", email, locale, {
    exportUrl,
    expiresHours: 24,
  });

  return NextResponse.json({ ok: true });
}
