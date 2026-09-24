// API /api/newsletter/confirmer — le POST du bouton « Confirmer » (lot L2, 2026-09-24).
//
// La confirmation de la lettre ne se fait PLUS au rendu d'un GET : les
// scanneurs de liens (Safe Links, Mimecast) confirmaient à la place de la
// personne. Même remède que `/api/unsubscribe` (2026-09-02) : le lien de
// l'e-mail mène à une page qui porte un bouton ; seul le POST de ce bouton
// confirme, puis redirige (303) vers la page de résultat.
//
// Pas de GET : une navigation vers cette adresse répond 405 (Next), et c'est
// le comportement voulu — un lien ouvert n'est pas un consentement donné.

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { confirmerLettre } from "@/server/newsletter/confirmer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_PAR_MINUTE = 20;

function ipDe(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pageResultat(locale: "fr" | "en", statut: string): URL {
  return new URL(
    `/${locale}/confirmation/newsletter?statut=${statut}`,
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
}

async function lireFormulaire(
  req: NextRequest,
): Promise<{ token: string | null; locale: "fr" | "en" }> {
  const type = req.headers.get("content-type") || "";
  let token: string | null = null;
  let locale: string | null = null;
  if (type.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(await req.text());
    token = p.get("token");
    locale = p.get("locale");
  } else if (type.includes("multipart/form-data")) {
    const f = await req.formData();
    token = (f.get("token") as string | null) ?? null;
    locale = (f.get("locale") as string | null) ?? null;
  }
  return { token, locale: locale === "en" ? "en" : "fr" };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = ipDe(req);
  const rl = await checkRateLimit(`newsletter-confirmer:${ip}`, {
    limit: LIMITE_PAR_MINUTE,
    windowSec: 60,
  });
  if (!rl.allowed) return new NextResponse("rate_limited", { status: 429 });

  const { token, locale } = await lireFormulaire(req);
  const r = await confirmerLettre(token, {
    ip,
    userAgent: req.headers.get("user-agent"),
  });
  if (r.ok) {
    return NextResponse.redirect(pageResultat(r.locale, r.alreadyConfirmed ? "deja" : "ok"), {
      status: 303,
    });
  }
  return NextResponse.redirect(pageResultat(locale, r.error), { status: 303 });
}
