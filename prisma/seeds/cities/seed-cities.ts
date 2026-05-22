/**
 * Seed villes France ≥ 5000 hab dans la table `cities`.
 *
 * Phase A Sprint Perfection 2026-05-22.
 *
 * Source : prisma/seeds/cities/cities-france-5000plus.json (225 villes pilote,
 * extensible jusqu'à 2100 via INSEE complet).
 *
 * Calculs automatiques :
 *   - `priority` = rang par population décroissante (Paris = 1)
 *   - `populationTier` = 1 (≥100k) | 2 (20k-100k) | 3 (10k-20k) | 4 (5k-10k)
 *   - `hasEconomicData` = true si src/data/villes/economic-data/<slug>.ts existe
 *
 * Idempotent : upsert par `inseeCode`. Run 2× = même résultat.
 *
 * Usage : `pnpm content-gen:seed-cities`
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../../generated/client";
import type { PrismaClient as PrismaClientType } from "../../generated/client";

interface CityRaw {
  slug: string;
  name: string;
  population: number;
  departmentCode: string;
  departmentName: string;
  regionSlug: string;
  regionName: string;
  inseeCode: string;
  latitude: number;
  longitude: number;
}

function getPopulationTier(pop: number): number {
  if (pop >= 100_000) return 1;
  if (pop >= 20_000) return 2;
  if (pop >= 10_000) return 3;
  return 4;
}

function hasEconomicDataFile(slug: string): boolean {
  const filePath = path.resolve(__dirname, "../../../src/data/villes/economic-data", `${slug}.ts`);
  return fs.existsSync(filePath);
}

export async function seedCities(prisma: PrismaClientType): Promise<number> {
  const jsonPath = path.resolve(__dirname, "cities-france-5000plus.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn("[seed-cities] cities-france-5000plus.json introuvable — skip");
    return 0;
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as CityRaw[];

  // Trier par population décroissante pour calculer priority
  const sorted = [...raw].sort((a, b) => b.population - a.population);

  let upserted = 0;

  for (let i = 0; i < sorted.length; i++) {
    const city = sorted[i]!;
    const priority = i + 1;
    const populationTier = getPopulationTier(city.population);
    const hasEconomicData = hasEconomicDataFile(city.slug);

    await prisma.city.upsert({
      where: { inseeCode: city.inseeCode },
      update: {
        slug: city.slug,
        name: city.name,
        population: city.population,
        departmentCode: city.departmentCode,
        departmentName: city.departmentName,
        regionSlug: city.regionSlug,
        regionName: city.regionName,
        latitude: city.latitude,
        longitude: city.longitude,
        populationTier,
        priority,
        hasEconomicData,
      },
      create: {
        slug: city.slug,
        name: city.name,
        population: city.population,
        departmentCode: city.departmentCode,
        departmentName: city.departmentName,
        regionSlug: city.regionSlug,
        regionName: city.regionName,
        inseeCode: city.inseeCode,
        latitude: city.latitude,
        longitude: city.longitude,
        populationTier,
        priority,
        hasEconomicData,
      },
    });

    upserted++;
  }

  return upserted;
}

// CLI standalone
if (require.main === module) {
  const prisma = new PrismaClient();

  seedCities(prisma as unknown as PrismaClientType)
    .then((count) => {
      console.log(`[seed-cities] ${count} villes upserted.`);
    })
    .catch((e: unknown) => {
      console.error("[seed-cities] FAILED:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
