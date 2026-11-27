/**
 * Import du pack « Journée IA » (25/11/2026, remplace celui du 10/11) dans la base de connaissance.
 *
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts                 # dry-run (défaut, sans base)
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts --avec-base     # dry-run + liste des fiches qui seraient mises à jour (lecture seule)
 *   pnpm tsx scripts/import-knowledge-pack-journee-ia.ts --commit        # écrit, uniquement des brouillons
 *
 * - dry-run par défaut : n'écrit aucune base ; sans --avec-base il ne la lit pas non plus
 *   (toute fiche dont le slug existe déjà serait alors mise à jour) ;
 * - --commit : CRÉE les fiches absentes et MET À JOUR celles dont le slug existe déjà
 *   (clé = slug stable `pack-journee-ia-<id>` : le pack du 25/11 remplace celui du 10/11,
 *   contenu, titre et métadonnées) ; le rapport distingue créations et mises à jour ;
 *   rien n'est jamais supprimé (aucun DROP/DELETE) ;
 * - garde-fou : --commit est refusé si NODE_ENV=production ou si DATABASE_URL ne vise pas
 *   localhost, sauf --confirmer-prod (accord de Williams) ; l'hôte visé est affiché avant d'écrire ;
 * - toutes les fiches sont en brouillon interne, jamais publiées ;
 * - fichier par défaut : le pack final du 25/11/2026 (53 fiches, décisions du dirigeant appliquées) ;
 *   l'ancien pack du 10/11/2026 reste lisible par `--fichier=docs/knowledge/pack-journee-ia-2026-11-10/Base_RAG.jsonl`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analyserPack,
  evaluerGardeCommit,
  importerBrouillons,
  lignesDepuisJsonl,
  planifierImport,
  type ClientImport,
} from "../src/lib/knowledge/pack-journee-ia";

function argument(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
}

async function main() {
  const commit = process.argv.includes("--commit");
  const fichier =
    argument("fichier") ??
    join("docs", "knowledge", "pack-journee-ia-2026-11-25", "Base_RAG.jsonl");
  const rapport = analyserPack(lignesDepuisJsonl(readFileSync(fichier, "utf-8")));

  const resume = {
    mode: commit ? "COMMIT" : "DRY-RUN",
    fichier,
    lignes: rapport.total,
    parType: rapport.parType,
    aImporterEnBrouillon: rapport.aImporter.length,
    rejets: rapport.rejets,
    horsRag: rapport.horsRag,
    chatbotAutorise: rapport.aImporter.filter((f) => f.chatbotAutorise).map((f) => f.entry.slug),
    contradictionsEcartees: rapport.contradictions,
    quasiDoublons: rapport.quasiDoublons,
    parStatut: { draft: rapport.aImporter.length, published: 0 },
  };

  const avecBase = process.argv.includes("--avec-base");
  if (!commit && !avecBase) {
    console.warn(
      JSON.stringify(
        {
          ...resume,
          miseAJour:
            "base non consultée : toute fiche dont le slug existe déjà serait MISE À JOUR (relancer avec --avec-base pour la liste)",
        },
        null,
        2,
      ),
    );
    return;
  }

  const garde = evaluerGardeCommit({
    commit: true,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    confirmerProd: process.argv.includes("--confirmer-prod"),
  });
  console.warn(`[kb-import:pack-journee-ia] base visée : ${garde.hote ?? "inconnue"}`);
  if (!garde.autorise) {
    console.error(`[kb-import:pack-journee-ia] REFUSÉ : ${garde.raison ?? "garde-fou"}`);
    process.exit(2);
  }

  const { PrismaClient, Prisma } = await import("../prisma/generated/client");
  const prisma = new PrismaClient();
  try {
    const client = prisma as unknown as ClientImport;
    if (!commit) {
      const plan = await planifierImport(client, rapport.aImporter);
      console.warn(
        JSON.stringify(
          {
            ...resume,
            aCreer: plan.aCreer.length,
            aMettreAJour: plan.aMettreAJour,
            ignoreesNonBrouillon: plan.ignorees,
          },
          null,
          2,
        ),
      );
      return;
    }
    const bilan = await importerBrouillons(client, rapport.aImporter, Prisma.DbNull);
    console.warn(JSON.stringify({ ...resume, ...bilan }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[kb-import:pack-journee-ia] FATAL", err);
  process.exit(1);
});
