/**
 * Couche « Méthode » — IMPORT des fiches Markdown dans la base (ADR 0076).
 *
 * GESTE HUMAIN, jamais une routine : aucun workflow, worker, cron ni script de
 * `package.json` ne lance ce fichier (un test le vérifie).
 *
 * Usage :
 *   pnpm tsx scripts/methode/importer-methode.ts --source <copie locale du dossier methode/>
 *   pnpm tsx scripts/methode/importer-methode.ts --source <dossier> --noms-sensibles <fichier>
 *   pnpm tsx scripts/methode/importer-methode.ts --source <dossier> --ecrire
 *
 *   --source           OBLIGATOIRE : copie LOCALE du dossier. Sans lui, refus (code 2).
 *   --noms-sensibles   fichier LOCAL, un nom par ligne : toute fiche qui le cite est refusée.
 *   --ecrire           écrit en base. Refusé si `CI` est posé ou si l'entrée standard n'est
 *                      pas un terminal. Sans lui : ESSAI À BLANC, aucun client Prisma.
 *
 * Liste blanche : seuls `livres/*.md` et `livres/important-a-savoir/*.md` sont lus. Tout
 * autre fichier est ignoré et COMPTÉ (jamais cité).
 *
 * Garanties :
 *   - ESSAI À BLANC par défaut : aucun client Prisma n'est même construit ;
 *   - une fiche qui porte un courriel, un téléphone ou un nom sensible est REFUSÉE ; le
 *     journal n'écrit que son slug et un motif, JAMAIS le texte ;
 *   - le journal ne contient que des comptes, des slugs et des motifs ;
 *   - idempotent sur le slug `methode/<fichier>/<section>` ;
 *   - JAMAIS de suppression, JAMAIS de publication : statut `approved`, audience `team`,
 *     confidentialité `internal`, `publishedAt` nul ;
 *   - une entrée de même slug qui ne vient pas de cet import n'est pas touchée.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  COLLECTION_VENTE,
  decouperFichier,
  estApprouvee,
  estSlugNoyau,
  fichierIgnore,
  retirerMarque,
  type SectionMethode,
} from "../../src/server/methode/decoupage";
import { contientCourriel, contientTelephone } from "../../src/server/methode/filtre-sortie";
import { normaliserPourControle } from "../../src/lib/contenu/interdits-publication";
import { markdownToHtml } from "../../src/lib/knowledge/markdown-import";
import type { PrismaClient } from "../../prisma/generated/client";

export const SOURCE_IMPORT = "methode-import";

/** Seule la collection « vente » existe en V1 : la santé n'est ni lue ni créée. */
export const COLLECTIONS: Readonly<
  Record<string, { readonly titreFr: string; readonly descriptionFr: string }>
