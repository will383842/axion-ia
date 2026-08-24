#!/usr/bin/env tsx
/**
 * Console éditoriale — import de la COUCHE PRODUCTION du dossier LinkedIn.
 *
 * Le complément de `editorial:import`, qui n'avait lu que le calendrier et
 * les 61 posts. Celui-ci lit les quatre fichiers de production et accroche
 * scripts, prompts et plans de slides aux assets déjà créés.
 *
 * Les mêmes quatre garanties que son aîné, dans le même ordre :
 *
 * 1. **Transactionnel** — tout ou rien.
 * 2. **Idempotent** par `refImport` de segment — un rejeu ne duplique rien.
 * 3. **Non répétable** — un second lancement dit « déjà effectué » sans
 *    `--confirmer`.
 * 4. **Rapport** — créé / ignoré / sans cible, avec le détail.
 *
 * Usage :
 *   pnpm editorial:import-production --source <dossier>
 *   pnpm editorial:import-production --source <dossier> --dry-run
 *   pnpm editorial:import-production --source <dossier> --confirmer
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "../../generated/client";
import {
  lireVideos,
  lireCarrousels,
  lireImages,
  lirePhotos,
  refSegment,
  lireSeries,
  slugSerie,
  type BriefPost,
} from "../../../src/server/editorial/import/production-q4";
import { refImport } from "../../../src/server/editorial/import/linkedin-q4";

const prisma = new PrismaClient();

const CLE_MARQUEUR = "editorial.import.linkedin-2026-q4-production";

/**
 * L'ordre de lecture n'est PAS cosmétique.
 *
 * Treize posts portent à la fois un plan de carrousel et un prompt d'image
 * (le visuel de leur slide 1). En lisant les carrousels d'abord, les slides
 * gardent leur numérotation naturelle — `ordre` 1 à 9 — et le prompt vient
 * derrière. L'inverse ferait démarrer les slides à 2, et « Slide 3 » ne
 * serait plus la troisième.
 */
const FICHIERS: { nom: string; lecteur: (t: string) => BriefPost[] }[] = [
  { nom: "21-PRODUCTION-CARROUSELS.md", lecteur: lireCarrousels },
  { nom: "20-PRODUCTION-VIDEOS.md", lecteur: lireVideos },
  { nom: "22-PRODUCTION-IMAGES-ET-PROMPTS.md", lecteur: lireImages },
  { nom: "23-PRODUCTION-PHOTOS-DE-WILL.md", lecteur: lirePhotos },
];

interface Options {
  source: string;
  dryRun: boolean;
  confirmer: boolean;
}

function lireOptions(argv: string[]): Options {
  const opts: Options = {
    source: path.join(process.cwd(), "_IMPORT", "linkedin-q4"),
    dryRun: false,
    confirmer: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const valeur = argv[i + 1];
    if (argv[i] === "--source" && valeur) {
      opts.source = path.resolve(valeur);
      i += 1;
    } else if (argv[i] === "--dry-run") {
      opts.dryRun = true;
    } else if (argv[i] === "--confirmer") {
      opts.confirmer = true;
    }
  }
  return opts;
}

interface Rapport {
  segmentsCrees: number;
  segmentsIgnores: number;
  seriesCreees: number;
  postsRattaches: number;
  briefsSansCible: string[];
  avertissements: string[];
}

