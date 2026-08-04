// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Settings index V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const SECTIONS: ReadonlyArray<{ href: string; label: string; description: string }> = [
  {
    href: "providers",
    label: "Providers IA",
    description: "Activation, modèles, plafonds de dépense, limites d'appels",
  },
  {
    href: "batches",
    label: "Batches & workers",
    description: "Taille des lots quotidiens, parallélisme, nouvelles tentatives",
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
    href: "benefit-gate",
    label: "Benefit-gate & profils (v2)",
    description: "Gate bénéfice concret (commercial) + juge LLM PH3 + profils qualité",
  },
  {
    href: "qa-policies",
    label: "Q/R post-process",
    description: "Auto-create pages, seuil mots, CTR promotion",
  },
  {
    href: "kill-switch",
    label: "Kill switch",
    description: "Arrêter toutes les générations en un clic",
  },
  {
    href: "seed-initial",
    label: "Init KB + Presets",
    // 🔴 CES DEUX ÉCRANS ANNONÇAIENT DES CHIFFRES DIFFÉRENTS pour le même bouton :
    // « 130 facts et 6 presets » ici, « 290 facts et 8 presets » sur la page.
    // Aucun des deux n'était calculé — le seed retourne le vrai compte APRÈS
    // exécution, et c'est le seul chiffre qu'on puisse écrire sans mentir.
    description: "Charge les informations de référence et les modèles de campagne (1 clic)",
  },
  {
    href: "kb-ingest",
    label: "Ingestion base de connaissances",
    description: "Importer du contenu externe (URL ou sitemap) dans la base de connaissances",
  },
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
        description="Tous les réglages sont modifiables ici et enregistrés en base."
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
