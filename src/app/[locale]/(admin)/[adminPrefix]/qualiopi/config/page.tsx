/**
 * Admin — Qualiopi · Configuration (valeurs légales & métier).
 *
 * Saisie des paramètres SiteSetting cat. `qualiopi` : NDA, SIRET, n° Qualiopi,
 * référent handicap, barèmes OPCO, RAC CPF, seuils, etc. Comble l'absence d'UI
 * relevée à l'audit E2E 2026-06-06. Server Component force-dynamic.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  QualiopiConfigForm,
  type ConfigField,
} from "@/components/admin/qualiopi/QualiopiConfigForm";
import {
  getAllQualiopiConfig,
  QUALIOPI_CONFIG_REGISTRY,
  type QualiopiConfigKey,
} from "@/server/qualiopi/config/site-settings";

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
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as QualiopiConfigKey[];
  const fields: ConfigField[] = keys.map((k) => {
    const entry = QUALIOPI_CONFIG_REGISTRY[k];
    const value = current[k];
    return {
      key: k,
      description: entry.description,
      value: value == null ? "" : String(value),
      isNumber: typeof entry.default === "number",
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
      <QualiopiConfigForm fields={fields} />
    </AdminPageShell>
  );
}
