/**
 * Import de la couche « Méthode » (ADR 0076) — fiches Markdown → KnowledgeEntry.
 *
 * ESSAI À BLANC PAR DÉFAUT : lit le dossier, découpe, affiche ce qu'il ferait, et
 * n'ouvre AUCUNE connexion à la base. L'écriture n'a lieu qu'avec `--ecrire`.
 *
 *   pnpm tsx scripts/methode/importer-methode.ts <dossier> [--ecrire] [--autoriser-prod] [--detail]
 *
 * Garanties : idempotent sur le slug, aucune suppression, aucune publication
 * (statut `approved`, audience `team`, confidentialité `internal`).
 * `<dossier>` = le dossier `methode/` du dépôt axion-brand (copie du Drive, qui
 * reste la source d'origine, intacte).
 *
 * Avec `--ecrire`, la cible est contrôlée par `cibleAutorisee` (localhost,
 * préproduction) ; une base de production exige en plus `--autoriser-prod`
 * (décision de Williams). ⛔ Jamais depuis une routine automatique.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import {
  decouperFichier,
  estFichierImportable,
  type FicheMethode,
} from "../../src/server/methode/decoupage";
import { executerImport, type DepotMethode } from "../../src/server/methode/import";
import { cibleAutorisee } from "../../prisma/seeds/volumetrie/garde-cible";

async function listerMarkdown(dossier: string): Promise<string[]> {
  const sortie: string[] = [];
  const entrees = await readdir(dossier, { withFileTypes: true });
  for (const e of entrees) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...(await listerMarkdown(chemin)));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) sortie.push(chemin);
  }
  return sortie.sort();
}

export async function lireFiches(dossier: string): Promise<FicheMethode[]> {
  const racine = resolve(dossier);
  const fiches: FicheMethode[] = [];
  for (const chemin of await listerMarkdown(racine)) {
    const rel = relative(racine, chemin).replace(/\\/g, "/");
    // Le chemin complet sert à reconnaître `secteurs/sante/` même si l'on importe
    // directement ce sous-dossier.
    const complet = chemin.replace(/\\/g, "/");
    if (!estFichierImportable(rel)) continue;
    fiches.push(...decouperFichier(complet, await readFile(chemin, "utf8")));
  }
  return fiches;
}

async function depotPrisma(): Promise<{ depot: DepotMethode; fermer: () => Promise<void> }> {
  const { prisma } = await import("../../src/lib/prisma");
  const depot: DepotMethode = {
    async trouverEntree(slug) {
      return prisma.knowledgeEntry.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });
    },
    async creerEntree(f) {
      const e = await prisma.knowledgeEntry.create({
        data: {
          slug: f.slug,
          type: f.kbType,
          domain: "methodology",
          audience: "team",
          confidentiality: "internal",
          status: "approved",
          pipelineStage: "approved",
          sourceFactoryId: "methode-import",
          translations: {
            create: {
              locale: "fr",
              title: f.titre,
              slug: f.slug,
              body: f.corps,
              bodyText: f.corps,
              wordCount: f.corps.split(/\s+/).filter(Boolean).length,
            },
          },
        },
        select: { id: true },
      });
      return e.id;
    },
    async mettreAJourEntree(id, f) {
      await prisma.knowledgeEntry.update({
        where: { id },
        data: {
          type: f.kbType,
          domain: "methodology",
          audience: "team",
          confidentiality: "internal",
        },
      });
      await prisma.knowledgeTranslation.upsert({
        where: { entryId_locale: { entryId: id, locale: "fr" } },
        create: {
          entryId: id,
          locale: "fr",
          title: f.titre,
          slug: f.slug,
          body: f.corps,
          bodyText: f.corps,
        },
        update: { title: f.titre, body: f.corps, bodyText: f.corps },
      });
    },
    async assurerCollection(slug, titreFr, descriptionFr) {
      const c = await prisma.knowledgeCollection.upsert({
        where: { slug },
        create: { slug, titleFr: titreFr, descriptionFr, visibility: "team" },
        update: {},
        select: { id: true },
      });
      return c.id;
    },
    async rattacherACollection(collectionId, entryId) {
      const deja = await prisma.knowledgeCollectionItem.findUnique({
        where: { collectionId_entryId: { collectionId, entryId } },
      });
      if (deja) return;
      const max = await prisma.knowledgeCollectionItem.aggregate({
        where: { collectionId },
        _max: { position: true },
      });
      await prisma.knowledgeCollectionItem.create({
        data: { collectionId, entryId, position: (max._max.position ?? 0) + 1 },
      });
    },
    async assurerEtiquette(slug) {
      const t = await prisma.knowledgeTag.upsert({
        where: { slug },
        create: { slug, nameFr: slug, nameEn: slug },
        update: {},
        select: { id: true },
      });
      return t.id;
    },
    async etiqueter(entryId, tagId) {
      await prisma.knowledgeTagOnEntry.createMany({
        data: [{ entryId, tagId }],
        skipDuplicates: true,
      });
    },
  };
  return { depot, fermer: () => prisma.$disconnect() };
}

/** Dépôt factice de l'essai à blanc : toute écriture est une faute. */
const DEPOT_INTERDIT: DepotMethode = new Proxy({} as DepotMethode, {
  get() {
    throw new Error("Essai à blanc : aucune écriture ne doit avoir lieu.");
  },
});

