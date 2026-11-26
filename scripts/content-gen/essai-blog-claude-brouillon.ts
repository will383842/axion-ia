#!/usr/bin/env tsx
/**
 * Article de blog d'ESSAI, écrit par Claude, gardé en BROUILLON — jamais publié.
 *
 * Accord explicite du dirigeant (26/11/2026) : UN article, pour qu'il le lise.
 * Les voies normales passent par la file BullMQ `content-gen` (le worker publie seul
 * dès que le score est ≥ 75). Ce script n'en emprunte AUCUNE : un seul processus,
 * le générateur `blog_from_title` appelé directement.
 *
 * Ce que le script fait :
 *  1. refuse sans `CONTENT_GEN_BLOG_CLAUDE=true` (posé pour CE processus seulement,
 *     `docker exec -e`), sans titre, ou si l'estimation du pire cas dépasse 3 $ ;
 *  2. crée un `ContentGenJob` de type `blog_from_title`, DÉJÀ au statut `cancelled`
 *     avec `retryCount` au maximum : aucun balayage ne reprend un `cancelled`
 *     (la reprise automatique ne lit que `failed`, le délai de grâce que `queued`, l'approbation
 *     groupée que `needs_review`, la publication que `approved`) ;
 *  3. appelle `generate()` : le texte passe par Claude (plafonds en base respectés) ;
 *  4. écrit le résultat dans `outputJsonRaw` SANS toucher au statut ;
 *  5. écrit le HTML dans /tmp/essai-<jobId>.html (aucune page de la console n'affiche
 *     `outputJsonRaw` d'un job `cancelled`, la route d'aperçu exige un jeton signé).
 *
 * Garde-fous contre le rejeu : `requeueContentGenJob`, `retryJob` et le worker refusent tout job
 * marqué essai (`essai-claude.ts`) ; « Rejouer » ne peut donc pas le faire publier.
 *
 * Ce que le script NE fait JAMAIS : file BullMQ, ReviewQueue, statut publiable,
 * Article, revalidatePath, IndexNow, sitemap, e-mail, Telegram (hors alertes de plafond
 * existantes, émises par le chemin Claude lui-même).
 *
 * Usage (conteneur de l'app) :
 *   docker exec -w /app -e CONTENT_GEN_BLOG_CLAUDE=true <conteneur> node /tmp/essai.mjs "<titre>"
 */

import { writeFileSync } from "node:fs";

import { prisma } from "@/lib/prisma";
import { blogFromTitleGenerator } from "@/server/content-gen/generators/blog-from-title";
import { computeCost } from "@/server/content-gen/providers/anthropic";
import { interrupteurBlogClaude, MODELES } from "@/server/content-gen/providers/blog-claude";
import { typeClaudeAutorise } from "@/server/content-gen/providers/types-claude";
import type { GeneratorBaseInput, GeneratorOutput } from "@/server/content-gen/generators/types";

import { PREFIXE_CLE_ESSAI } from "@/server/content-gen/essai-claude";

export const PREFIXE_CLE = PREFIXE_CLE_ESSAI;
export const PLAFOND_ESTIMATION_USD = 3;
/** Statut final : aucun lecteur ne le reprend, l'approuve, le publie ni ne le supprime. */
export const STATUT_FINAL = "cancelled" as const;
export const RETRY_MAXIMUM = 99;
export const MARQUEUR_ERREUR = "essai-claude : brouillon manuel, ne jamais reprendre ni publier";

export class ErreurEssai extends Error {}

/**
 * Pire cas du générateur : 2 plans (2 600 tokens de sortie) + 2 itérations × 2 tranches
 * × 2 essais (relance d'une tranche par `expandOutlineChunked`) = 8 expansions de
 * 5 000 tokens de sortie, entrées larges. Le plafond PAR JOB (`plafondJobUsd`, lu par
 * `reserverCout`) est ce qui arrête réellement la dépense à 3 $. Sert de garde,
 * pas de prévision : le coût réel typique est de l'ordre de 0,15 $.
 */
export function estimerCoutMaxUsd(): number {
  const modele = MODELES.ecriture;
  const plans = 2 * computeCost(modele, 0, 2600, 0, 12_000);
  const expansions = 8 * computeCost(modele, 0, 5000, 0, 15_000);
  return plans + expansions;
}

export interface DepsEssai {
  readonly creerJob: (data: { idempotencyKey: string; titre: string }) => Promise<string>;
  readonly generer: (input: GeneratorBaseInput) => Promise<GeneratorOutput>;
  readonly enregistrer: (jobId: string, sortie: unknown, coutUsd: number) => Promise<void>;
  readonly marquerEchec: (jobId: string, message: string) => Promise<void>;
  readonly coutReel: (jobId: string) => Promise<number>;
  readonly ecrireFichier: (chemin: string, contenu: string) => void;
}

