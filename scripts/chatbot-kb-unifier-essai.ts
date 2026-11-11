/**
 * ESSAI À BLANC — base unique du chatbot (chantier V3-3, 2026-11-11).
 *
 * Compare, sur 30 questions types, les passages que le chatbot récupère depuis sa
 * copie `chat_kb_chunks` (comportement actuel) et depuis les fiches
 * `knowledge_entries` (ce qu'il lirait avec `CHATBOT_KB_UNIFIED=true`), puis écrit
 * un rapport Markdown sur le disque local.
 *
 * Ne modifie RIEN :
 *   - aucune écriture en base : seuls des SELECT sont émis, et la session Postgres
 *     est ouverte en `default_transaction_read_only=on` sur UNE connexion
 *     (`connection_limit=1`) — une écriture accidentelle serait refusée par Postgres ;
 *   - le mode lecture seule est VÉRIFIÉ (`SHOW`) au début et à la fin, et le script
 *     refuse une URL `pgbouncer=true` (un `SET SESSION` n'y tiendrait pas). La seule
 *     garantie absolue reste un rôle Postgres en lecture seule : à préférer ;
 *   - aucun appel au modèle de langage, aucun cache sémantique ;
 *   - effets de bord ANNONCÉS : sans `--fts-seul`, chaque question est embarquée
 *     par OpenAI (30 appels, coût minime) ; le rapport est écrit sur le disque local ;
 *   - l'interrupteur `CHATBOT_KB_UNIFIED` n'est ni lu ni modifié.
 *
 * Garde-fou : le script REFUSE de démarrer si `NODE_ENV=production` ou si l'hôte de
 * `DATABASE_URL` n'est pas dans la liste autorisée du dépôt (localhost, 127.0.0.1,
 * hôtes se déclarant préproduction ; cf. `prisma/seeds/volumetrie/garde-cible.ts`),
 * sauf option explicite `--autoriser-prod` (décision de Williams).
 *
 * Usage :
 *   pnpm tsx scripts/chatbot-kb-unifier-essai.ts [--fts-seul] [--sortie <fichier.md>]
 *     [--autoriser-prod]
 *
 * ⛔ Ne pas lancer depuis une routine automatique contre la base de production :
 * l'essai est destiné à une base de préproduction ou à un lancement décidé par Williams.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cibleAutorisee } from "../prisma/seeds/volumetrie/garde-cible";

/** Force une connexion unique : le `SET` lecture seule couvre alors toute la session. */
export function urlLectureSeule(url: string): string {
  const u = new URL(url);
  if (u.searchParams.get("pgbouncer") === "true") {
    throw new Error("pgbouncer=true : la session lecture seule ne serait pas garantie.");
  }
  u.searchParams.set("connection_limit", "1");
  return u.toString();
}

export type DecisionDemarrage = { ok: true } | { ok: false; message: string };

/**
 * Fonction PURE : l'essai peut-il démarrer contre cette cible ? Refus par défaut
 * en production ou sur un hôte inconnu, sauf `--autoriser-prod`.
 */
export function decisionDemarrage(
  env: { DATABASE_URL?: string | undefined; NODE_ENV?: string | undefined },
  argv: ReadonlyArray<string>,
): DecisionDemarrage {
  if (argv.includes("--autoriser-prod")) return { ok: true };
  const verdict = cibleAutorisee(env);
  if (verdict.ok) return { ok: true };
  return {
    ok: false,
    message:
      `Essai refusé : ${verdict.message} ` +
      "L'essai est prévu pour une base locale ou de préproduction. Pour viser une autre base " +
      "en connaissance de cause (lecture seule), relancez avec --autoriser-prod.",
  };
}

async function main(): Promise<void> {
  const decision = decisionDemarrage(process.env, process.argv);
  if (!decision.ok) throw new Error(decision.message);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absente : rien à comparer.");
  process.env.DATABASE_URL = urlLectureSeule(url);
  if (process.argv.includes("--fts-seul")) {
    // Sans clé, l'embedding passe en repli « -stub » et hybridSearch en FTS seul.
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
  }

  // Imports APRÈS la réécriture de l'URL : le client Prisma la lit à l'instanciation.
  const { prisma } = await import("@/lib/prisma");
  const { getDefaultTenant } = await import("@/server/chatbot/tenant");
  const { hybridSearch } = await import("@/server/chatbot/retrieval/hybrid-search");
  const { chercherDansKnowledgeEntry } =
    await import("@/server/chatbot/retrieval/knowledge-entry-search");
  const { executerEssaiKbUnifiee, rapportMarkdown } =
    await import("@/server/chatbot/retrieval/essai-kb-unifiee");

  // `SET` de session (aucune donnée écrite) : toute écriture ultérieure échoue.
  const verifierLectureSeule = async (moment: string): Promise<void> => {
    const r = await prisma.$queryRawUnsafe<Array<{ default_transaction_read_only: string }>>(
      "SHOW default_transaction_read_only",
    );
    if (r[0]?.default_transaction_read_only !== "on") {
      throw new Error(`Session non lecture seule (${moment}) : essai interrompu.`);
    }
  };
  try {
    await prisma.$executeRawUnsafe("SET SESSION default_transaction_read_only = on");
    await verifierLectureSeule("début");

    const tenant = await getDefaultTenant();
    if (!tenant) throw new Error("Tenant chatbot par défaut introuvable.");

    const resultats = await executerEssaiKbUnifiee({
      tenantId: tenant.id,
      hybrid: hybridSearch,
      knowledgeEntry: chercherDansKnowledgeEntry,
    });

    const date = new Date().toISOString().slice(0, 10);
    const i = process.argv.indexOf("--sortie");
    const sortie =
      i > -1 && process.argv[i + 1]
        ? process.argv[i + 1]!
        : `_SUIVI/chatbot-kb-unifiee/essai-${date}.md`;
    await mkdir(dirname(sortie), { recursive: true });
    await writeFile(sortie, rapportMarkdown(resultats, date), "utf8");
    await verifierLectureSeule("fin");
    console.log(`[essai kb unifiée] ${resultats.length} questions — rapport : ${sortie}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("chatbot-kb-unifier-essai")) {
  main().catch((err) => {
    console.error("[essai kb unifiée] échec :", err);
    process.exit(1);
  });
}