async function principal(argv: readonly string[]): Promise<number> {
  const dossier = argv.find((a) => !a.startsWith("--"));
  const ecrire = argv.includes("--ecrire");
  const autoriserProd = argv.includes("--autoriser-prod");
  const detail = argv.includes("--detail");
  if (!dossier) {
    console.error("Usage : importer-methode.ts <dossier> [--ecrire] [--autoriser-prod] [--detail]");
    return 2;
  }

  const fiches = await lireFiches(dossier);
  console.info(`[methode] ${String(fiches.length)} fiche(s) découpée(s) depuis ${dossier}`);

  if (!ecrire) {
    const res = await executerImport(fiches, { ecrire: false, depot: DEPOT_INTERDIT });
    const parCollection = new Map<string, number>();
    let chiffres = 0;
    for (const f of fiches) {
      parCollection.set(f.collection, (parCollection.get(f.collection) ?? 0) + 1);
      if (f.chiffresExercice) chiffres += 1;
    }
    for (const [c, n] of parCollection) console.info(`[methode]   ${c} : ${String(n)}`);
    console.info(`[methode]   étiquetées chiffres-exercice : ${String(chiffres)}`);
    for (const l of res.plan) {
      console.info(
        `[essai à blanc] ${l.action} ${l.slug} (${String(l.caracteres)} car.)` +
          (detail ? ` [${l.etiquettes.join(", ")}]` : ""),
      );
    }
    console.info("[methode] ESSAI À BLANC : rien n'a été écrit. Ajouter --ecrire pour écrire.");
    return 0;
  }

  const verdict = cibleAutorisee({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (
    !verdict.ok &&
    !(autoriserProd && verdict.raison !== "url_absente" && verdict.raison !== "stub")
  ) {
    console.error(`[methode] écriture refusée : ${verdict.message}`);
    return 3;
  }

  const { depot, fermer } = await depotPrisma();
  try {
    const res = await executerImport(fiches, { ecrire: true, depot });
    for (const l of res.plan) console.info(`[ecriture] ${l.action} ${l.slug}`);
    console.info(
      `[methode] ${String(res.plan.length)} fiche(s) traitée(s), aucune suppression, aucune publication.`,
    );
  } finally {
    await fermer();
  }
  return 0;
}

if (process.argv[1] && /importer-methode\.ts$/.test(process.argv[1])) {
  principal(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(e);
      process.exit(1);
    },
  );
}
