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
    `${SITE_URL}/fr/reserver`,
    `${SITE_URL}/en/book`,
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

// ─── UI helpers ─────────────────────────────────────────────────────────────

function statusPill(status: Status, label?: string) {
  const text = label ?? (status === "ok" ? "● Configuré" : "○ Non configuré");
  return <span className={`admin-status-pill admin-status-${status}`}>{text}</span>;
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

  const verifications: VerificationCard[] = [
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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Analytics &amp; SEO</h1>
          <p className="admin-meta">
            Audience (Plausible) + indexation moteurs (Google Search Console, Bing, IndexNow). Tout
            est consolidé ici — pas besoin d&apos;ouvrir plusieurs onglets.
          </p>
        </div>
        <div>
          <a href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </a>
        </div>
      </div>

      {/* ── Audience (Plausible embed) ────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Audience — Plausible Analytics</h2>
        {plausibleShared ? (
          <>
            <p className="admin-meta-block">
              Dashboard live · domaine <code>{plausibleDomain ?? "axion-ia.com"}</code> ·{" "}
              <a
                href={plausibleApi}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-link"
              >
                Ouvrir en plein écran ↗
              </a>
            </p>
            <iframe
              src={plausibleShared}
              loading="lazy"
              title="Plausible Analytics dashboard"
              style={{
                width: "100%",
                height: "1200px",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                marginTop: "12px",
              }}
            />
          </>
        ) : (
          <>
            <p className="admin-meta-block">
              {statusPill("not-configured")} Embed dashboard non configuré.
            </p>
            <p className="admin-meta-block">
              <strong>Comment activer ?</strong> Ouvrir{" "}
              <a
                href={plausibleApi}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-link"
              >
                Plausible
              </a>{" "}
              → Site Settings → <em>Visibility</em> → <em>Add a shared link</em> → copier l&apos;URL
              générée → la coller dans la variable serveur <code>PLAUSIBLE_SHARED_LINK</code>{" "}
              (Coolify env vars) → redémarrer l&apos;app.
            </p>
            <p className="admin-meta-block">
              En attendant, le dashboard reste accessible en plein écran :{" "}
              <a
                href={plausibleApi}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-link"
              >
                {plausibleApi} ↗
              </a>
            </p>
          </>
        )}
      </div>

      {/* ── Vérifications SEO (GSC / Bing) ──────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Vérification moteurs de recherche</h2>
        <p className="admin-meta-block">
          Balises <code>&lt;meta verification&gt;</code> nécessaires pour réclamer le site dans
          chaque console webmaster. Sans ça : pas de rapport de couverture, pas d&apos;inspection
          d&apos;URL, pas de soumission de sitemap manuelle.
        </p>
        <div className="admin-kpi-grid">
          {verifications.map((v) => (
            <div key={v.name} className="admin-card admin-card-inline">
              <div className="admin-infra-card-head">
                <strong>{v.name}</strong>
                {statusPill(v.status)}
              </div>
              <p className="admin-meta">{v.detail}</p>
              <p className="admin-meta-small">
                Variable serveur : <code>{v.envVar}</code>
              </p>
              <p className="admin-meta-block">
                <a
                  href={v.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link"
                >
                  Ouvrir console ↗
                </a>
                {v.status === "not-configured" && (
                  <>
                    {" · "}
                    <a
                      href={v.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-link"
                    >
                      Comment vérifier ?
                    </a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── IndexNow ─────────────────────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">IndexNow — notification instantanée Bing</h2>
        <p className="admin-meta-block">
          Protocol IndexNow : notifie Bing (+ autres moteurs compatibles IndexNow.org) en quelques
          secondes quand le contenu change (vs. 6+ mois en mode crawl passif). Le ping des articles
          de blog est automatique à la publication. Bouton ci-dessous = ping manuel des 10 pages
          stratégiques (utile après un push de modifications importantes).
        </p>
        <p className="admin-meta-block">
          {env.INDEXNOW_KEY ? statusPill("ok", "● Clé configurée") : statusPill("not-configured")} ·
          Endpoint forwarder : <code>POST /api/indexnow</code> · Clé exposée :{" "}
          <a
            href="/api/indexnow/key"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link"
          >
            /api/indexnow/key ↗
          </a>
        </p>
        <form
          action={async () => {
            "use server";
            await pingIndexNowAction();
          }}
        >
          <button
            type="submit"
            className="admin-button"
            disabled={!env.INDEXNOW_KEY}
            title={
              env.INDEXNOW_KEY
                ? "Notifier les 10 pages stratégiques aux moteurs IndexNow"
                : "INDEXNOW_KEY absente — configurer côté Coolify env vars"
            }
          >
            🔔 Notifier les moteurs maintenant
          </button>
        </form>
        <p className="admin-meta-small" style={{ marginTop: "8px" }}>
          Pages notifiées : homepage FR+EN, /interventions FR+EN, /reserver, /book, méthodologie,
          comparer, stack-ia, centre-aide.
        </p>
      </div>

      {/* ── Events tracking Plausible ────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Events Plausible custom</h2>
        <p className="admin-meta-block">
          Pour mesurer les conversions (clic CTA, soumission booking, téléchargement
          mentions/sous-processeurs, etc.), utilise le helper côté client :
        </p>
        <pre className="admin-meta-block" style={{ overflowX: "auto" }}>
          <code>{`import { trackEvent } from "@/components/analytics/Plausible";

trackEvent("Booking Submitted", {
  props: { intervention: "audit", tier: "approfondie", ville: "Paris" },
});`}</code>
        </pre>
        <p className="admin-meta-block">
          Les events apparaissent dans Plausible → onglet <em>Goals</em>. Aucun bandeau cookies
          requis (Plausible CNIL-exempté : pas de PII, pas de fingerprint).
        </p>
      </div>

      {/* ── Doc rapide ───────────────────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Pour suivre quoi, où ?</h2>
        <ul className="admin-meta-block">
          <li>
            <strong>Trafic, sources, pages, pays, devices</strong> → Plausible (section ci-dessus).
          </li>
          <li>
            <strong>Mots-clés Google + couverture indexation</strong> → Google Search Console.
          </li>
          <li>
            <strong>Erreurs JS, exceptions API</strong> →{" "}
            <a href={`/fr/${adminPrefix}/infra`} className="admin-link">
              /infra → carte Sentry
            </a>
            .
          </li>
          <li>
            <strong>Trafic edge + bots</strong> → Cloudflare Dashboard → Analytics.
          </li>
          <li>
            <strong>Uptime</strong> →{" "}
            <a href={`/fr/${adminPrefix}/infra`} className="admin-link">
              /infra → carte UptimeRobot
            </a>
            .
          </li>
        </ul>
      </div>
    </section>
  );
}
