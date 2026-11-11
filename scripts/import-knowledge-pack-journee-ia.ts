/**
 * Import du pack « Journée IA » (10/11/2026) dans la base de connaissance.
 *
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts            # dry-run (défaut, sans base)
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts --commit   # écrit, uniquement des brouillons
 *
 * - dry-run par défaut : ne lit ni n'écrit aucune base ;
 * - --commit : crée seulement les fiches ABSENTES (clé = slug stable `pack-journee-ia-<id>`),
 *   ne met jamais à jour ni ne supprime une fiche existante (aucun DROP/DELETE) ;
 * - garde-fou : --commit est refusé si NODE_ENV=production ou si DATABASE_URL ne vise pas
 *   localhost, sauf --confirmer-prod (accord de Williams) ; l'hôte visé est affiché avant d'écrire ;
 * - toutes les fiches sont en brouillon interne, jamais publiées.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analyserPack,
  evaluerGardeCommit,
  importerBrouillons,
  lignesDepuisJsonl,
  type ClientImport,
} from "../src/lib/knowledge/pack-journee-ia";

function argument(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
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

  const garde = evaluerGardeCommit({
    commit,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    confirmerProd: process.argv.includes("--confirmer-prod"),
  });
  console.warn(`[kb-import:pack-journee-ia] base visée : ${garde.hote ?? "inconnue"}`);
  if (!garde.autorise) {
    console.error(`[kb-import:pack-journee-ia] REFUSÉ : ${garde.raison ?? "garde-fou"}`);
    process.exit(2);
  }

  const { PrismaClient } = await import("../prisma/generated/client");
  const prisma = new PrismaClient();
  try {
    const bilan = await importerBrouillons(prisma as unknown as ClientImport, rapport.aImporter);
    console.warn(JSON.stringify({ ...resume, ...bilan }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[kb-import:pack-journee-ia] FATAL", err);
  process.exit(1);
});