async function main(): Promise<void> {
  const opts = lireOptions(process.argv.slice(2));

  console.warn(`📥 [editorial:import-production] source : ${opts.source}`);
  if (opts.dryRun) console.warn("   Mode --dry-run : rien ne sera écrit.");

  // ── Les fichiers ──────────────────────────────────────────────────────────
  const briefs: BriefPost[] = [];
  for (const f of FICHIERS) {
    const chemin = path.join(opts.source, f.nom);
    if (!fs.existsSync(chemin)) {
      throw new Error(
        `Fichier « ${f.nom} » introuvable dans ${opts.source}.\n` +
          `   Les quatre fichiers de production sont attendus ensemble : ` +
          `${FICHIERS.map((x) => x.nom).join(", ")}.`,
      );
    }
    const lus = f.lecteur(fs.readFileSync(chemin, "utf8"));
    console.warn(
      `   ${f.nom} — ${lus.length} brief(s), ` +
        `${lus.reduce((n, b) => n + b.segments.length, 0)} segment(s).`,
    );
    briefs.push(...lus);
  }

  // ── Les séries, lues dans les titres des 61 posts ─────────────────────────
  const NOM_POSTS = "10-LES-61-POSTS.md";
  const cheminPosts = path.join(opts.source, NOM_POSTS);
  if (!fs.existsSync(cheminPosts)) {
    throw new Error(
      `Fichier « ${NOM_POSTS} » introuvable dans ${opts.source} — il porte les séries.`,
    );
  }
  const series = lireSeries(fs.readFileSync(cheminPosts, "utf8"));
  console.warn(
    `   ${NOM_POSTS} — ${series.length} série(s), ` +
      `${series.reduce((n, x) => n + x.posts.length, 0)} épisode(s).`,
  );

  // ── Le marqueur de non-répétabilité ───────────────────────────────────────
  const marqueur = await prisma.siteSetting.findUnique({ where: { key: CLE_MARQUEUR } });
  if (marqueur && !opts.confirmer) {
    const v = marqueur.value as Record<string, unknown>;
    console.warn(
      `\n⚠️  [editorial:import-production] déjà effectué le ${String(v.faitA ?? "?")} — ` +
        `${String(v.segments ?? "?")} segment(s).\n` +
        `   RIEN n'a été créé. Pour rejouer malgré tout : --confirmer`,
    );
    return;
  }

  const rapport: Rapport = {
    segmentsCrees: 0,
    segmentsIgnores: 0,
    seriesCreees: 0,
    postsRattaches: 0,
    briefsSansCible: [],
    avertissements: [],
  };

  // ── Les assets visés, par numéro de post ──────────────────────────────────
  //
  // Un post porte jusqu'à deux assets. On les distingue par leur TYPE :
  // la photo de Williams est le seul asset de type `photo`, tout le reste
  // est la production. Le libellé, lui, pourrait être édité depuis la
  // console — s'y fier rendrait l'import fragile au premier renommage.
  const publications = await prisma.edPublication.findMany({
    where: { refImport: { startsWith: "linkedin-2026-q4" } },
    select: {
      id: true,
      refImport: true,
      assets: { select: { asset: { select: { id: true, type: true } } } },
    },
  });

  const cibles = new Map<string, string>(); // `${numeroPost}:${cible}` → assetId
  for (const p of publications) {
    // 🔴 Les échos sont EXCLUS : ils rediffusent le même visuel que leur
    // source. Y recopier le brief créerait deux exemplaires du même script,
    // et corriger l'un laisserait l'autre mentir.
    if (!p.refImport || p.refImport.endsWith("-echo")) continue;
    const numero = Number.parseInt(p.refImport.replace("linkedin-2026-q4-", ""), 10);
    if (!Number.isFinite(numero)) continue;
    for (const lien of p.assets) {
      const cle = `${numero}:${lien.asset.type === "photo" ? "photo" : "production"}`;
      if (!cibles.has(cle)) cibles.set(cle, lien.asset.id);
    }
  }

  // ── Préparation : tout ce qui peut manquer, se voit AVANT la transaction ──
  interface Pret {
    assetId: string;
    ordre: number;
    role: BriefPost["segments"][number]["role"];
    titre: string | null;
    contenu: string | null;
    prompt: string | null;
    ref: string;
  }

  const prets: Pret[] = [];
  /** Décalage courant par asset — voir le commentaire sur FICHIERS. */
  const decalage = new Map<string, number>();

  for (const brief of briefs) {
    const cle = `${brief.numeroPost}:${brief.cible}`;
    const assetId = cibles.get(cle);
    if (!assetId) {
      rapport.briefsSansCible.push(
        `${brief.source} — post n°${brief.numeroPost} : aucun asset « ${brief.cible} » ` +
          `sur ${refImport(brief.numeroPost)}. ${brief.segments.length} segment(s) non rattaché(s).`,
      );
      continue;
    }

    const base = decalage.get(assetId) ?? 0;
    let maxOrdre = base;
    for (const s of brief.segments) {
      const ordre = base + s.ordre;
      if (ordre > maxOrdre) maxOrdre = ordre;
      prets.push({
        assetId,
        ordre,
        role: s.role,
        titre: s.titre,
        contenu: s.contenu,
        prompt: s.prompt,
        ref: refSegment(brief.source, brief.numeroPost, s.ordre),
      });
    }
    decalage.set(assetId, maxOrdre);
  }

  if (opts.dryRun) {
    rapport.segmentsCrees = prets.length;
    rapport.seriesCreees = series.length;
    rapport.postsRattaches = series.reduce((n, x) => n + x.posts.length, 0);
    afficherRapport(rapport, prets);
    console.warn("   (--dry-run : aucune écriture effectuée.)");
    return;
  }

  // ── L'écriture, en une transaction ────────────────────────────────────────
  await prisma.$transaction(
    async (tx) => {
      for (const p of prets) {
        const existant = await tx.edAssetSegment.findUnique({ where: { refImport: p.ref } });
        if (existant) {
          rapport.segmentsIgnores += 1;
          continue;
        }
        await tx.edAssetSegment.create({
          data: {
            assetId: p.assetId,
            ordre: p.ordre,
            role: p.role,
            titre: p.titre,
            contenu: p.contenu,
            prompt: p.prompt,
            refImport: p.ref,
          },
        });
        rapport.segmentsCrees += 1;
      }

      // ── Les séries ────────────────────────────────────────────────────
      //
      // 🔴 Idempotent par SLUG, et le rattachement ne touche QUE les
      // publications dont `serieId` est encore nul. Un post rattaché à la
      // main depuis la console ne doit pas se faire réécrire par un rejeu de
      // l'import : le dossier est une archive, la base fait foi.
      for (const serie of series) {
        const slug = slugSerie(serie.nom);
        const existante = await tx.edSerie.findUnique({ where: { slug } });
        const enBase =
          existante ?? (await tx.edSerie.create({ data: { nom: serie.nom, slug, actif: true } }));
        if (!existante) rapport.seriesCreees += 1;

        for (const ep of serie.posts) {
          const maj = await tx.edPublication.updateMany({
            where: { refImport: refImport(ep.numeroPost), serieId: null },
            data: { serieId: enBase.id },
          });
          rapport.postsRattaches += maj.count;
        }
      }

      // Écrit DANS la transaction : un import échoué ne doit pas laisser un
      // marqueur qui mentirait sur un import qui n'a jamais eu lieu.
      await tx.siteSetting.upsert({
        where: { key: CLE_MARQUEUR },
        create: {
          key: CLE_MARQUEUR,
          category: "editorial",
          description: "Marqueur de non-répétabilité de l'import de la couche production Q4.",
          value: {
            faitA: new Date().toISOString(),
            segments: rapport.segmentsCrees,
            fichiers: FICHIERS.map((f) => f.nom),
          } as Prisma.InputJsonValue,
        },
        update: {
          value: {
            faitA: new Date().toISOString(),
            segments: rapport.segmentsCrees,
            fichiers: FICHIERS.map((f) => f.nom),
          } as Prisma.InputJsonValue,
        },
      });
    },
    // 366 segments, un findUnique + un create chacun : le défaut de 5 s ne
    // suffit pas sur une machine chargée, et un timeout annulerait TOUT.
    { timeout: 120_000 },
  );

  afficherRapport(rapport, prets);
}

