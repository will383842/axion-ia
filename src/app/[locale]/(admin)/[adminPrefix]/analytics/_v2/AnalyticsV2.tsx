// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Analytics & SEO V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { IndexNowPingButton, type PingResult } from "./IndexNowPingButton";

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
  pingAction: () => Promise<PingResult>;
  /** Chemins réellement notifiés — dérivés de la liste envoyée. */
  pagesNotifiees: ReadonlyArray<string>;
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
  pagesNotifiees,
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
              className="mt-[var(--space-admin-3)] h-[1200px] w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]"
            />
          </>
        ) : (
          <>
            <p className="admin-meta-block">
              {statusPill("not-configured")} Tableau de bord intégré non configuré.
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
          · Adresse de transmission : <code>POST /api/indexnow</code> · Clé exposée :{" "}
          <a
            href="/api/indexnow/key"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link"
          >
            /api/indexnow/key ↗
          </a>
        </p>
        <IndexNowPingButton
          action={pingAction}
          disabled={!indexNowConfigured}
          titre={
            indexNowConfigured
              ? `Prévenir les moteurs que ces ${pagesNotifiees.length} pages ont changé`
              : "La clé de notification n'est pas configurée sur le serveur"
          }
        />
        {/* 🔴 CETTE LISTE ÉTAIT FAUSSE. Elle annonçait « /reserver, /book »
            alors que les URLs réellement envoyées sont `/fr/appel` et
            `/en/book-a-call`. Écrite à la main, elle a cessé de suivre le code
            le jour où les routes ont été renommées. Elle est désormais DÉRIVÉE
            de la liste effectivement notifiée : elle ne peut plus mentir. */}
        <p className="admin-meta-small mt-[var(--space-admin-3)]">
          Pages notifiées ({pagesNotifiees.length}) : {pagesNotifiees.join(" · ")}
        </p>
      </AdminCard>

      {/* 🔴 CETTE CARTE ÉTAIT DE LA DOCUMENTATION DÉVELOPPEUR : un bloc de
          code TypeScript, un nom de module et un chemin d'import, sur un écran
          d'administration. Elle est repliée — l'information reste, elle ne
          s'impose plus à qui vient lire des chiffres. */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <details>
          <summary className="admin-h2 cursor-pointer select-none">
            Mesurer une conversion (pour l’équipe technique)
          </summary>
          <p className="admin-meta-block">
            Les conversions (clic sur un bouton d’appel à l’action, envoi d’un formulaire,
            téléchargement) se déclarent côté site avec le raccourci suivant :
          </p>
          <pre className="admin-meta-block overflow-x-auto">
            <code>{`import { trackEvent } from "@/components/analytics/Plausible";

trackEvent("Booking Submitted", {
  props: { intervention: "audit", tier: "approfondie", ville: "Paris" },
});`}</code>
          </pre>
          <p className="admin-meta-block">
            Elles apparaissent ensuite dans Plausible, onglet <em>Goals</em>. Aucun bandeau cookies
            n’est requis : Plausible ne pose ni identifiant ni empreinte.
          </p>
        </details>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Pour suivre quoi, où ?</h2>
        <ul className="admin-meta-block">
          <li>
            <strong>Trafic, sources, pages, pays, appareils</strong> → Plausible (section
            ci-dessus).
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
