// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Settings index V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

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

interface Props {
  adminPrefix: string;
}

export function SettingsIndexV2({ adminPrefix }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}/content-gen/settings`;
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Réglages content-gen"
        description="30 réglages éditables admin · 0 hardcoded. Doctrine § 12.5 master prompt."
      />
      <AdminCard>
        <ul className="admin-quick-actions">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link href={`${base}/${s.href}`}>
                <strong>{s.label}</strong>
                <span className="admin-meta"> — {s.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
