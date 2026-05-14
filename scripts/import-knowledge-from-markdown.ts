/**
 * Sprint KB-15 V4 — Import Markdown → KnowledgeEntry (audit_md / markdown_git).
 *
 * Scanne récursivement un dossier de fichiers `*.md` et les transforme en
 * KnowledgeEntry/Translation idempotents (skip si slug déjà existant).
 *
 * Front-matter attendu (tous optionnels sauf `title`) :
 * ```
 * ---
 * title: Mon article
 * slug: mon-article            # default = slugify(title)
 * type: article                # default = "article" (KbType valide)
 * domain: ia_strategy          # default = "ia_strategy" (KbDomain valide)
 * audience: public             # default = "public"
 * confidentiality: public      # default = "public"
 * excerpt: Résumé court
 * tags: ia,strategie           # CSV
 * ---
 * ```
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-markdown.ts --source=_AUDIT --dry-run
 *   pnpm tsx scripts/import-knowledge-from-markdown.ts --source=docs/kb --commit
 *   pnpm tsx scripts/import-knowledge-from-markdown.ts --source=_AUDIT --type=howto --commit
 *
 * Sécurité :
 *  - Dry-run par défaut, --commit explicite obligatoire pour écrire.
 *  - Crée 1 `KnowledgeImportBatch` par run (status=processing → completed/failed).
 *  - Pipeline gates : banned-words + alt-text + heuristic (mêmes que ingest API).
 *  - Source tracking : sourceFactoryId="markdown-import", sourcePromptId=fichier path.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  parseFrontMatter,
  markdownToHtml,
  markdownToPlainText,
} from "../src/lib/knowledge/markdown-import";
import { checkTranslationBannedWords } from "../src/lib/knowledge/banned-words";
import { runHeuristicGates } from "../src/lib/knowledge/quality-gates";
import { validateAltText } from "../src/lib/knowledge/alt-text-validation";
import { PrismaClient } from "../prisma/generated/client";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbType,
  KbImportSource,
} from "../prisma/generated/client";
import { KB_TYPES } from "../src/content/knowledge/types";
import { KB_DOMAINS } from "../src/content/knowledge/domains";
import { KB_AUDIENCES } from "../src/content/knowledge/audiences";
import { KB_CONFIDENTIALITIES } from "../src/content/knowledge/confidentialities";

const prisma = new PrismaClient();

interface RunOptions {
  source: string;
  defaultType: KbType;
  defaultDomain: KbDomain;
  dryRun: boolean;
  importSource: KbImportSource;
}

interface FileReport {
  file: string;
  slug: string | null;
  status: "would-create" | "created" | "skipped-exists" | "rejected" | "error";
  reason?: string;
  entryId?: string;
}

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listMarkdownFiles(full));
    } else if (name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);
}

async function importFile(file: string, opts: RunOptions): Promise<FileReport> {
  const raw = readFileSync(file, "utf8");
  const { frontMatter, body } = parseFrontMatter(raw);

  const title = (frontMatter.title ?? path.basename(file, ".md")).trim();
  if (title.length < 10) {
    return { file, slug: null, status: "rejected", reason: "title-too-short (<10)" };
  }

  const slug = slugify(frontMatter.slug ?? title);
  const type = (frontMatter.type as KbType) ?? opts.defaultType;
  if (!(KB_TYPES as readonly string[]).includes(type)) {
    return { file, slug, status: "rejected", reason: `invalid-type=${frontMatter.type}` };
  }
  const domain = (frontMatter.domain as KbDomain) ?? opts.defaultDomain;
  if (!(KB_DOMAINS as readonly string[]).includes(domain)) {
    return { file, slug, status: "rejected", reason: `invalid-domain=${frontMatter.domain}` };
  }
  const audience = (frontMatter.audience as KbAudience | undefined) ?? ("public" as KbAudience);
  if (!(KB_AUDIENCES as readonly string[]).includes(audience)) {
    return { file, slug, status: "rejected", reason: `invalid-audience=${audience}` };
  }
  const confidentiality =
    (frontMatter.confidentiality as KbConfidentiality | undefined) ??
    ("public" as KbConfidentiality);
  if (!(KB_CONFIDENTIALITIES as readonly string[]).includes(confidentiality)) {
    return { file, slug, status: "rejected", reason: `invalid-confidentiality=${confidentiality}` };
  }

  const excerpt = frontMatter.excerpt ?? null;
  const html = markdownToHtml(body);
  const bodyText = markdownToPlainText(body);
  const tags = frontMatter.tags
    ? frontMatter.tags
        .split(",")
        .map((t) => slugify(t.trim()))
        .filter((t) => t.length >= 2)
    : [];

  // Gate 1 : banned words
  const banned = checkTranslationBannedWords({
    title,
    excerpt,
    body: html,
    bodyText,
  });
  if (!banned.valid) {
    return {
      file,
      slug,
      status: "rejected",
      reason: `banned: ${banned.fieldViolations.map((v) => v.field).join(",")}`,
    };
  }

  // Gate 2 : alt text
  const alt = validateAltText(html);
  if (!alt.valid) {
    return {
      file,
      slug,
      status: "rejected",
      reason: `alt-text ${alt.imagesWithoutAlt}/${alt.totalImages}`,
    };
  }

  // Gate 3 : heuristic quality
  const heur = runHeuristicGates({ type, title, body: html, bodyText });
  if (!heur.valid) {
    return { file, slug, status: "rejected", reason: heur.violations[0]?.gate ?? "heuristic" };
  }

  if (opts.dryRun) {
    return { file, slug, status: "would-create" };
  }

  const existing = await prisma.knowledgeEntry.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    return { file, slug, status: "skipped-exists", entryId: existing.id };
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      type,
      domain,
      audience,
      confidentiality,
      status: "draft", // ne PAS auto-publier les imports MD V1
      pipelineStage: "draft",
      slug,
      sourceFactoryId: "markdown-import",
      sourcePromptId: file,
      sourceModelUsed: "manual",
      sourceCostCents: 0,
      sourceGeneratedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.knowledgeTranslation.create({
    data: {
      entryId: entry.id,
      locale: "fr",
      title,
      slug,
      excerpt,
      body: html,
      bodyText,
    },
  });

  if (tags.length > 0) {
    for (const t of tags) {
      const tag = await prisma.knowledgeTag.upsert({
        where: { slug: t },
        create: { slug: t, nameFr: t, nameEn: t },
        update: {},
      });
      await prisma.knowledgeTagOnEntry.create({
        data: { entryId: entry.id, tagId: tag.id },
      });
    }
  }

  return { file, slug, status: "created", entryId: entry.id };
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  let source = "_AUDIT";
  let defaultType: KbType = "article" as KbType;
  let defaultDomain: KbDomain = "ia_strategy" as KbDomain;
  let dryRun = true;
  let importSource: KbImportSource = "audit_md" as KbImportSource;

  for (const a of args) {
    if (a.startsWith("--source=")) source = a.slice("--source=".length);
    else if (a.startsWith("--type=")) defaultType = a.slice("--type=".length) as KbType;
    else if (a.startsWith("--domain=")) defaultDomain = a.slice("--domain=".length) as KbDomain;
    else if (a === "--commit") dryRun = false;
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--kind=")) {
      importSource = a.slice("--kind=".length) as KbImportSource;
    }
  }

  // Auto-detect import kind si non précisé
  if (!source.startsWith("_AUDIT")) {
    importSource = "markdown_git" as KbImportSource;
  }

  return { source, defaultType, defaultDomain, dryRun, importSource };
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log(
    `[kb-import-md] source=${opts.source} type=${opts.defaultType} dry-run=${opts.dryRun}`,
  );

  const files = listMarkdownFiles(opts.source);
  console.log(`[kb-import-md] ${files.length} fichiers .md trouvés`);

  // Audit batch
  const batch = !opts.dryRun
    ? await prisma.knowledgeImportBatch.create({
        data: {
          source: opts.importSource,
          sourceRef: opts.source,
          entriesCount: 0,
          status: "running",
        },
        select: { id: true },
      })
    : null;

  const reports: FileReport[] = [];
  let createdCount = 0;
  for (const file of files) {
    try {
      const r = await importFile(file, opts);
      reports.push(r);
      if (r.status === "created") createdCount += 1;
      const tag = r.status.padEnd(15);
      console.log(`  [${tag}] ${file} ${r.reason ? `→ ${r.reason}` : ""}`);
    } catch (err) {
      reports.push({
        file,
        slug: null,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
      console.error(`  [error]          ${file}`, err);
    }
  }

  if (batch) {
    const rejectedCount = reports.filter((r) => r.status === "rejected").length;
    const errorCount = reports.filter((r) => r.status === "error").length;
    await prisma.knowledgeImportBatch.update({
      where: { id: batch.id },
      data: {
        entriesCount: createdCount,
        status: "succeeded",
        completedAt: new Date(),
        ...(rejectedCount + errorCount > 0
          ? { errorLog: { rejected: rejectedCount, errors: errorCount } }
          : {}),
      },
    });
  }

  const summary = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[kb-import-md] récap : ${JSON.stringify(summary)}`);
  console.log(
    `[kb-import-md] ${opts.dryRun ? "DRY-RUN — aucune écriture DB." : "COMMIT — DB écrite."}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
