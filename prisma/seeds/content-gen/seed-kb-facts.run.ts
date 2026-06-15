/**
 * Runner standalone du seed KB facts.
 *
 * Fix (2026-06-15) : le script `content-gen:seed-kb` pointait sur
 * `seed-kb-facts.ts`, qui n'EXPORTE que `seedKbFacts()` sans jamais l'appeler
 * (il est conçu pour être importé par `index.ts` / `seed.ts`). Lancé seul via
 * `tsx`, il était donc un no-op silencieux. Ce runner dédié instancie Prisma et
 * exécute réellement le seed — sans re-seeder le reste (providers, mots-clés,
 * templates) comme le ferait `content-gen:seed` / `db:seed`.
 *
 * Usage : `pnpm content-gen:seed-kb`
 *         ou `node_modules/.bin/tsx prisma/seeds/content-gen/seed-kb-facts.run.ts`
 *
 * Idempotent (upsert). Crée les embeddings vectoriels si `VOYAGE_API_KEY` est
 * présente ; sinon insère les faits sans vecteurs (le RAG reste en FTS lexical).
 */
import { PrismaClient } from "../../generated/client";
import { seedKbFacts } from "./seed-kb-facts";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const count = await seedKbFacts(prisma);
  console.log(`[seed-kb-facts] ✅ Terminé — ${count} faits KB upserted.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed-kb-facts] FATAL", err);
  void prisma.$disconnect();
  process.exit(1);
});
