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

  // Top URLs stratégiques à re-notifier manuellement (homepage + hubs + booking).
  // Le ping blog est déjà automatique sur publication (cf. admin-blog/actions.ts).
  const urlList = [
    `${SITE_URL}/fr`,
    `${SITE_URL}/en`,
    `${SITE_URL}/fr/interventions`,
    `${SITE_URL}/en/interventions`,
    `${SITE_URL}/fr/appel`,
    `${SITE_URL}/en/book-a-call`,
    `${SITE_URL}/fr/methodologie`,
    `${SITE_URL}/fr/comparer`,
    `${SITE_URL}/fr/stack-ia`,
    `${SITE_URL}/fr/centre-aide`,
  ];

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
    const cause = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, message: `Erreur réseau : ${cause}`, urlsPinged: 0 };
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
      pingAction={async () => {
        "use server";
        await pingIndexNowAction();
      }}
    />
  );
}
