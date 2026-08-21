#!/usr/bin/env tsx
/**
 * Console éditoriale — import du dossier LinkedIn du 4ᵉ trimestre (§6).
 *
 * Quatre garanties, dans cet ordre de priorité :
 *
 * 1. **Transactionnel** — tout ou rien. Un import à moitié appliqué serait
 *    pire que pas d'import : il faudrait décider à la main ce qui manque.
 * 2. **Idempotent** par `refImport` — un rejeu ne crée aucun doublon, même
 *    forcé. C'est la garantie de fond ; le marqueur n'en est que le confort.
 * 3. **Non répétable** — un second lancement affiche « déjà effectué » et ne
 *    crée RIEN sans `--confirmer`.
 * 4. **Rapport** — créé / ignoré / en erreur, avec le détail ligne à ligne.
 *
 * Usage :
 *   pnpm editorial:import --source <dossier>     # importe
 *   pnpm editorial:import --source <dossier> --dry-run   # lit, ne touche à rien
 *   pnpm editorial:import --source <dossier> --confirmer # rejoue malgré le marqueur
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "../../generated/client";
import {
  lireCalendrier,
  lirePosts,
  convertirDate,
  convertirHeure,
  convertirTags,
  refImport,
  refImportEcho,
  construireLien,
  estVrai,
  normaliserFormat,
  CLE_MARQUEUR_IMPORT,
  type LigneCalendrier,
  type ErreurLigne,
} from "../../../src/server/editorial/import/linkedin-q4";
import { ED_FAMILLES, ALIAS_TEXTE_SEUL } from "../../../src/server/editorial/referentiels/familles";

const prisma = new PrismaClient();

/** Clé du marqueur de non-répétabilité — déclarée dans le module pur. */
const CLE_MARQUEUR = CLE_MARQUEUR_IMPORT;
const CAMPAGNE = "q4-2026";

/** Les deux comptes que l'import vise, par leur clé naturelle. */
const SLUG_COMPTE_PROFIL = "linkedin-williams-jullin";
const SLUG_COMPTE_PAGE = "linkedin-page-axion-ia";

const NOM_CSV = "02-calendrier-publication.csv";
const NOM_POSTS = "10-LES-61-POSTS.md";

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
  publicationsCreees: number;
  reprisesCreees: number;
  ignorees: number;
  assetsCrees: number;
  erreurs: ErreurLigne[];
  avertissements: string[];
}

/** Rend la famille correspondant au `format`, ou `null` pour du texte seul. */
function resoudreFamille(format: string): { slug: string | null; connu: boolean } {
  const f = normaliserFormat(format);
  if (ALIAS_TEXTE_SEUL.includes(f)) return { slug: null, connu: true };
  for (const famille of ED_FAMILLES) {
    if (famille.aliasImport.some((a) => normaliserFormat(a) === f)) {
      return { slug: famille.slug, connu: true };
    }
  }
  // Une écriture inconnue n'invente PAS une famille : la ligne part en erreur.
  return { slug: null, connu: false };
}

