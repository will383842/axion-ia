/**
 * Runner standalone — seede UNIQUEMENT les faits KB des 5 services
 * (audits / interventions-formations / un-a-un / implementations / sites-web)
 * dans la base (KnowledgeEntry + KnowledgeTranslation FR).
 *
 * Pourquoi ce fichier : `seed-kb-facts.ts` n'EXPORTE que `seedKbFacts(prisma)`
 * sans `main()` → l'exécuter directement via tsx ne ferait rien. Ce runner
 * instancie le client Prisma, appelle la fonction, logge le compte, déconnecte.
 *
 * Idempotent : upsert sur le slug unique → ré-exécutable sans risque.
 *
 * Usage local : `pnpm exec tsx prisma/seeds/content-gen/run-seed-kb.ts`
 *   (avec DATABASE_URL pointant vers la base cible)
 * Usage CI    : voir `.github/workflows/seed-kb-manual.yml`
 */

import { PrismaClient } from "../../generated/client";
import { seedKbFacts } from "./seed-kb-facts";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const count = await seedKbFacts(prisma);
    console.log(`✓ KbFacts seedés : ${count} entries (KnowledgeEntry + Translation FR) upsertées`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ seed-kb échec :", err);
  process.exit(1);
});
