/**
 * Image-bank — Seed Countries depuis REST Countries API (gratuit, no key).
 *
 * Lancer : `pnpm tsx prisma/seeds/image-bank/seed-countries.ts`
 * Idempotent : upsert par isoCode → run 2× = même résultat.
 *
 * Utilisé par `image-country-detector.service.ts` pour résoudre nom de pays
 * (FR ou EN) → ISO code (2 lettres) lors de l'enrichissement geo.
 *
 * Volume attendu : ~249 lignes (états ONU + dépendances reconnues).
 */

import type { PrismaClient } from "@prisma/client";
import { PrismaClient as RealPrismaClient } from "../../generated/client";

type CountryApiRow = {
  cca2: string;
  cca3?: string;
  name: { common: string; official: string };
  translations?: { fra?: { common: string } };
  continents?: string[];
  flag?: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function seedCountries(client: PrismaClient): Promise<number> {
  const res = await fetch(
    "https://restcountries.com/v3.1/all?fields=cca2,cca3,name,translations,continents,flag",
  );
  if (!res.ok) {
    throw new Error(`REST Countries fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as CountryApiRow[];

  let count = 0;
  for (const c of data) {
    if (!c.cca2 || c.cca2.length !== 2) continue;
    const nameFr = c.translations?.fra?.common ?? c.name.common;
    const nameEn = c.name.common;
    await client.country.upsert({
      where: { isoCode: c.cca2.toUpperCase() },
      update: {
        nameFr,
        nameEn,
        iso3: c.cca3 ?? null,
        slugFr: slugify(nameFr),
        slugEn: slugify(nameEn),
        continent: c.continents?.[0] ?? null,
        flagEmoji: c.flag ?? null,
      },
      create: {
        isoCode: c.cca2.toUpperCase(),
        iso3: c.cca3 ?? null,
        nameFr,
        nameEn,
        slugFr: slugify(nameFr),
        slugEn: slugify(nameEn),
        continent: c.continents?.[0] ?? null,
        flagEmoji: c.flag ?? null,
      },
    });
    count++;
  }
  return count;
}

// Standalone execution (pnpm tsx prisma/seeds/image-bank/seed-countries.ts)
if (require.main === module) {
  const prisma = new RealPrismaClient();
  seedCountries(prisma as unknown as PrismaClient)
    .then((count) => {
      console.log(`[image-bank seed] ✓ ${count} countries upserted`);
    })
    .catch((err) => {
      console.error("[image-bank seed] seed-countries failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
