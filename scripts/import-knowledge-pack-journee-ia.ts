/**
 * Import du pack « Journée IA » (10/11/2026) dans la base de connaissance.
 *
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts            # dry-run (défaut, sans base)
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts --commit   # écrit, uniquement des brouillons
 *
 * - dry-run par défaut : ne lit ni n'écrit aucune base ;
 * - --commit : crée seulement les fiches ABSENTES (clé = slug stable `pack-journee-ia-<id>`),
 *   ne met jamais à jour ni ne supprime une fiche existante (aucun DROP/DELETE) ;
 * - toutes les fiches sont en brouillon interne, jamais publiées.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyserPack, lignesDepuisJsonl } from "../src/lib/knowledge/pack-journee-ia";

function argument(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];
}

async function main() {
  const commit = process.argv.includes("--commit");
  const fichier =
    argument("fichier") ??
    join("docs", "knowledge", "pack-journee-ia-2026-11-10", "Base_RAG.jsonl");
  const rapport = analyserPack(lignesDepuisJsonl(readFileSync(fichier, "utf-8")));

  const resume = {
    mode: commit ? "COMMIT" : "DRY-RUN",
    fichier,
    lignes: rapport.total,
    parType: rapport.parType,
    aImporterEnBrouillon: rapport.aImporter.length,
    rejets: rapport.rejets,
    horsRag: rapport.horsRag,
    contradictionsEcartees: rapport.contradictions,
    quasiDoublons: rapport.quasiDoublons,
    parStatut: { draft: rapport.aImporter.length, published: 0 },
  };

  if (!commit) {
    console.warn(JSON.stringify(resume, null, 2));
    return;
  }

  const { PrismaClient } = await import("../prisma/generated/client");
  const prisma = new PrismaClient();
  let crees = 0;
  let existants = 0;
  try {
    for (const f of rapport.aImporter) {
      const deja = await prisma.knowledgeEntry.findUnique({
        where: { slug: f.entry.slug },
        select: { id: true },
      });
      if (deja) {
        existants++;
        continue;
      }
      await prisma.knowledgeEntry.create({
        data: { ...f.entry, translations: { create: [f.translation] } },
        select: { id: true },
      });
      crees++;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.warn(JSON.stringify({ ...resume, crees, dejaPresents: existants }, null, 2));
}

main().catch((err) => {
  console.error("[kb-import:pack-journee-ia] FATAL", err);
  process.exit(1);
});
