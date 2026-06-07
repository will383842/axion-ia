/**
 * Admin — Formation / Qualiopi · Vue d'ensemble (T0 enrichi T16).
 *
 * Hub du back-office organisme de formation.
 * - Bloc statut divulgation / config légale (conservé depuis T0).
 * - Grille de navigation vers TOUS les modules livrés avec compteurs Prisma
 *   et AlertesLiveBadge temps réel (ajouté T16).
 *
 * Server Component force-dynamic (lecture SiteSetting cat. qualiopi + counts DB).
 * Stub-aware : si DATABASE_URL contient « stub.invalid », tous les compteurs
 * retournent 0 sans appel Prisma réel.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBreadcrumbs } from "@/components/admin/ui/AdminBreadcrumbs";
import { AlertesLiveBadge } from "@/components/admin/qualiopi/AlertesLiveBadge";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import {
  getAllQualiopiConfig,
  QUALIOPI_CONFIG_REGISTRY,
} from "@/server/qualiopi/config/site-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formation / Qualiopi — Vue d'ensemble | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Paramètres légaux obligatoires avant ouverture de l'activité (à renseigner par Will). */
const REQUIRED_LEGAL_KEYS = [
  "nda_numero",
  "qualiopi_numero",
  "qualiopi_organisme",
  "qualiopi_validite",
  "siret",
  "adresse_siege",
  "adresse_exercice",
  "referent_handicap_email",
] as const;

/** Guard stub-aware pour les compteurs Prisma. */
function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Compteurs DB — retourne des zéros en build stub. */
async function loadCounts(): Promise<{
  formations: number;
  sessions: number;
  clients: number;
  devis: number;
  offres: number;
  factures: number;
  reclamationsOuvertes: number;
  veilles: number;
  partenariats: number;
  sousTraitants: number;
  revuesDirection: number;
  appreciations: number;
  alertesNonLues: number;
  trainers: number;
  trainees: number;
}> {
  if (isStubBuild()) {
    return {
      formations: 0,
      sessions: 0,
      clients: 0,
      devis: 0,
      offres: 0,
      factures: 0,
      reclamationsOuvertes: 0,
      veilles: 0,
      partenariats: 0,
      sousTraitants: 0,
      revuesDirection: 0,
      appreciations: 0,
      alertesNonLues: 0,
      trainers: 0,
      trainees: 0,
    };
  }

  const [
    formations,
    sessions,
    clients,
    devis,
    offres,
    factures,
    reclamationsOuvertes,
    veilles,
    partenariats,
    sousTraitants,
    revuesDirection,
    appreciations,
    alertesNonLues,
    trainers,
    trainees,
  ] = await Promise.all([
    prisma.formation.count(),
    prisma.trainingSession.count(),
    prisma.client.count(),
    prisma.devis.count(),
    prisma.offreSite.count(),
    prisma.factureFormation.count(),
    prisma.reclamation.count({ where: { statut: { in: ["nouvelle", "en_cours"] } } }),
    prisma.veille.count(),
    prisma.partenariat.count({ where: { actif: true } }),
    prisma.sousTraitant.count({ where: { actif: true } }),
    prisma.revueDirection.count(),
    prisma.appreciation.count(),
    prisma.alerteSysteme.count({ where: { lu: false } }),
    prisma.trainer.count(),
    prisma.trainee.count(),
  ]);

  return {
    formations,
    sessions,
    clients,
    devis,
    offres,
    factures,
    reclamationsOuvertes,
    veilles,
    partenariats,
    sousTraitants,
    revuesDirection,
    appreciations,
    alertesNonLues,
    trainers,
    trainees,
  };
}

