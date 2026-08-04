// Console Analytics & SEO admin (2026-05-13).
//
// Centralise tout ce qui concerne la mesure d'audience + l'indexation moteurs :
//  - Embed Plausible (via shared dashboard link, server-only env)
//  - Status vérification GSC / Bing (env vars presence check)
//  - IndexNow : status clé + bouton "Notifier moteurs maintenant" (Server Action)
//  - Rappel events Plausible custom trackés côté code (trackEvent helper)
//
// Auth admin requise. Force-dynamic (lecture env vars + Server Action POST).
// Pas d'écriture DB ici — purement read-only + ping moteurs externes.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { SITE_URL } from "@/lib/seo";
import { AnalyticsV2 } from "./_v2/AnalyticsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

type Status = "ok" | "not-configured";

interface VerificationCard {
  name: string;
  status: Status;
  detail: string;
  externalUrl: string;
  helpUrl: string;
  envVar: string;
}

// ─── Server Action — IndexNow ping manuel ───────────────────────────────────

interface PingResult {
  ok: boolean;
  status: number;
  message: string;
  urlsPinged: number;
}

/**
 * Chemins re-notifiés manuellement aux moteurs (page d'accueil, hubs, prise de
 * rendez-vous). Le ping des articles de blog est déjà automatique à la
 * publication.
 *
 * 🔴 Cette liste était en dur DEUX FOIS : ici, et dans un paragraphe de la vue
 * qui annonçait « /reserver, /book » — deux routes qui n'existent plus. La vue
 * la reçoit désormais en prop et ne peut plus diverger.
 */
const CHEMINS_NOTIFIES = [
  "/fr",
  "/en",
  "/fr/interventions",
  "/en/interventions",
  "/fr/appel",
  "/en/book-a-call",
  "/fr/methodologie",
  "/fr/comparer",
  "/fr/stack-ia",
  "/fr/centre-aide",
] as const;

async function pingIndexNowAction(): Promise<PingResult> {
  "use server";
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, message: "Session expirée", urlsPinged: 0 };
  }
  if (!env.INDEXNOW_KEY) {
    return {
      ok: false,
      status: 400,
      message: "INDEXNOW_KEY non configurée — voir .env.example",
      urlsPinged: 0,
    };
  }

  const urlList = CHEMINS_NOTIFIES.map((p) => `${SITE_URL}${p}`);

  try {
    const res = await fetch(`${SITE_URL}/api/indexnow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urlList }),
      signal: AbortSignal.timeout(10_000),
    });
    return {
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `${urlList.length} URLs notifiées à Bing (+ autres moteurs IndexNow)`
        : `HTTP ${res.status} — vérifier logs serveur`,
      urlsPinged: res.ok ? urlList.length : 0,
    };
  } catch (err) {
    // Détail technique dans les logs serveur — l'écran affiche un message
    // métier fixe, jamais err.message brut.
    console.error("[analytics] ping IndexNow en échec :", err);
    return {
      ok: false,
      status: 0,
      message: "Erreur réseau — le ping IndexNow n'a pas abouti. Détail dans les logs serveur.",
      urlsPinged: 0,
    };
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const plausibleShared = env.PLAUSIBLE_SHARED_LINK;
  const plausibleDomain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const plausibleApi = env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com";

  const verificationsV2: VerificationCard[] = [
    {
      name: "Google Search Console",
      status: env.GOOGLE_SITE_VERIFICATION ? "ok" : "not-configured",
      detail: env.GOOGLE_SITE_VERIFICATION
        ? "Balise meta posée — vérifie « Domain property » dans GSC"
        : "Variable GOOGLE_SITE_VERIFICATION absente",
      externalUrl: "https://search.google.com/search-console?resource_id=sc-domain%3Aaxion-ia.com",
      helpUrl: "https://search.google.com/search-console/welcome",
      envVar: "GOOGLE_SITE_VERIFICATION",
    },
    {
      name: "Bing Webmaster Tools",
      status: env.BING_SITE_VERIFICATION ? "ok" : "not-configured",
      detail: env.BING_SITE_VERIFICATION
        ? "Balise meta msvalidate.01 posée"
        : "Variable BING_SITE_VERIFICATION absente",
      externalUrl: "https://www.bing.com/webmasters/home",
      helpUrl: "https://www.bing.com/webmasters/about",
      envVar: "BING_SITE_VERIFICATION",
    },
  ];
  return (
    <AnalyticsV2
      adminPrefix={adminPrefix}
      plausibleShared={plausibleShared}
      plausibleDomain={plausibleDomain}
      plausibleApi={plausibleApi}
      verifications={verificationsV2}
      indexNowConfigured={Boolean(env.INDEXNOW_KEY)}
      pingAction={pingIndexNowAction}
      pagesNotifiees={CHEMINS_NOTIFIES}
    />
  );
}
