// API /api/unsubscribe — RFC 8058 List-Unsubscribe (P0-5 fix Sprint 23+).
//
// Compat full RFC 8058 :
//   - POST avec body urlencoded `token=...` (depuis le formulaire desabonnement)
//   - POST avec header List-Unsubscribe-Post: List-Unsubscribe=One-Click
//     (comportement attendu par Gmail / Apple Mail / Outlook 2024+)
//   - GET ?token=... pour debug + fallback navigation
//
// Délègue à `unsubscribeNewsletterAction` (transactional + activity log
// Telegram). 303 redirect vers /desabonnement?status=ok|fail&reason=...

import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeNewsletterAction } from "@/features/newsletter/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LOCALES = new Set(["fr", "en"]);

function pickLocale(req: NextRequest): "fr" | "en" {
  const referer = req.headers.get("referer") || "";
  // Extrait la locale du chemin du referer si elle existe.
  const m = referer.match(/\/(fr|en)\b/);
  if (m && VALID_LOCALES.has(m[1]!)) return m[1] as "fr" | "en";
  return "fr";
}

async function handle(token: string | null, locale: "fr" | "en"): Promise<NextResponse> {
  const result = await unsubscribeNewsletterAction(token);
  const slug = locale === "en" ? "/en/unsubscribe" : "/fr/desabonnement";
  if (result.ok) {
    return NextResponse.redirect(
      new URL(
        `${slug}?status=ok&already=${result.alreadyUnsubscribed ? "1" : "0"}`,
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      ),
      { status: 303 },
    );
  }
  return NextResponse.redirect(
    new URL(
      `${slug}?status=fail&reason=${result.error}`,
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    { status: 303 },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Cas 1 : RFC 8058 One-Click (Gmail/Outlook envoie POST direct sur l'URL
  // du header List-Unsubscribe avec body `List-Unsubscribe=One-Click`).
  // Le token est alors dans la query string de l'URL elle-même.
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");

  // Cas 2 : POST formulaire HTML depuis /desabonnement → token dans le body.
  let bodyToken: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    bodyToken = params.get("token");
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    bodyToken = (formData.get("token") as string | null) ?? null;
  }

  const token = queryToken ?? bodyToken;
  return handle(token, pickLocale(req));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return handle(token, pickLocale(req));
}
