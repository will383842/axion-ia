// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Analytics & SEO V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

type Status = "ok" | "not-configured";

interface VerificationCard {
  name: string;
  status: Status;
  detail: string;
  externalUrl: string;
  helpUrl: string;
  envVar: string;
}

interface Props {
  adminPrefix: string;
  plausibleShared: string | undefined;
  plausibleDomain: string | undefined;
  plausibleApi: string;
  verifications: ReadonlyArray<VerificationCard>;
  indexNowConfigured: boolean;
  pingAction: () => Promise<void>;
}

function statusPill(status: Status, label?: string) {
  const text = label ?? (status === "ok" ? "● Configuré" : "○ Non configuré");
  return <span className={`admin-status-pill admin-status-${status}`}>{text}</span>;
}

export function AnalyticsV2({
  adminPrefix,
  plausibleShared,
  plausibleDomain,
  plausibleApi,
  verifications,
  indexNowConfigured,
  pingAction,
}: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Analytics & SEO"
        description="Audience (Plausible) + indexation moteurs (Google Search Console, Bing, IndexNow). Tout est consolidé ici — pas besoin d'ouvrir plusieurs onglets."
        actions={
          <Link href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
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
              className="mt-[var(--space-admin-3)] h-[1200px] w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]"
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
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
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
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">IndexNow — notification instantanée Bing</h2>
        <p className="admin-meta-block">
          Protocol IndexNow : notifie Bing (+ autres moteurs compatibles IndexNow.org) en quelques
          secondes quand le contenu change (vs. 6+ mois en mode crawl passif). Le ping des articles
          de blog est automatique à la publication. Bouton ci-dessous = ping manuel des 10 pages
          stratégiques (utile après un push de modifications importantes).
        </p>
        <p className="admin-meta-block">
          {indexNowConfigured ? statusPill("ok", "● Clé configurée") : statusPill("not-configured")}{" "}
          · Endpoint forwarder : <code>POST /api/indexnow</code> · Clé exposée :{" "}
          <a
            href="/api/indexnow/key"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link"
          >
            /api/indexnow/key ↗
          </a>
        </p>
        <form action={pingAction}>
          <button
            type="submit"
            className="admin-button"
            disabled={!indexNowConfigured}
            title={
              indexNowConfigured
                ? "Notifier les 10 pages stratégiques aux moteurs IndexNow"
                : "INDEXNOW_KEY absente — configurer côté Coolify env vars"
            }
          >
            🔔 Notifier les moteurs maintenant
          </button>
        </form>
        <p className="admin-meta-small mt-[var(--space-admin-3)]">
          Pages notifiées : homepage FR+EN, /interventions FR+EN, /reserver, /book, méthodologie,
          comparer, stack-ia, centre-aide.
        </p>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Events Plausible custom</h2>
        <p className="admin-meta-block">
          Pour mesurer les conversions (clic CTA, soumission booking, téléchargement
          mentions/sous-processeurs, etc.), utilise le helper côté client :
        </p>
        <pre className="admin-meta-block overflow-x-auto">
          <code>{`import { trackEvent } from "@/components/analytics/Plausible";

trackEvent("Booking Submitted", {
  props: { intervention: "audit", tier: "approfondie", ville: "Paris" },
});`}</code>
        </pre>
        <p className="admin-meta-block">
          Les events apparaissent dans Plausible → onglet <em>Goals</em>. Aucun bandeau cookies
          requis (Plausible CNIL-exempté : pas de PII, pas de fingerprint).
        </p>
      </AdminCard>

      <AdminCard>
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
            <Link href={`/fr/${adminPrefix}/infra`} className="admin-link">
              /infra → carte Sentry
            </Link>
            .
          </li>
          <li>
            <strong>Trafic edge + bots</strong> → Cloudflare Dashboard → Analytics.
          </li>
          <li>
            <strong>Uptime</strong> →{" "}
            <Link href={`/fr/${adminPrefix}/infra`} className="admin-link">
              /infra → carte UptimeRobot
            </Link>
            .
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
