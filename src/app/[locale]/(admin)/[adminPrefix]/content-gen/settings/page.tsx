/**
 * Content Generator — Settings index (§ 12.1 master prompt).
 *
 * Hub vers les 11 sous-pages de configuration. Toutes les valeurs sont
 * persistées en DB (`ContentGenConfig`, `ProviderConfig`, tables dédiées) —
 * aucun fichier TS de config à toucher pour Will.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

const SECTIONS: ReadonlyArray<{ href: string; label: string; description: string }> = [
  {
    href: "providers",
    label: "Providers IA",
    description: "Toggles, modèles, cost caps, rate-limits",
  },
  {
    href: "batches",
    label: "Batches & workers",
    description: "Daily batch size, concurrency, retry policy",
  },
  {
    href: "policies",
    label: "Policies",
    description: "Skip-existing, plagiat, retention tier-3, RSS auto-publish",
  },
  {
    href: "banned-phrases",
    label: "Phrases interdites",
    description: "CRUD doctrine (warn / block)",
  },
  {
    href: "llms-txt",
    label: "llms.txt",
    description: "Édition manuelle du fichier servi à la racine",
  },
  {
    href: "coverage-distribution",
    label: "Distribution 5 types",
    description: "Profils nommés CRUD, somme 100 %",
  },
  {
    href: "audience-mix",
    label: "Mix audiences",
    description: "Matrice taille INSEE × organisation, somme 100 %",
  },
  {
    href: "search-intent-distribution",
    label: "Intentions de recherche",
    description: "5 intentions, somme 100 %",
  },
  {
    href: "quality-loop",
    label: "Boucle qualité",
    description: "Toggle + seuils + budget mensuel",
  },
  {
    href: "qa-policies",
    label: "Q/R post-process",
    description: "Auto-create pages, seuil mots, CTR promotion",
  },
  { href: "kill-switch", label: "Kill switch", description: "Stop all generations en 1 clic" },
];

export default async function SettingsIndexPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const base = `/fr/${adminPrefix}/content-gen/settings`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Réglages content-gen</h1>
          <p className="admin-meta">
            30 réglages éditables admin · 0 hardcoded. Doctrine § 12.5 master prompt.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <ul className="admin-quick-actions">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a href={`${base}/${s.href}`}>
                <strong>{s.label}</strong>
                <span className="admin-meta"> — {s.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
