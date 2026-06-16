/**
 * Wizard /content-gen/campaigns/new — POINT D'ENTRÉE UNIQUE de génération.
 *
 * Wizard 4 étapes pour créer une CoverageCampaign :
 *   Étape 1 : Quoi générer ? (types de contenu + presets en raccourci)
 *   Étape 2 : Pour qui / où ? (verticale, villes, public)
 *   Étape 3 : Combien / à quel rythme ? (volume + estimation coût&durée en direct)
 *   Étape 4 : Vérifier & lancer (récap + Lancer → redirection /coverage/[id])
 *
 * Route : /fr/<adminPrefix>/content-gen/campaigns/new
 * Supporte ?preset=<slug> (raccourci depuis /coverage/presets) et
 * ?ville=<slug> (redirections villes) pour pré-remplir le wizard.
 * Convention V2 (AdminPageShell).
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { CampaignWizardV2 } from "./_v2/CampaignWizardV2";
import { FALLBACK_PRESETS, type PresetRow } from "./_v2/preset-data";
import { presetToWizardSeed, type PresetWizardSeed } from "./_v2/preset-mapping";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ preset?: string; ville?: string }>;
}

/** Résout la config d'un preset par slug (DB → fallback statique). */
async function resolvePresetSeed(
  slug: string,
): Promise<{ seed: PresetWizardSeed; name: string } | null> {
  let row: PresetRow | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbRow = await (prisma as any).campaignTemplate.findUnique({
      where: { slug },
    });
    if (dbRow) row = dbRow as PresetRow;
  } catch {
    // table non migrée / non seedée → fallback
  }
  if (!row) row = FALLBACK_PRESETS.find((p) => p.slug === slug);
  if (!row) return null;
  return { seed: presetToWizardSeed(row.config), name: row.name };
}

export default async function CampaignNewPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const { preset, ville } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const resolved = preset ? await resolvePresetSeed(preset) : null;

  return (
    <CampaignWizardV2
      adminPrefix={adminPrefix}
      {...(resolved ? { presetSeed: resolved.seed, presetName: resolved.name } : {})}
      {...(ville ? { villeSlug: ville } : {})}
    />
  );
}
