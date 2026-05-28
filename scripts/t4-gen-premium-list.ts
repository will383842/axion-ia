/**
 * t4-gen-premium-list.ts — Audit Will 2026-05-28 (phasing indexation).
 *
 * Scanne `src/content/villes/copy/*.ts` pour les fichiers portant le header
 * `MANUAL-REWRITE` (= villes réécrites en premium par les sprints audit Will)
 * et génère `src/content/villes/premium-rewrite-slugs.ts`.
 *
 * Ce set sert de critère d'indexation : une ville < 20k habitants n'est
 * indexable (sitemap + index:true) que si elle est premium. Stratégie de
 * phasing anti « scaled content abuse » sur domaine jeune (décision Will
 * 2026-05-28). On lève l'indexation par vagues à mesure des batches premium.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");
const OUTPUT = path.join(process.cwd(), "src", "content", "villes", "premium-rewrite-slugs.ts");

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts", "premium-rewrite-slugs.ts"].includes(
        f,
      ),
  );

  const premium: string[] = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(COPY_DIR, file), "utf-8");
    if (/MANUAL-REWRITE/.test(content)) {
      premium.push(file.replace(/\.ts$/, ""));
    }
  }
  premium.sort();

  const body = `// AUTO-GENERATED par scripts/t4-gen-premium-list.ts — NE PAS ÉDITER À LA MAIN.
// Liste des villes réécrites en premium (header MANUAL-REWRITE) par les sprints
// audit Will. Sert de critère d'indexation pour le phasing anti scaled-content
// abuse (décision Will 2026-05-28) : une ville < 20k hab n'est indexable que
// si elle figure ici. Régénérer après chaque batch premium :
//   pnpm tsx scripts/t4-gen-premium-list.ts

export const PREMIUM_REWRITE_SLUGS: ReadonlySet<string> = new Set([
${premium.map((s) => `  "${s}",`).join("\n")}
]);

export function isPremiumRewrite(slug: string): boolean {
  return PREMIUM_REWRITE_SLUGS.has(slug);
}
`;

  await fs.writeFile(OUTPUT, body, "utf-8");
  console.log(`[gen-premium-list] ${premium.length} villes premium → ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
