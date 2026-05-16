/**
 * Content Generator — CRUD CoverageDistributionProfile + AudienceMixProfile
 * (admin /settings/coverage-distribution + /settings/audience-mix).
 *
 * § 25.2 v1.7. Validation Zod somme = 100 % en input. Le worker campagne lit
 * ces profils à chaque pick-up de job pour décider du contentType et de
 * l'audience cible. Un profil `isDefault=true` par table (toggle exclusif).
 */

"use server";

// NOTE : "use server" interdit les exports non-async (Next 16). Les constantes
// (SERVICE_SECTORS, BANNED_FROM_EDITORIAL_MIX, SERVICE_SECTOR_LABELS) et les
// pure validators (assertEditorialKeys, assertSum100) vivent dans
// @/server/content-gen/shared/editorial-mix-rules (importable depuis les pages
// client/server sans constraint).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ServiceSector } from "../../../../prisma/generated/client";
import { assertEditorialKeys, assertSum100 } from "@/server/content-gen/shared/editorial-mix-rules";
import { requireAdmin } from "./_auth";

function adminPath(suffix: string): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/${suffix}`;
}

// ────────────────────────────────────────────────────────────────────
// CoverageDistributionProfile — 5 types contenu
// ────────────────────────────────────────────────────────────────────

export interface DistributionRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly distribution: Record<string, number>;
  readonly isDefault: boolean;
  readonly serviceSector: ServiceSector | null;
  readonly updatedAt: Date;
}

export async function listDistributionProfiles(filters?: {
  readonly serviceSector?: ServiceSector;
}): Promise<ReadonlyArray<DistributionRow>> {
  const rows = await prisma.coverageDistributionProfile.findMany({
    where: filters?.serviceSector ? { serviceSector: filters.serviceSector } : {},
    orderBy: [{ isDefault: "desc" }, { slug: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    distribution: r.distribution as Record<string, number>,
    isDefault: r.isDefault,
    serviceSector: r.serviceSector,
    updatedAt: r.updatedAt,
  }));
}

export async function upsertDistributionProfile(input: {
  slug: string;
  name: string;
  description?: string;
  distribution: Record<string, number>;
  isDefault?: boolean;
  serviceSector?: ServiceSector | null;
}): Promise<void> {
  await requireAdmin();
  if (input.slug.length < 2 || input.slug.length > 80) throw new Error("slug_length");
  assertEditorialKeys(input.distribution, "distribution");
  assertSum100(input.distribution, "distribution");
  await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.coverageDistributionProfile.updateMany({
        data: { isDefault: false },
        where: { isDefault: true, NOT: { slug: input.slug } },
      });
    }
    await tx.coverageDistributionProfile.upsert({
      where: { slug: input.slug },
      create: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        distribution: input.distribution as never,
        isDefault: input.isDefault ?? false,
        serviceSector: input.serviceSector ?? null,
      },
      update: {
        name: input.name,
        description: input.description ?? null,
        distribution: input.distribution as never,
        isDefault: input.isDefault ?? false,
        serviceSector: input.serviceSector ?? null,
      },
    });
  });
  revalidatePath(adminPath("coverage-distribution"));
}

export async function deleteDistributionProfile(slug: string): Promise<void> {
  await requireAdmin();
  await prisma.coverageDistributionProfile.delete({ where: { slug } });
  revalidatePath(adminPath("coverage-distribution"));
}

// ────────────────────────────────────────────────────────────────────
// AudienceMixProfile — matrice taille × organisation
// ────────────────────────────────────────────────────────────────────

export interface AudienceMixRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly mix: Record<string, number>;
  readonly isDefault: boolean;
  readonly updatedAt: Date;
}

export async function listAudienceMixProfiles(): Promise<ReadonlyArray<AudienceMixRow>> {
  const rows = await prisma.audienceMixProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { slug: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    mix: r.mix as Record<string, number>,
    isDefault: r.isDefault,
    updatedAt: r.updatedAt,
  }));
}

export async function upsertAudienceMixProfile(input: {
  slug: string;
  name: string;
  description?: string;
  mix: Record<string, number>;
  isDefault?: boolean;
}): Promise<void> {
  await requireAdmin();
  if (input.slug.length < 2 || input.slug.length > 80) throw new Error("slug_length");
  assertSum100(input.mix, "audience_mix");
  await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.audienceMixProfile.updateMany({
        data: { isDefault: false },
        where: { isDefault: true, NOT: { slug: input.slug } },
      });
    }
    await tx.audienceMixProfile.upsert({
      where: { slug: input.slug },
      create: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        mix: input.mix as never,
        isDefault: input.isDefault ?? false,
      },
      update: {
        name: input.name,
        description: input.description ?? null,
        mix: input.mix as never,
        isDefault: input.isDefault ?? false,
      },
    });
  });
  revalidatePath(adminPath("audience-mix"));
}

export async function deleteAudienceMixProfile(slug: string): Promise<void> {
  await requireAdmin();
  await prisma.audienceMixProfile.delete({ where: { slug } });
  revalidatePath(adminPath("audience-mix"));
}