async function main(): Promise<void> {
  const opts = lireOptions(process.argv.slice(2));

  console.warn(`📥 [editorial:import] dossier LinkedIn Q4 — source : ${opts.source}`);
  if (opts.dryRun) console.warn("   Mode --dry-run : rien ne sera écrit.");

  // ── Les fichiers ──────────────────────────────────────────────────────────
  const cheminCsv = path.join(opts.source, NOM_CSV);
  const cheminPosts = path.join(opts.source, NOM_POSTS);
  for (const [nom, chemin] of [
    [NOM_CSV, cheminCsv],
    [NOM_POSTS, cheminPosts],
  ] as const) {
    if (!fs.existsSync(chemin)) {
      throw new Error(
        `Fichier « ${nom} » introuvable dans ${opts.source}.\n` +
          `   Le §6 attend « ${NOM_CSV} » et « ${NOM_POSTS} », extraits de « Linkedin complet.zip ».`,
      );
    }
  }

  const { lignes, erreurs: erreursLecture } = lireCalendrier(fs.readFileSync(cheminCsv, "utf8"));
  const posts = lirePosts(fs.readFileSync(cheminPosts, "utf8"));
  console.warn(`   ${lignes.length} ligne(s) de calendrier, ${posts.size} post(s) apparié(s).`);

  // ── Le marqueur de non-répétabilité ───────────────────────────────────────
  const marqueur = await prisma.siteSetting.findUnique({ where: { key: CLE_MARQUEUR } });
  if (marqueur && !opts.confirmer) {
    const v = marqueur.value as Record<string, unknown>;
    console.warn(
      `\n⚠️  [editorial:import] déjà effectué le ${String(v.faitA ?? "?")} — ` +
        `${String(v.publications ?? "?")} publication(s), ${String(v.reprises ?? "?")} reprise(s).\n` +
        `   RIEN n'a été créé. Pour rejouer malgré tout : --confirmer\n` +
        `   (le rejeu reste sans doublon : l'idempotence par refImport le garantit.)`,
    );
    return;
  }

  // ── Les référentiels que l'import suppose ─────────────────────────────────
  const [profil, page] = await Promise.all([
    prisma.edCompte.findUnique({ where: { slug: SLUG_COMPTE_PROFIL } }),
    prisma.edCompte.findUnique({ where: { slug: SLUG_COMPTE_PAGE } }),
  ]);
  if (!profil || !page) {
    throw new Error(
      `Comptes « ${SLUG_COMPTE_PROFIL} » et « ${SLUG_COMPTE_PAGE} » attendus en base. ` +
        `Lancez d'abord « pnpm editorial:seed ».`,
    );
  }

  const famillesEnBase = await prisma.edFamille.findMany({ select: { id: true, slug: true } });
  const familleParSlug = new Map(famillesEnBase.map((f) => [f.slug, f.id]));

  const rapport: Rapport = {
    publicationsCreees: 0,
    reprisesCreees: 0,
    ignorees: 0,
    assetsCrees: 0,
    erreurs: [...erreursLecture],
    avertissements: [],
  };

  // ── Préparation : tout ce qui peut échouer, échoue AVANT la transaction ────
  interface Prete {
    ligne: LigneCalendrier;
    numeroLigne: number;
    ref: string;
    refEcho: string | null;
    datePrevue: Date;
    heurePrevue: string;
    titreInterne: string;
    accroche: string | null;
    corps: string | null;
    premierCommentaire: string | null;
    tags: string[];
    lienUrl: string | null;
    familleId: string | null;
    statutAsset: "non_requis" | "a_produire";
    production: boolean;
    photoWill: boolean;
  }

  const pretes: Prete[] = [];

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    if (!ligne) continue;
    const numeroLigne = i + 2; // +1 en-tête, +1 index base 1 : le numéro du tableur.
    try {
      const famille = resoudreFamille(ligne.format);
      if (!famille.connu) {
        throw new Error(
          `Format « ${ligne.format} » inconnu — aucune famille ne le reconnaît. ` +
            `Ajoutez un alias dans le référentiel des familles plutôt que d'inventer ici.`,
        );
      }

      const familleId = famille.slug ? (familleParSlug.get(famille.slug) ?? null) : null;
      if (famille.slug && !familleId) {
        throw new Error(
          `Famille « ${famille.slug} » absente de la base. Lancez « pnpm editorial:seed ».`,
        );
      }

      const numero = Number.parseInt(ligne.numero.replace(/\D/g, ""), 10);
      const post = posts.get(numero);
      if (!post) {
        rapport.avertissements.push(
          `Ligne ${numeroLigne} (n°${ligne.numero}) : aucune section « ## #${numero} » dans ${NOM_POSTS}. ` +
            `Corps et premier commentaire laissés vides.`,
        );
      }

      const lien = construireLien(ligne.lien, CAMPAGNE, refImport(ligne.numero));
      if (lien.avertissement) {
        rapport.avertissements.push(
          `Ligne ${numeroLigne} (n°${ligne.numero}) : ${lien.avertissement}`,
        );
      }

      const accroche = ligne.accroche.trim();
      const production = estVrai(ligne.production);
      const photoWill = estVrai(ligne.photoWill);

      pretes.push({
        ligne,
        numeroLigne,
        ref: refImport(ligne.numero),
        refEcho: estVrai(ligne.echoPage) ? refImportEcho(ligne.numero) : null,
        datePrevue: convertirDate(ligne.date),
        heurePrevue: convertirHeure(ligne.heure),
        // Le titre interne sert à retrouver la publication dans une liste :
        // l'accroche tronquée est ce qui la rend reconnaissable d'un coup d'œil.
        titreInterne: (accroche || `Publication n°${ligne.numero}`).slice(0, 200),
        accroche: accroche || null,
        corps: post?.corps || null,
        premierCommentaire: post?.premierCommentaire || null,
        tags: convertirTags(ligne.tags),
        lienUrl: lien.url,
        familleId,
        statutAsset: production || photoWill || familleId ? "a_produire" : "non_requis",
        production,
        photoWill,
      });
    } catch (e) {
      rapport.erreurs.push({
        ligne: numeroLigne,
        numero: ligne.numero,
        motif: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (rapport.erreurs.length > 0) {
    // 🔴 Transactionnel veut dire TOUT ou RIEN. Importer 58 lignes sur 61 en
    // laissant trois erreurs derrière, c'est livrer un dossier dont personne
    // ne connaît l'état — exactement ce que le §6 interdit.
    afficherRapport(rapport, opts);
    throw new Error(
      `${rapport.erreurs.length} ligne(s) en erreur — AUCUNE écriture. ` +
        `Corrigez le CSV puis relancez.`,
    );
  }

  if (opts.dryRun) {
    rapport.publicationsCreees = pretes.length;
    rapport.reprisesCreees = pretes.filter((p) => p.refEcho).length;
    afficherRapport(rapport, opts);
    console.warn("   (--dry-run : aucune écriture effectuée.)");
    return;
  }

  // ── L'écriture, en une transaction ────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    for (const p of pretes) {
      const existante = await tx.edPublication.findUnique({ where: { refImport: p.ref } });
      if (existante) {
        rapport.ignorees += 1;
        continue;
      }

      const publication = await tx.edPublication.create({
        data: {
          compteId: profil.id,
          refImport: p.ref,
          datePrevue: p.datePrevue,
          heurePrevue: p.heurePrevue,
          titreInterne: p.titreInterne,
          accroche: p.accroche,
          corps: p.corps,
          premierCommentaire: p.premierCommentaire,
          tags: p.tags,
          lienUrl: p.lienUrl,
          statutRedaction: p.corps ? "redige" : "idee",
          statutAsset: p.statutAsset,
          statutDiffusion: "non_programme",
          campagne: CAMPAGNE,
        },
      });
      rapport.publicationsCreees += 1;

      // Les assets annoncés par les colonnes `production` et `photo_will`.
      const aCreer: { type: "video" | "photo"; familleId: string | null; libelle: string }[] = [];
      if (p.production) {
        aCreer.push({
          type: "video",
          familleId: p.familleId,
          libelle: `Production — ${p.titreInterne}`.slice(0, 200),
        });
      }
      if (p.photoWill) {
        aCreer.push({
          type: "photo",
          familleId: familleParSlug.get("photo-williams") ?? null,
          libelle: `Photo Williams — ${p.titreInterne}`.slice(0, 200),
        });
      }
      for (let k = 0; k < aCreer.length; k += 1) {
        const a = aCreer[k];
        if (!a) continue;
        const asset = await tx.edAsset.create({
          data: {
            type: a.type,
            familleId: a.familleId,
            nature: "autonome",
            usage: "organique",
            libelle: a.libelle,
            statut: "a_produire",
          },
        });
        await tx.edAssetPublication.create({
          data: { assetId: asset.id, publicationId: publication.id, ordre: k },
        });
        rapport.assetsCrees += 1;
      }

      await tx.edJournal.create({
        data: {
          entite: "EdPublication",
          entiteId: publication.id,
          action: "import",
          apres: { refImport: p.ref, source: NOM_CSV } as Prisma.InputJsonValue,
        },
      });

      // L'écho de page : une SECONDE diffusion, liée à la première par
      // `sourceId`. Ce n'est pas une copie — les deux ont leurs métriques.
      if (p.refEcho) {
        const dejaEcho = await tx.edPublication.findUnique({ where: { refImport: p.refEcho } });
        if (dejaEcho) {
          rapport.ignorees += 1;
          continue;
        }
        const echo = await tx.edPublication.create({
          data: {
            compteId: page.id,
            refImport: p.refEcho,
            datePrevue: p.datePrevue,
            heurePrevue: p.heurePrevue,
            titreInterne: `Écho page — ${p.titreInterne}`.slice(0, 200),
            accroche: p.accroche,
            corps: p.corps,
            premierCommentaire: p.premierCommentaire,
            tags: p.tags,
            lienUrl: p.lienUrl,
            statutRedaction: p.corps ? "redige" : "idee",
            statutAsset: p.statutAsset,
            statutDiffusion: "non_programme",
            campagne: CAMPAGNE,
            sourceId: publication.id,
          },
        });
        rapport.reprisesCreees += 1;
        await tx.edJournal.create({
          data: {
            entite: "EdPublication",
            entiteId: echo.id,
            action: "import",
            apres: { refImport: p.refEcho, sourceRef: p.ref } as Prisma.InputJsonValue,
          },
        });
      }
    }

    // Le marqueur est écrit DANS la transaction : si l'import échoue, il
    // n'existe pas, et le prochain lancement n'est pas bloqué par un marqueur
    // qui mentirait sur un import qui n'a jamais eu lieu.
    await tx.siteSetting.upsert({
      where: { key: CLE_MARQUEUR },
      create: {
        key: CLE_MARQUEUR,
        category: "editorial",
        description: "Marqueur de non-répétabilité de l'import LinkedIn Q4 2026 (§6 du plan).",
        value: {
          faitA: new Date().toISOString(),
          publications: rapport.publicationsCreees,
          reprises: rapport.reprisesCreees,
          source: NOM_CSV,
        } as Prisma.InputJsonValue,
      },
      update: {
        value: {
          faitA: new Date().toISOString(),
          publications: rapport.publicationsCreees,
          reprises: rapport.reprisesCreees,
          source: NOM_CSV,
          rejoue: true,
        } as Prisma.InputJsonValue,
      },
    });
  });

  // Le compte est recalculé, jamais agrégé au rendu (cf. `derniereParutionA`).
  afficherRapport(rapport, opts);
}

function afficherRapport(rapport: Rapport, opts: Options): void {
  console.warn("\n──────────── RAPPORT D'IMPORT ────────────");
  console.warn(`   Publications créées : ${rapport.publicationsCreees}`);
  console.warn(`   Reprises (échos)    : ${rapport.reprisesCreees}`);
  console.warn(`   Ignorées (déjà là)  : ${rapport.ignorees}`);
  console.warn(`   Assets créés        : ${rapport.assetsCrees}`);
  console.warn(`   En erreur           : ${rapport.erreurs.length}`);

  if (rapport.erreurs.length > 0) {
    console.warn("\n   Détail des erreurs :");
    for (const e of rapport.erreurs) {
      console.warn(`   - ligne ${e.ligne} (n°${e.numero || "?"}) : ${e.motif}`);
    }
  }
  if (rapport.avertissements.length > 0) {
    console.warn(`\n   Avertissements (${rapport.avertissements.length}) :`);
    for (const a of rapport.avertissements) console.warn(`   - ${a}`);
  }
  console.warn("──────────────────────────────────────────");
  if (opts.dryRun) console.warn("   Mode lecture seule.");
}

main()
  .catch((e: unknown) => {
    console.error(`\n❌ [editorial:import] ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