interface ModuleNavItem {
  href: string;
  icon: string;
  label: string;
  count?: number;
  /** Accent de couleur si alerte ou attention requise. */
  tone?: "warning" | "error" | "success" | "neutral";
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiOverviewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/fr/${adminPrefix}/qualiopi`;

  const [config, counts] = await Promise.all([getAllQualiopiConfig(), loadCounts()]);
  const disclosureOn = isQualiopiPublicDisclosureEnabled();

  const legalRows = REQUIRED_LEGAL_KEYS.map((key) => {
    const value = String(config[key] ?? "").trim();
    return {
      key,
      label: QUALIOPI_CONFIG_REGISTRY[key].description,
      filled: value.length > 0,
      value,
    };
  });
  const filledCount = legalRows.filter((r) => r.filled).length;

  // ── Grille modules ────────────────────────────────────────────────────────

  const moduleGroups: Array<{ titre: string; items: ModuleNavItem[] }> = [
    {
      titre: "Catalogue & ingénierie",
      items: [
        {
          href: `${base}/offres`,
          icon: "🏷️",
          label: "Offres",
          count: counts.offres,
          tone: "neutral",
        },
        {
          href: `${base}/formations`,
          icon: "📘",
          label: "Formations",
          count: counts.formations,
          tone: "neutral",
        },
        {
          href: `${base}/formation-engine`,
          icon: "⚙️",
          label: "Formation Engine",
          tone: "neutral",
        },
        {
          href: `${base}/formation-engine/validations`,
          icon: "✅",
          label: "Validations IA",
          tone: "neutral",
        },
      ],
    },
    {
      titre: "Sessions & participants",
      items: [
        {
          href: `${base}/sessions`,
          icon: "📅",
          label: "Sessions",
          count: counts.sessions,
          tone: "neutral",
        },
        {
          href: `${base}/formateurs`,
          icon: "🎓",
          label: "Formateurs",
          count: counts.trainers,
          tone: "neutral",
        },
        {
          href: `${base}/stagiaires`,
          icon: "👤",
          label: "Stagiaires",
          count: counts.trainees,
          tone: "neutral",
        },
      ],
    },
    {
      titre: "CRM & commercial",
      items: [
        {
          href: `${base}/clients`,
          icon: "🏢",
          label: "Clients (CRM)",
          count: counts.clients,
          tone: "neutral",
        },
        {
          href: `${base}/devis`,
          icon: "📄",
          label: "Devis",
          count: counts.devis,
          tone: "neutral",
        },
        {
          href: `${base}/financements`,
          icon: "💳",
          label: "Financements / Facturation",
          count: counts.factures,
          tone: "neutral",
        },
      ],
    },
    {
      titre: "Conformité & pilotage",
      items: [
        {
          href: `${base}/indicateurs`,
          icon: "📊",
          label: "Indicateurs / BPF",
          tone: "neutral",
        },
        {
          href: `${base}/conformite`,
          icon: "✅",
          label: "Conformité",
          tone: "neutral",
        },
        {
          href: `${base}/pilotage`,
          icon: "📊",
          label: "Pilotage",
          tone: "neutral",
        },
      ],
    },
    {
      titre: "Registres obligatoires",
      items: [
        {
          href: `${base}/reclamations`,
          icon: "📬",
          label: "Réclamations",
          count: counts.reclamationsOuvertes,
          tone: counts.reclamationsOuvertes > 0 ? "warning" : "neutral",
        },
        {
          href: `${base}/veille`,
          icon: "🔎",
          label: "Veille",
          count: counts.veilles,
          tone: "neutral",
        },
        {
          href: `${base}/partenariats`,
          icon: "🤝",
          label: "Partenariats",
          count: counts.partenariats,
          tone: "neutral",
        },
        {
          href: `${base}/sous-traitants`,
          icon: "🏭",
          label: "Sous-traitants",
          count: counts.sousTraitants,
          tone: "neutral",
        },
        {
          href: `${base}/revue-direction`,
          icon: "📋",
          label: "Revue de direction",
          count: counts.revuesDirection,
          tone: "neutral",
        },
        {
          href: `${base}/appreciations`,
          icon: "⭐",
          label: "Appréciations",
          count: counts.appreciations,
          tone: "neutral",
        },
      ],
    },
    {
      titre: "Outils transverses",
      items: [
        {
          href: `${base}/alertes`,
          icon: "🔔",
          label: "Alertes",
          count: counts.alertesNonLues,
          tone: counts.alertesNonLues > 0 ? "error" : "neutral",
        },
        {
          href: `${base}/mode-auditeur`,
          icon: "🔍",
          label: "Mode auditeur",
          tone: "neutral",
        },
      ],
    },
  ];

  const labelCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]";
  const valueCls =
    "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";

  const TONE_BADGE: Record<NonNullable<ModuleNavItem["tone"]>, string> = {
    error:
      "rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-error-subtle)] px-[var(--space-admin-2)] py-[var(--space-admin-0)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-error)]",
    warning:
      "rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-warning-subtle)] px-[var(--space-admin-2)] py-[var(--space-admin-0)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-warning-fg)]",
    success:
      "rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-success-subtle)] px-[var(--space-admin-2)] py-[var(--space-admin-0)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-success-fg)]",
    neutral:
      "rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-bg-subtle)] px-[var(--space-admin-2)] py-[var(--space-admin-0)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]",
  };

  return (
    <AdminPageShell>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: `/fr/${adminPrefix}` }, { label: "Formation / Qualiopi" }]}
        className="mb-[var(--space-admin-4)]"
      />

      <AdminPageHeader
        title="Formation / Qualiopi"
        description="Back-office organisme de formation. Construit et déployé, mais invisible au public tant que la divulgation est en Phase A (avant obtention NDA + Qualiopi)."
      />

      {/* ── Bloc alertes temps réel ─────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-3)]">
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          Alertes système :
        </span>
        <AlertesLiveBadge initialCount={counts.alertesNonLues} />
      </div>

      {/* ── Stats KPI ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatCard
          label="Divulgation publique"
          value={disclosureOn ? "Phase B — visible" : "Phase A — masquée"}
          tone={disclosureOn ? "warning" : "success"}
          meta={
            disclosureOn
              ? "OF_PUBLIC_DISCLOSURE_ENABLED=true — fiches publiques actives."
              : "Drapeau off : aucune mention Qualiopi/financement publique (conforme avant certification)."
          }
        />
        <AdminStatCard
          label="Paramètres légaux renseignés"
          value={`${filledCount} / ${REQUIRED_LEGAL_KEYS.length}`}
          tone={filledCount === REQUIRED_LEGAL_KEYS.length ? "success" : "warning"}
          meta="NDA, Qualiopi, SIRET, adresses, référent handicap."
        />
        <AdminStatCard
          label="Langue de génération"
          value={String(config.langue_generation).toUpperCase()}
          meta="FR figé en v1 (en/de/es gelés)."
        />
      </div>

      {/* ── Grille de navigation modules ─────────────────────────────────────── */}
      <section className="mt-[var(--space-admin-8)]">
        <h2 className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Modules du back-office
        </h2>

        <div className="flex flex-col gap-[var(--space-admin-7)]">
          {moduleGroups.map((group) => (
            <div key={group.titre}>
              <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                {group.titre}
              </h3>
              <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <AdminCard key={item.href + item.label} variant="interactive" elevation={1}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-[var(--space-admin-3)] no-underline"
                    >
                      <span
                        aria-hidden="true"
                        className="text-[length:var(--text-admin-xl)] leading-none"
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                          {item.label}
                        </div>
                        {item.count !== undefined && (
                          <div className="mt-[var(--space-admin-1)]">
                            <span className={TONE_BADGE[item.tone ?? "neutral"]}>{item.count}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </AdminCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Configuration légale ─────────────────────────────────────────────── */}
      <section className="mt-[var(--space-admin-7)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Configuration de l&apos;organisme (à compléter)
        </h2>
        <p className="mb-[var(--space-admin-5)] max-w-prose text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Ces identifiants légaux ne sont jamais inventés par le système : renseignez-les depuis les
          paramètres Qualiopi. Ils alimentent automatiquement les conventions, attestations,
          certificats et factures.
        </p>
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {legalRows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
            >
              <span className={labelCls}>{row.label}</span>
              {row.filled ? (
                <span className={valueCls}>✓ renseigné</span>
              ) : (
                <span className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-warning)]">
                  À renseigner
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AdminPageShell>
  );
}
