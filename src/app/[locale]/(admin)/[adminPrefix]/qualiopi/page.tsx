/**
 * Admin — Formation / Qualiopi · Vue d'ensemble (T0).
 *
 * Hub du back-office organisme de formation. En T0 : statut de divulgation
 * publique (déploiement phasé) + état de complétion des paramètres légaux
 * obligatoires (NDA, Qualiopi, SIRET, adresses, référent handicap) que Will
 * doit renseigner. Les sections métier (formations, sessions, conformité…)
 * sont ajoutées tranche par tranche avec leurs pages.
 *
 * Server Component force-dynamic (lecture SiteSetting cat. qualiopi).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
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

  const config = await getAllQualiopiConfig();
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

  const labelCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]";
  const valueCls =
    "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Formation / Qualiopi"
        description="Back-office organisme de formation. Construit et déployé, mais invisible au public tant que la divulgation est en Phase A (avant obtention NDA + Qualiopi)."
      />

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
