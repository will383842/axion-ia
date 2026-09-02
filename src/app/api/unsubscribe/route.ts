// API /api/unsubscribe — RFC 8058 List-Unsubscribe (P0-5 fix Sprint 23+).
//
// Trois portes, trois réponses — et elles ne se ressemblent pas :
//
//   1. POST « One-Click » (body `List-Unsubscribe=One-Click`, jeton dans la
//      query) : c'est le client de messagerie qui parle (Gmail, Apple Mail,
//      Outlook), pas une personne. On désabonne et on répond **200**, sans
//      corps utile et SANS redirection.
//
//      🔴 2026-09-02 — cette route répondait 303 à ce POST. RFC 8058 § 3.1 :
//      « The mail sender MUST NOT return an HTTPS redirect, since redirected
//      POST actions have historically not worked reliably ». Un client qui ne
//      suit pas la redirection lisait un échec, et la personne qui avait
//      cliqué « Se désabonner » dans Gmail ne l'était peut-être pas. On ne
//      pouvait pas le savoir : l'action avait bien tourné côté serveur.
//
//   2. POST formulaire (jeton dans le corps, depuis /desabonnement) : c'est un
//      navigateur. On désabonne et on redirige (303) vers la page de résultat.
//
//   3. GET ?token= : ce n'est plus qu'une NAVIGATION vers la page de
//      confirmation, jamais une action.
//
//      🔴 2026-09-02 — le GET désabonnait. Or un GET est suivi par tout ce qui
//      « ouvre » les liens sans qu'une personne clique : les scanners de liens
//      d'entreprise (Defender for Office 365, Proofpoint), les préchargements
//      de navigateur, certains proxys d'images. Chacun d'eux désabonnait la
//      personne à son insu — et sans limite de débit, un balayage de jetons
//      aurait fait de même en masse. Le GET redirige désormais vers la page,
//      qui porte le bouton « Confirmer » (un POST). C'est le geste humain qui
//      désabonne, pas l'ouverture du lien.
//
// Limite de débit sur les trois portes : une adresse IP n'a aucune raison
// légitime de présenter plus d'une poignée de jetons par minute.

import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeNewsletterAction } from "@/features/newsletter/actions";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LOCALES = new Set(["fr", "en"]);
const LIMITE_PAR_MINUTE = 20;

function pickLocale(req: NextRequest): "fr" | "en" {
  const referer = req.headers.get("referer") || "";
  // Extrait la locale du chemin du referer si elle existe.
  const m = referer.match(/\/(fr|en)\b/);
  if (m && VALID_LOCALES.has(m[1]!)) return m[1] as "fr" | "en";
  return "fr";
}

function pageDesabonnement(locale: "fr" | "en", query: string): URL {
  const slug = locale === "en" ? "/en/unsubscribe" : "/fr/desabonnement";
  return new URL(`${slug}?${query}`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

async function debitDepasse(req: NextRequest): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(`unsubscribe:${ip}`, {
    limit: LIMITE_PAR_MINUTE,
    windowSec: 60,
  });
  return !rl.allowed;
}

/** Porte 2 — navigateur : on agit, puis on montre le résultat. */
async function desabonnerPuisRediriger(
  token: string | null,
  locale: "fr" | "en",
): Promise<NextResponse> {
  const result = await unsubscribeNewsletterAction(token);
  if (result.ok) {
    return NextResponse.redirect(
      pageDesabonnement(locale, `status=ok&already=${result.alreadyUnsubscribed ? "1" : "0"}`),
      { status: 303 },
    );
  }
  return NextResponse.redirect(pageDesabonnement(locale, `status=fail&reason=${result.error}`), {
    status: 303,
  });
}

/**
 * Porte 1 — client de messagerie (RFC 8058). Aucune redirection : 200 quand la
 * personne est désabonnée (ou l'était déjà — l'opération est idempotente, le
 * client n'a pas à distinguer), 400 sinon.
 */
async function desabonnerEnUnClic(token: string | null): Promise<NextResponse> {
  const result = await unsubscribeNewsletterAction(token);
  if (result.ok) {
    return new NextResponse("unsubscribed", { status: 200 });
  }
  return new NextResponse(result.error, { status: 400 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (await debitDepasse(req)) return new NextResponse("rate_limited", { status: 429 });

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");

  let bodyToken: string | null = null;
  let unClic = false;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(await req.text());
    bodyToken = params.get("token");
    unClic = params.get("List-Unsubscribe") === "One-Click";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    bodyToken = (formData.get("token") as string | null) ?? null;
    unClic = formData.get("List-Unsubscribe") === "One-Click";
  }

  const token = queryToken ?? bodyToken;
  if (unClic) return desabonnerEnUnClic(token);
  return desabonnerPuisRediriger(token, pickLocale(req));
}

/** Porte 3 — un lien ouvert n'est pas un consentement retiré. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (await debitDepasse(req)) return new NextResponse("rate_limited", { status: 429 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const locale = pickLocale(req);
  if (!token) {
    return NextResponse.redirect(pageDesabonnement(locale, "status=fail&reason=missing_token"), {
      status: 303,
    });
  }
  return NextResponse.redirect(pageDesabonnement(locale, `token=${encodeURIComponent(token)}`), {
    status: 303,
  });
}