function afficherRapport(rapport: Rapport, prets: { role: string }[]): void {
  const parRole = new Map<string, number>();
  for (const p of prets) parRole.set(p.role, (parRole.get(p.role) ?? 0) + 1);

  console.warn("\n────────── RAPPORT COUCHE PRODUCTION ──────────");
  console.warn(`   Segments créés   : ${rapport.segmentsCrees}`);
  console.warn(`   Déjà présents    : ${rapport.segmentsIgnores}`);
  console.warn(`   Séries créées    : ${rapport.seriesCreees}`);
  console.warn(`   Posts rattachés  : ${rapport.postsRattaches}`);
  console.warn(
    `   Par rôle         : ${[...parRole.entries()].map(([r, n]) => `${r}=${n}`).join("  ")}`,
  );

  if (rapport.briefsSansCible.length > 0) {
    console.warn(`\n   ⚠️  Briefs sans asset cible (${rapport.briefsSansCible.length}) :`);
    for (const b of rapport.briefsSansCible) console.warn(`   - ${b}`);
  }
  if (rapport.avertissements.length > 0) {
    console.warn(`\n   Avertissements (${rapport.avertissements.length}) :`);
    for (const a of rapport.avertissements) console.warn(`   - ${a}`);
  }
  console.warn("───────────────────────────────────────────────");
}

main()
  .catch((e: unknown) => {
    console.error(`\n❌ [editorial:import-production] ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
