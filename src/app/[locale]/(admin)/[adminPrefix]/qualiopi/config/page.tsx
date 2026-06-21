/**
 * Admin — Qualiopi · Configuration (valeurs légales & métier).
 *
 * Saisie des paramètres SiteSetting cat. `qualiopi` : NDA, SIRET, n° Qualiopi,
 * référent handicap, barèmes OPCO, RAC CPF, seuils, etc. Comble l'absence d'UI
 * relevée à l'audit E2E 2026-06-06. Server Component force-dynamic.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  QualiopiConfigForm,
  type ConfigField,
} from "@/components/admin/qualiopi/QualiopiConfigForm";
import { SeedReferenceDataButton } from "@/components/admin/qualiopi/SeedReferenceDataButton";
import {
  getAllQualiopiConfig,
  QUALIOPI_CONFIG_REGISTRY,
  type QualiopiConfigKey,
} from "@/server/qualiopi/config/site-settings";
import { getQualiopiReferenceDataStatus } from "@/server/qualiopi/seed/reference-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Configuration | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiConfigPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const current = await getAllQualiopiConfig();
  const referenceStatus = await getQualiopiReferenceDataStatus(prisma);
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as QualiopiConfigKey[];
  const fields: ConfigField[] = keys.map((k) => {
    const entry = QUALIOPI_CONFIG_REGISTRY[k];
    const value = current[k];
    // Clés à valeurs énumérées (ex. regime_tva) → rendues en <select> côté UI.
    const options = entry.schema instanceof z.ZodEnum ? [...entry.schema.options] : undefined;
    return {
      key: k,
      description: entry.description,
      value: value == null ? "" : String(value),
      isNumber: typeof entry.default === "number",
      ...(options ? { options } : {}),
    };
  });

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Configuration Qualiopi"
        description="Valeurs légales & métier (NDA, SIRET, n° Qualiopi, référent handicap, barèmes OPCO, RAC CPF, seuils). Stockées dans SiteSetting cat. qualiopi ; injectées dans les PDF/pages. Laisser vide = non renseigné."
      />
      <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        ⚠️ Renseigner ces valeurs AVANT d&apos;activer la Phase B publique (
        <code>OF_PUBLIC_DISCLOSURE_ENABLED=true</code>). Le n° Qualiopi reste vide jusqu&apos;à
        obtention de la certification.
      </p>
      <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-lg)] font-[var(--font-weight-admin-semibold)]">
          Données de référence
        </h2>
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Le référentiel (offres, configuration, grilles qualité) est seedé{" "}
          <strong>automatiquement à chaque démarrage</strong>. Ce bouton permet de le
          (re)synchroniser manuellement après un déploiement ou un ajout d&apos;offres. Idempotent
          et non destructif : aucune valeur saisie n&apos;est écrasée.
        </p>
        <SeedReferenceDataButton initial={referenceStatus} />
      </section>

      <QualiopiConfigForm fields={fields} />
    </AdminPageShell>
  );
}
