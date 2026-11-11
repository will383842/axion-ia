/**
 * Couche « Méthode » — IMPORT des fiches Markdown dans la base (ADR 0076).
 *
 * Usage :
 *   pnpm tsx scripts/methode/importer-methode.ts <dossier methode/>            # ESSAI À BLANC
 *   pnpm tsx scripts/methode/importer-methode.ts <dossier methode/> --ecrire   # écriture
 *
 * Le dossier est la copie `methode/` du dépôt de marque (`livres/**`,
 * `secteurs/sante/**`). Le Drive reste la source d'origine : ce script ne la
 * touche pas, il lit une copie texte.
 *
 * Garanties :
 *   - ESSAI À BLANC par défaut : aucun client Prisma n'est même construit ;
 *   - idempotent sur le slug `methode/<fichier>/<section>` : créé s'il manque,
 *     mis à jour s'il a changé, laissé tel quel sinon ;
 *   - JAMAIS de suppression (une section disparue de la source reste en base) ;
 *   - JAMAIS de publication : statut `approved`, audience `team`,
 *     confidentialité `internal`, `publishedAt` nul ;
 *   - une entrée de même slug qui ne vient pas de cet import n'est pas touchée.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  decouperFichier,
  fichierIgnore,
  SLUG_NOYAU,
  type SectionMethode,
} from "../../src/server/methode/decoupage";
import { markdownToHtml } from "../../src/lib/knowledge/markdown-import";
import type { PrismaClient } from "../../prisma/generated/client";

export const SOURCE_IMPORT = "methode-import";

export const COLLECTIONS: Readonly<
  Record<string, { readonly titreFr: string; readonly descriptionFr: string }>
> = {
  [COLLECTION_VENTE]: {
    titreFr: "Méthode · vente",
    descriptionFr:
      "Fiches de vente internes (livres appliqués à Axion-IA, closing, audit, persuasion). " +
      "Équipe seulement, jamais publiées. Montants = exercices, pas des prix publics.",
  },
  [COLLECTION_SANTE]: {
    titreFr: "Méthode · secteur santé",
    descriptionFr:
      "Dossier santé privée, à part : servi seulement quand on s'adresse au secteur de la santé.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Lecture du dossier (sans base)
// ─────────────────────────────────────────────────────────────────────────────

function listerMarkdown(dossier: string): string[] {
  return readdirSync(dossier)
    .sort()
    .flatMap((nom) => {
      const p = path.join(dossier, nom);
      return statSync(p).isDirectory() ? listerMarkdown(p) : [p];
    });
}

/** Toutes les sections du dossier, dans un ordre stable. Pur à part la lecture. */
export function planifierImport(racine: string): SectionMethode[] {
  const sections: SectionMethode[] = [];
  for (const fichier of listerMarkdown(racine)) {
    const rel = path.relative(racine, fichier).split(path.sep).join("/");
    if (fichierIgnore(rel)) continue;
    sections.push(...decouperFichier(rel, readFileSync(fichier, "utf8")));
  }
  const vus = new Set<string>();
  for (const s of sections) {
    if (vus.has(s.slug)) throw new Error(`Slug en double : ${s.slug}`);
    vus.add(s.slug);
  }
  return sections;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Écriture (seulement avec --ecrire)
// ─────────────────────────────────────────────────────────────────────────────

export interface BilanImport {
  crees: number;
  misAJour: number;
  inchanges: number;
  ignores: string[];
}

function extrait(texte: string): string {
  const sans = texte
    .replace(/^> .*\n\n/, "")
    .replace(/\s+/g, " ")
    .trim();
  return sans.length <= 280 ? sans : `${sans.slice(0, 277).trimEnd()}…`;
}

async function assurerEtiquette(prisma: PrismaClient, slug: string): Promise<string> {
  const tag = await prisma.knowledgeTag.upsert({
    where: { slug },
    create: { slug, nameFr: slug, nameEn: slug },
    update: {},
    select: { id: true },
  });
  return tag.id;
}

async function assurerCollection(prisma: PrismaClient, slug: string): Promise<string> {
  const def = COLLECTIONS[slug]!;
  const col = await prisma.knowledgeCollection.upsert({
    where: { slug },
    // `visibility: team`, `publishedAt` nul : jamais listée côté public.
    create: { slug, titleFr: def.titreFr, descriptionFr: def.descriptionFr, visibility: "team" },
    update: {},
    select: { id: true },
  });
  return col.id;
}

async function rattacher(
  prisma: PrismaClient,
  collectionId: string,
  entryId: string,
): Promise<void> {
  const deja = await prisma.knowledgeCollectionItem.findUnique({
    where: { collectionId_entryId: { collectionId, entryId } },
    select: { entryId: true },
  });
  if (deja) return;
  const dernier = await prisma.knowledgeCollectionItem.aggregate({
    where: { collectionId },
    _max: { position: true },
  });
  await prisma.knowledgeCollectionItem.create({
    data: { collectionId, entryId, position: (dernier._max.position ?? -1) + 1 },
  });
}

export async function ecrireSections(
  prisma: PrismaClient,
  sections: readonly SectionMethode[],
): Promise<BilanImport> {
  const bilan: BilanImport = { crees: 0, misAJour: 0, inchanges: 0, ignores: [] };
  const collections = new Map<string, string>();
  const etiquettes = new Map<string, string>();

  for (const s of sections) {
    if (!collections.has(s.collection)) {
      collections.set(s.collection, await assurerCollection(prisma, s.collection));
    }
    for (const e of s.etiquettes) {
      if (!etiquettes.has(e)) etiquettes.set(e, await assurerEtiquette(prisma, e));
    }

    const corps = {
      title: s.titre,
      excerpt: extrait(s.texte),
      body: markdownToHtml(s.texte),
      bodyText: s.texte,
      wordCount: s.texte.split(/\s+/).filter(Boolean).length,
    };

    const existante = await prisma.knowledgeEntry.findUnique({
      where: { slug: s.slug },
      select: {
        id: true,
        sourceFactoryId: true,
        translations: {
          where: { locale: "fr" },
          select: { id: true, bodyText: true, title: true },
        },
      },
    });

    let entryId: string;
    if (!existante) {
      const creee = await prisma.knowledgeEntry.create({
        data: {
          slug: s.slug,
          type: s.slug === SLUG_NOYAU ? "doctrine" : "methodology",
          domain: "methodology",
          audience: "team",
          confidentiality: "internal",
          status: "approved",
          pipelineStage: "approved",
          sourceFactoryId: SOURCE_IMPORT,
          sourcePromptId: s.fichier,
          translations: { create: { locale: "fr", slug: s.slug, ...corps } },
        },
        select: { id: true },
      });
      entryId = creee.id;
      bilan.crees += 1;
    } else if (existante.sourceFactoryId !== SOURCE_IMPORT) {
      bilan.ignores.push(s.slug);
      continue;
    } else {
      entryId = existante.id;
      const trad = existante.translations[0];
      if (!trad) {
        await prisma.knowledgeTranslation.create({
          data: { entryId, locale: "fr", slug: s.slug, ...corps },
        });
        bilan.misAJour += 1;
      } else if (trad.bodyText !== s.texte || trad.title !== s.titre) {
        // Statut, audience et publication ne sont JAMAIS réécrits ici.
        await prisma.knowledgeTranslation.update({ where: { id: trad.id }, data: corps });
        bilan.misAJour += 1;
      } else {
        bilan.inchanges += 1;
      }
    }

    for (const e of s.etiquettes) {
      const tagId = etiquettes.get(e)!;
      await prisma.knowledgeTagOnEntry.upsert({
        where: { entryId_tagId: { entryId, tagId } },
        create: { entryId, tagId },
        update: {},
      });
    }
    await rattacher(prisma, collections.get(s.collection)!, entryId);
  }
  return bilan;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exécution
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionsExecution {
  readonly racine: string;
  readonly ecrire: boolean;
  /** Fabrique du client : appelée SEULEMENT si `ecrire`. */
  readonly fabriquerClient: () => Promise<PrismaClient>;
  readonly journal?: (ligne: string) => void;
}

export async function executerImport(opts: OptionsExecution): Promise<{
  sections: SectionMethode[];
  bilan: BilanImport | null;
}> {
  const journal = opts.journal ?? ((l: string) => console.log(l));
  const sections = planifierImport(opts.racine);

  const parCollection = new Map<string, number>();
  for (const s of sections)
    parCollection.set(s.collection, (parCollection.get(s.collection) ?? 0) + 1);
  const chiffres = sections.filter((s) => s.contientMontants).length;
  const doctrine = sections.filter((s) => s.signalements.length > 0);

  journal(`[methode] ${String(sections.length)} fiche(s) lue(s) dans ${opts.racine}`);
  for (const [c, n] of parCollection) journal(`[methode]   ${c} : ${String(n)}`);
  journal(`[methode]   chiffres-exercice : ${String(chiffres)}`);
  journal(`[methode]   doctrine:a-revoir (jamais servies) : ${String(doctrine.length)}`);
  for (const s of doctrine) journal(`[methode]     ${s.slug} → ${s.signalements.join(", ")}`);
  if (!sections.some((s) => s.slug === SLUG_NOYAU)) {
    journal(`[methode] ⚠️ noyau absent (${SLUG_NOYAU}) : la fiche 00 n'a pas été trouvée.`);
  }

  if (!opts.ecrire) {
    for (const s of sections) journal(`[essai à blanc] ${s.slug}  [${s.etiquettes.join(", ")}]`);
    journal("[methode] ESSAI À BLANC : rien n'a été écrit. Relancer avec --ecrire pour écrire.");
    return { sections, bilan: null };
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("stub.invalid")) {
    throw new Error("--ecrire exige une DATABASE_URL réelle (absente ou stub).");
  }
  const prisma = await opts.fabriquerClient();
  try {
    const bilan = await ecrireSections(prisma, sections);
    journal(
      `[methode] écrit : ${String(bilan.crees)} créée(s), ${String(bilan.misAJour)} mise(s) à jour, ` +
        `${String(bilan.inchanges)} inchangée(s), ${String(bilan.ignores.length)} ignorée(s) (slug pris par une autre source).`,
    );
    return { sections, bilan };
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const racine = args.find((a) => !a.startsWith("--"));
  if (!racine) {
    console.error("Usage : pnpm tsx scripts/methode/importer-methode.ts <dossier> [--ecrire]");
    process.exit(2);
  }
  await executerImport({
    racine: path.resolve(racine),
    ecrire: args.includes("--ecrire"),
    fabriquerClient: async () => {
      const { PrismaClient: Client } = await import("../../prisma/generated/client");
      return new Client();
    },
  });
}

const lanceDirectement =
  typeof process.argv[1] === "string" && /importer-methode\.ts$/.test(process.argv[1]);
if (lanceDirectement) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