> = {
  [COLLECTION_VENTE]: {
    titreFr: "Méthode · vente",
    descriptionFr:
      "Fiches de vente internes. Équipe seulement, jamais publiées. " +
      "Les montants éventuels sont des exercices, pas des prix publics.",
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

/** Liste blanche : `livres/*.md` et `livres/important-a-savoir/*.md`, rien d'autre. */
export function estDansListeBlanche(cheminRelatif: string): boolean {
  return (
    /^livres\/[^/]+\.md$/.test(cheminRelatif) ||
    /^livres\/important-a-savoir\/[^/]+\.md$/.test(cheminRelatif)
  );
}

export interface SectionRefusee {
  readonly slug: string;
  /** Code court : `courriel`, `telephone` ou `nom-sensible`. Jamais un extrait du texte. */
  readonly motif: "courriel" | "telephone" | "nom-sensible";
}

export interface PlanImport {
  readonly sections: SectionMethode[];
  readonly refusees: SectionRefusee[];
  readonly ignoresHorsListeBlanche: number;
}

function normaliser(t: string): string {
  return normaliserPourControle(t).trim();
}

/** Motif de refus à l'import (données de personnes), ou `null`. */
export function motifRefusImport(
  section: SectionMethode,
  nomsSensibles: readonly string[],
): SectionRefusee["motif"] | null {
  const champs = `${section.titre}\n${section.texte}`;
  if (contientCourriel(champs)) return "courriel";
  if (contientTelephone(champs)) return "telephone";
  const lu = normaliser(champs);
  for (const nom of nomsSensibles) {
    const n = normaliser(nom);
    if (n.length >= 2 && lu.includes(n)) return "nom-sensible";
  }
  return null;
}

/** Toutes les sections du dossier, dans un ordre stable. Pur à part la lecture. */
export function planifierImport(racine: string, nomsSensibles: readonly string[] = []): PlanImport {
  const sections: SectionMethode[] = [];
  const refusees: SectionRefusee[] = [];
  let ignoresHorsListeBlanche = 0;
  for (const fichier of listerMarkdown(racine)) {
    const rel = path.relative(racine, fichier).split(path.sep).join("/");
    if (fichierIgnore(rel)) continue;
    if (!estDansListeBlanche(rel)) {
      ignoresHorsListeBlanche += 1;
      continue;
    }
    for (const section of decouperFichier(rel, readFileSync(fichier, "utf8"))) {
      const motif = motifRefusImport(section, nomsSensibles);
      if (motif) refusees.push({ slug: section.slug, motif });
      else sections.push(section);
    }
  }
  const vus = new Set<string>();
  for (const s of [...sections, ...refusees]) {
    if (vus.has(s.slug)) throw new Error(`Slug en double : ${s.slug}`);
    vus.add(s.slug);
  }
  return { sections, refusees, ignoresHorsListeBlanche };
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

/**
 * Une entrée de cette source qui n'est plus parmi les sections retenues (refusée à l'import,
 * renommée, disparue du corpus) n'est jamais supprimée, mais elle ne reste pas servable :
 * sa ligne de marque est retirée. Le corpus fait foi, y compris quand il retire la marque.
 * Retourne le nombre d'entrées neutralisées. Ne pose rien.
 */
export async function neutraliserAbsentes(
  prisma: PrismaClient,
  retenus: ReadonlySet<string>,
): Promise<number> {
  const entrees = await prisma.knowledgeEntry.findMany({
    where: { sourceFactoryId: SOURCE_IMPORT, slug: { startsWith: "methode/" } },
    select: {
      slug: true,
      translations: { where: { locale: "fr" }, select: { id: true, bodyText: true } },
    },
  });
  let n = 0;
  for (const e of entrees) {
    if (retenus.has(e.slug)) continue;
    for (const t of e.translations) {
      if (!estApprouvee(t.bodyText ?? "")) continue;
      await prisma.knowledgeTranslation.update({
        where: { id: t.id },
        data: { bodyText: retirerMarque(t.bodyText ?? "") },
      });
      n += 1;
    }
  }
  return n;
}

export async function ecrireSections(
  prisma: PrismaClient,
  sections: readonly SectionMethode[],
): Promise<BilanImport> {
  const bilan: BilanImport = { crees: 0, misAJour: 0, inchanges: 0, ignores: [] };
  const collections = new Map<string, string>();
  const etiquettes = new Map<string, string>();

  for (const s of sections) {
    if (s.collection !== COLLECTION_VENTE) {
      throw new Error(`Collection non autorisée en V1 : ${s.collection}`);
    }
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
          type: estSlugNoyau(s.slug) ? "doctrine" : "methodology",
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

type Environnement = Readonly<Record<string, string | undefined>>;

export interface OptionsExecution {
  readonly racine: string;
  readonly ecrire: boolean;
  /** Noms à refuser (lus d'un fichier local par la ligne de commande). */
  readonly nomsSensibles?: readonly string[];
  /** Fabrique du client : appelée SEULEMENT si `ecrire`. */
  readonly fabriquerClient: () => Promise<PrismaClient>;
  readonly journal?: (ligne: string) => void;
  /** Environnement lu (défaut : `process.env`). */
  readonly env?: Environnement;
  /** L'entrée standard est-elle un terminal ? (défaut : `process.stdin.isTTY`). */
  readonly estTerminal?: boolean;
}

export interface ResultatImport {
  sections: SectionMethode[];
  bilan: BilanImport | null;
  refusees: SectionRefusee[];
  ignoresHorsListeBlanche: number;
}

/** `CI` posé (autre que vide, « 0 » ou « false ») = exécution automatique. */
function sousIntegrationContinue(env: Environnement): boolean {
  const v = (env.CI ?? "").trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false";
}

export async function executerImport(opts: OptionsExecution): Promise<ResultatImport> {
  const journal = opts.journal ?? ((l: string) => console.log(l));
  const env = opts.env ?? process.env;
  const estTerminal = opts.estTerminal ?? process.stdin.isTTY === true;

  // Refus AVANT toute lecture et tout client : l'écriture est un geste humain.
  if (opts.ecrire) {
    if (sousIntegrationContinue(env)) {
      throw new Error("--ecrire refusé : la variable CI est posée (geste humain seulement).");
    }
    if (!estTerminal) {
      throw new Error("--ecrire refusé : l'entrée standard n'est pas un terminal.");
    }
  }

  const { sections, refusees, ignoresHorsListeBlanche } = planifierImport(
    opts.racine,
    opts.nomsSensibles ?? [],
  );

  const parCollection = new Map<string, number>();
  for (const s of sections)
    parCollection.set(s.collection, (parCollection.get(s.collection) ?? 0) + 1);
  const chiffres = sections.filter((s) => s.contientMontants).length;
  const doctrine = sections.filter((s) => s.signalements.length > 0);

  journal(`[methode] ${String(sections.length)} fiche(s) retenue(s)`);
  for (const [c, n] of parCollection) journal(`[methode]   ${c} : ${String(n)}`);
  journal(`[methode]   ignorés hors liste blanche : ${String(ignoresHorsListeBlanche)}`);
  journal(`[methode]   refusées (données de personnes) : ${String(refusees.length)}`);
  for (const r of refusees) journal(`[methode]     ${r.slug} → ${r.motif}`);
  journal(`[methode]   chiffres-exercice (jamais servies) : ${String(chiffres)}`);
  journal(`[methode]   doctrine:a-revoir (jamais servies) : ${String(doctrine.length)}`);
  for (const s of doctrine) journal(`[methode]     ${s.slug} → ${s.signalements.join(", ")}`);
  if (!sections.some((s) => estSlugNoyau(s.slug))) {
    journal("[methode] ⚠️ noyau absent : la fiche 00 n'a pas été trouvée.");
  }

  if (!opts.ecrire) {
    for (const s of sections) journal(`[essai à blanc] ${s.slug}  [${s.etiquettes.join(", ")}]`);
    journal("[methode] ESSAI À BLANC : rien n'a été écrit. Relancer avec --ecrire pour écrire.");
    return { sections, bilan: null, refusees, ignoresHorsListeBlanche };
  }

  const url = env.DATABASE_URL ?? "";
  if (!url || url.includes("stub.invalid")) {
    throw new Error("--ecrire exige une DATABASE_URL réelle (absente ou stub).");
  }
  const prisma = await opts.fabriquerClient();
  try {
    const bilan = await ecrireSections(prisma, sections);
    const neutralisees = await neutraliserAbsentes(prisma, new Set(sections.map((x) => x.slug)));
    journal(
      `[methode] ${String(neutralisees)} entrée(s) absente(s) du corpus ou refusée(s) : marque retirée.`,
    );
    journal(
      `[methode] écrit : ${String(bilan.crees)} créée(s), ${String(bilan.misAJour)} mise(s) à jour, ` +
        `${String(bilan.inchanges)} inchangée(s), ${String(bilan.ignores.length)} ignorée(s) (slug pris par une autre source).`,
    );
    return { sections, bilan, refusees, ignoresHorsListeBlanche };
  } finally {
    await prisma.$disconnect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ligne de commande
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionsCli {
  readonly fabriquerClient: () => Promise<PrismaClient>;
  readonly env?: Environnement;
  readonly estTerminal?: boolean;
  readonly journal?: (ligne: string) => void;
  readonly erreur?: (ligne: string) => void;
}

const USAGE =
  "Usage : pnpm tsx scripts/methode/importer-methode.ts --source <dossier local> " +
  "[--noms-sensibles <fichier local>] [--ecrire]";

/** Code de sortie : 0 réussi, 2 usage, 1 refus ou échec. Ne jette jamais. */
export async function executerCli(argv: readonly string[], deps: OptionsCli): Promise<number> {
  const erreur = deps.erreur ?? ((l: string) => console.error(l));
  let source: string | undefined;
  let fichierNoms: string | undefined;
  let ecrire = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--ecrire") ecrire = true;
    else if (a === "--source") source = argv[++i];
    else if (a === "--noms-sensibles") fichierNoms = argv[++i];
    else {
      erreur(`Argument inconnu ou positionnel refusé. ${USAGE}`);
      return 2;
    }
  }
  if (!source || source.startsWith("--")) {
    erreur(`--source est obligatoire. ${USAGE}`);
    return 2;
  }

  let nomsSensibles: string[] = [];
  if (fichierNoms) {
    try {
      nomsSensibles = readFileSync(path.resolve(fichierNoms), "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      erreur("--noms-sensibles : fichier illisible.");
      return 2;
    }
  }

  try {
    await executerImport({
      racine: path.resolve(source),
      ecrire,
      nomsSensibles,
      fabriquerClient: deps.fabriquerClient,
      ...(deps.env ? { env: deps.env } : {}),
      ...(deps.estTerminal !== undefined ? { estTerminal: deps.estTerminal } : {}),
      ...(deps.journal ? { journal: deps.journal } : {}),
    });
    return 0;
  } catch (err) {
    erreur(`[methode] échec : ${(err as Error).message}`);
    return 1;
  }
}

const lanceDirectement =
  typeof process.argv[1] === "string" && /importer-methode\.ts$/.test(process.argv[1]);
if (lanceDirectement) {
  executerCli(process.argv.slice(2), {
    fabriquerClient: async () => {
      const { PrismaClient: Client } = await import("../../prisma/generated/client");
      return new Client();
    },
  }).then(
    (code) => process.exit(code),
    () => process.exit(1),
  );
}
