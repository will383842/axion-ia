/**
 * Runner standalone — seede la Salle de presse (communiqués + kit média) depuis
 * les fixtures `src/content/press.ts` vers la DB. Idempotent.
 *
 * Usage local : `pnpm exec tsx prisma/seeds/press/run-seed-press.ts`
 *   (avec DATABASE_URL pointant vers la base cible).
 */

import { PrismaClient } from "../../generated/client";
import { seedPress } from "./seed-press";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { releases, assets } = await seedPress(prisma);
    console.log(`✓ Salle de presse seedée : ${releases} communiqué(s) + ${assets} asset(s) média`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ seed-press échec :", err);
  process.exit(1);
});