export interface ResultatEssai {
  readonly jobId: string;
  readonly coutReelUsd: number;
  readonly mots: number;
  readonly fichierHtml: string;
}

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlLecture(s: GeneratorOutput): string {
  const faq = s.faq
    .map((f) => `<h3>${echapper(f.question)}</h3><p>${echapper(f.answer)}</p>`)
    .join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="robots" content="noindex,nofollow"><title>ESSAI — ${echapper(s.title)}</title>
<style>body{font-family:Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.6}
.bandeau{background:#fdecc8;padding:.6rem 1rem;border-radius:6px;font:14px sans-serif}</style></head><body>
<p class="bandeau">BROUILLON D'ESSAI — non publié, non indexé. ${s.wordCount} mots · score ${s.qualityScore}/100.</p>
<h1>${echapper(s.title)}</h1><p><em>${echapper(s.metaDescription)}</em></p>
<p><strong>${echapper(s.directAnswer)}</strong></p>
${s.bodyHtml}
<h2>Questions fréquentes</h2>
${faq}
</body></html>`;
}

export async function lancerEssai(
  titreBrut: string | undefined,
  deps: DepsEssai,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultatEssai> {
  if (env["CONTENT_GEN_BLOG_CLAUDE"] !== "true") {
    throw new ErreurEssai(
      "CONTENT_GEN_BLOG_CLAUDE doit valoir exactement « true » (docker exec -e)",
    );
  }
  const titre = (titreBrut ?? "").trim();
  if (titre.length < 10 || titre.length > 140) {
    throw new ErreurEssai("un titre de 10 à 140 caractères est obligatoire (argument 1)");
  }
  if (!interrupteurBlogClaude() || !typeClaudeAutorise("blog_from_title")) {
    // Sans cela le routeur écrirait via OpenAI en silence : on refuse plutôt.
    throw new ErreurEssai(
      "blog_from_title n'est pas autorisé via Claude (CONTENT_GEN_CLAUDE_TYPES)",
    );
  }
  const estimation = estimerCoutMaxUsd();
  if (!(estimation <= PLAFOND_ESTIMATION_USD)) {
    throw new ErreurEssai(
      `estimation du pire cas ${estimation.toFixed(2)} $ > ${PLAFOND_ESTIMATION_USD} $ : refus`,
    );
  }

  const cle = `${PREFIXE_CLE}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const jobId = await deps.creerJob({ idempotencyKey: cle, titre });
  console.log(
    `Job créé : ${jobId} (statut ${STATUT_FINAL}, jamais repris). Estimation max ${estimation.toFixed(2)} $.`,
  );

  let sortie: GeneratorOutput;
  try {
    sortie = await deps.generer({
      jobId,
      contentType: "blog_from_title",
      targetSearchIntent: "informational",
      primaryKeyword: titre,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.replace(/\b\w+:\/\/\S+/g, "[url masquée]") : "erreur";
    await deps.marquerEchec(jobId, `${MARQUEUR_ERREUR} — échec : ${message}`.slice(0, 500));
    throw new ErreurEssai(
      `génération échouée : ${message} (job ${jobId}, coût réel : voir cost_ledger)`,
    );
  }

  // Le fichier d'abord : l'article est payé, une panne de base ne doit pas le perdre.
  const fichierHtml = `/tmp/essai-${jobId}.html`;
  deps.ecrireFichier(fichierHtml, htmlLecture(sortie));
  await deps.enregistrer(jobId, sortie, sortie.totalCostUsd);
  const coutReelUsd = await deps.coutReel(jobId);
  return { jobId, coutReelUsd, mots: sortie.wordCount, fichierHtml };
}

export const depsReelles: DepsEssai = {
  async creerJob({ idempotencyKey, titre }) {
    const job = await prisma.contentGenJob.create({
      data: {
        idempotencyKey,
        contentType: "blog_from_title",
        status: STATUT_FINAL,
        retryCount: RETRY_MAXIMUM,
        errorMessage: MARQUEUR_ERREUR,
        primaryProvider: "anthropic",
        inputPayload: {
          primaryKeyword: titre,
          essaiClaude: true,
          plafondJobUsd: PLAFOND_ESTIMATION_USD,
        },
        createdBy: "script:essai-claude",
      },
      select: { id: true },
    });
    return job.id;
  },
  generer: (input) => blogFromTitleGenerator.generate(input),
  async enregistrer(jobId, sortie, coutUsd) {
    // Le statut n'est volontairement PAS dans `data` : il reste `cancelled`.
    await prisma.contentGenJob.update({
      where: { id: jobId },
      data: {
        outputJsonRaw: JSON.parse(JSON.stringify(sortie)) as never,
        modelUsed: MODELES.ecriture,
        costUsd: coutUsd,
      },
    });
  },
  async marquerEchec(jobId, message) {
    await prisma.contentGenJob
      .update({ where: { id: jobId }, data: { errorMessage: message } })
      .catch(() => undefined);
  },
  async coutReel(jobId) {
    const r = await prisma.costLedger.aggregate({ where: { jobId }, _sum: { costUsd: true } });
    return Number(r._sum.costUsd ?? 0);
  },
  ecrireFichier: (chemin, contenu) => writeFileSync(chemin, contenu, "utf8"),
};

async function principal(): Promise<void> {
  const r = await lancerEssai(process.argv[2], depsReelles);
  console.log(`jobId       : ${r.jobId}`);
  console.log(
    `coût compté  : ${r.coutReelUsd.toFixed(4)} $ (cost_ledger, réservations comprises : ≥ coût réel)`,
  );
  console.log(`mots        : ${r.mots}`);
  console.log(
    `lecture     : ${r.fichierHtml} (à copier : docker cp <conteneur>:${r.fichierHtml} .)`,
  );
  console.log(
    `JSON brut   : ContentGenJob.outputJsonRaw du job ${r.jobId} (aucune page admin ne l'affiche pour un job cancelled)`,
  );
}

if (process.argv[1] && /essai(-blog-claude-brouillon)?\.[cm]?[tj]s$/.test(process.argv[1])) {
  principal()
    .then(() => new Promise((r) => setTimeout(r, 3000))) // laisse finir une alerte de plafond
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(
        err instanceof ErreurEssai
          ? `Refus : ${err.message}`
          : `Échec : ${err instanceof Error ? err.message.replace(/\b\w+:\/\/\S+/g, "[url masquée]") : "erreur inconnue"}`,
      );
      process.exit(1);
    });
}
