import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **COUCHE « MÉTHODE » (ADR 0076) — CE QUI NE DOIT JAMAIS BOUGER.**
 *
 * Tout le corpus de ce fichier est FAUX et inventé (une boulangerie imaginaire).
 * Aucun contenu réel de la marque ne doit jamais entrer ici.
 *
 *   1. le découpage rend des slugs STABLES `methode/<fichier>/<section>` ;
 *   2. toute section qui porte un montant est étiquetée `chiffres-exercice` ;
 *   3. l'import refuse de démarrer sans `--source` ;
 *   4. l'import ne lit que la liste blanche (`livres/*.md`, `livres/important-a-savoir/*.md`) ;
 *   5. l'import refuse une fiche piégée (courriel, téléphone, nom sensible) ;
 *   6. `--ecrire` est refusé sous CI ou sans terminal ;
 *   7. interrupteur éteint = contexte neutre, sans toucher la base.
 */

const findManyMock = vi.fn();
const queryRawMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: { findMany: (...a: unknown[]) => findManyMock(...a) },
    $queryRawUnsafe: (...a: unknown[]) => queryRawMock(...a),
  },
}));

import {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_VENTE,
  decouperFichier,
  estSlugNoyau,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  contientMontant,
  retirerMarque,
  estApprouvee,
} from "../decoupage";
import { CONTEXTE_NEUTRE, methodeActive, obtenirContexteMethode } from "../index";
import {
  executerCli,
  executerImport,
  neutraliserAbsentes,
  type OptionsCli,
} from "../../../../scripts/methode/importer-methode";

const EURO = String.fromCharCode(0x20ac);
/** Un montant fabriqué à l'exécution : aucun montant n'est écrit en clair dans un fichier. */
const MONTANT = `${["12", "345"].join(" ")} ${EURO}`;
const COURRIEL = ["faux.contact", "exemple.invalid"].join("@");
const TELEPHONE = ["01", "23", "45", "67", "89"].join(" ");
const NOM_SENSIBLE = "Zorglub Inventé";

const LONG =
  "Ce paragraphe d'explication est assez long pour ressembler à une vraie ligne de fiche PDF.";

/** Une fiche « livre appliqué » minimale, à la forme des extractions, entièrement inventée. */
const FICHE_FAUSSE = [
  "# faux-00-atelier-methode",
  "",
  "<!-- page 1 -->",
  "",
  "1 / 2",
  "AXION IA · Un bandeau inventé",
  "1. Le pain se vend d'abord par l'odeur",
  LONG,
  "L'ESSENTIEL EN 30 SECONDES",
  "Une vitrine chaleureuse vaut mieux qu'une longue explication.",
  "LE CHEMIN",
  "Accueillir puis écouter.",
  "Les idées clés",
  "",
  "<!-- page 2 -->",
  "2. Le calcul de la fournée",
  `${LONG} Exercice : douze fournées par mois pour ${MONTANT} par an.`,
  "3. Le parcours en étapes",
  LONG,
  "1. Accueillir",
  "Court fragment",
  "2. Écouter",
  "Court fragment",
  "3. Proposer",
  "Court fragment",
  "4. Remercier",
  "Court fragment de cellule",
  "4. Les phrases du comptoir",
  LONG,
  "Si… alors…",
  "Un client hésite, alors je lui laisse goûter.",
  "Mises en situation",
  "MISE EN SITUATION",
  "Cas 1 — La boulangère du marché",
  "Contexte : un stand imaginaire un dimanche matin.",
  "Teste-toi",
  "1. Combien de fournées par mois ?",
].join("\n");

const FICHE_AFFICHE = [
  "# faux-affiche",
  "<!-- page 1 -->",
  "Un rappel inventé sur la vitrine du matin",
  `${LONG}`,
  "<!-- page 2 -->",
  "Un second rappel inventé sur la caisse",
  `${LONG}`,
].join("\n");

describe("1 · découpage et slugs stables", () => {
  const sections = decouperFichier("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
  const slugs = sections.map((s) => s.slug);

  it("rend les sections attendues, dans l'ordre, sous methode/<fichier>/<section>", () => {
    expect(slugs).toEqual([
      "methode/faux-00-atelier-methode/01-le-pain-se-vend-d-abord-par-l-odeur",
      "methode/faux-00-atelier-methode/essentiel",
      "methode/faux-00-atelier-methode/02-le-calcul-de-la-fournee",
      "methode/faux-00-atelier-methode/03-le-parcours-en-etapes",
      "methode/faux-00-atelier-methode/04-les-phrases-du-comptoir",
      "methode/faux-00-atelier-methode/si-alors",
      "methode/faux-00-atelier-methode/cas-1-la-boulangere-du-marche",
      "methode/faux-00-atelier-methode/teste-toi",
    ]);
  });

  it("le noyau est reconnu par la forme de son slug, jamais par un titre écrit en dur", () => {
    expect(estSlugNoyau("methode/faux-00-atelier-methode/essentiel")).toBe(true);
    expect(estSlugNoyau("methode/faux-01-autre/essentiel")).toBe(false);
    expect(estSlugNoyau("methode/faux-00-atelier-methode/si-alors")).toBe(false);
  });

  it("la cellule « 4. Remercier » n'est PAS prise pour la section 4", () => {
    const parcours = sections.find((s) => s.slug.endsWith("/03-le-parcours-en-etapes"))!;
    expect(parcours.texte).toContain("4. Remercier");
  });

  it("le noyau contient l'essentiel ET le chemin, pas « Les idées clés »", () => {
    const noyau = sections.find((s) => estSlugNoyau(s.slug))!;
    expect(noyau.texte).toContain("vitrine chaleureuse");
    expect(noyau.texte).toContain("LE CHEMIN");
    expect(noyau.texte).not.toContain("Les idées clés");
  });

  it("le même texte redonne les mêmes slugs (idempotence de l'import)", () => {
    const encore = decouperFichier("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    expect(encore.map((s) => s.slug)).toEqual(slugs);
  });

  it("les artefacts de mise en page ne passent pas en base", () => {
    for (const s of sections) {
      expect(s.texte).not.toMatch(/^\d+ \/ \d+$/m);
      expect(s.texte).not.toContain("<!-- page");
    }
  });

  it("l'étiquette de livre ne repose sur aucune liste de titres ou d'auteurs", () => {
    for (const s of sections) {
      expect(s.etiquettes.some((e) => e.startsWith("livre:faux-"))).toBe(true);
    }
  });
});

describe("2 · séparation des chiffres", () => {
  const sections = decouperFichier("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);

  it("une section qui porte un montant reçoit chiffres-exercice et l'avertissement en tête", () => {
    const calcul = sections.find((s) => s.slug.endsWith("/02-le-calcul-de-la-fournee"))!;
    expect(calcul.etiquettes).toContain(ETIQUETTE_CHIFFRES);
    expect(calcul.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
  });

  it("une section sans montant n'est pas étiquetée", () => {
    const phrases = sections.find((s) => s.slug.endsWith("/04-les-phrases-du-comptoir"))!;
    expect(phrases.etiquettes).not.toContain(ETIQUETTE_CHIFFRES);
    expect(phrases.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(false);
  });

  it("une promesse de gain pose doctrine:a-revoir à l'import (double verrou)", () => {
    const [s] = decouperFichier(
      "livres/faux-promesse.md",
      ["# faux", "1. Une promesse", `${LONG} Un gain garanti pour chaque boulangerie.`].join("\n"),
    );
    expect(s!.etiquettes).toContain(ETIQUETTE_DOCTRINE);
  });

  it("une garantie à la première personne ou un pourcentage pose doctrine:a-revoir à l'import", () => {
    for (const phrase of [
      ["Je garan", "tis des gains."].join(""),
      ["Je rembour", "se tout."].join(""),
      ["Une hausse de 7", " % en un mois."].join(""),
    ]) {
      const [s] = decouperFichier(
        "livres/faux-promesse.md",
        ["# faux", "1. Une promesse", `${LONG} ${phrase}`].join("\n"),
      );
      expect(s!.etiquettes).toContain(ETIQUETTE_DOCTRINE);
    }
  });

  it("un montant sans devise (k, millions, dollars) pose chiffres-exercice à l'import", () => {
    for (const phrase of [
      ["Un exercice à 5", "k par mois."].join(""),
      ["Un chiffre de 2 ", "millions."].join(""),
      ["Un prix de $", "40."].join(""),
    ]) {
      const [s] = decouperFichier(
        "livres/faux-chiffre.md",
        ["# faux", "1. Un chiffre", `${LONG} ${phrase}`].join("\n"),
      );
      expect(s!.etiquettes).toContain(ETIQUETTE_CHIFFRES);
    }
  });
});

/** Dossier de travail partagé par les tests d'import. */
let racine = "";
function ecrire(rel: string, contenu: string): void {
  const p = path.join(racine, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, contenu);
}
beforeEach(() => {
  racine = mkdtempSync(path.join(tmpdir(), "faux-methode-"));
});
afterEach(() => rmSync(racine, { recursive: true, force: true }));

function cliDeps(surcharge: Partial<OptionsCli> = {}): OptionsCli & { lignes: string[] } {
  const lignes: string[] = [];
  return {
    fabriquerClient: vi.fn(),
    env: {},
    estTerminal: true,
    journal: (l: string) => lignes.push(l),
    erreur: (l: string) => lignes.push(l),
    lignes,
    ...surcharge,
  };
}

describe("3 · l'import refuse de démarrer sans --source", () => {
  it("sans --source : code ≠ 0, aucun client Prisma construit, rien de lu", async () => {
    const deps = cliDeps();
    expect(await executerCli([], deps)).not.toBe(0);
    expect(await executerCli(["--ecrire"], deps)).not.toBe(0);
    expect(deps.fabriquerClient).not.toHaveBeenCalled();
  });

  it("un chemin passé sans --source (forme positionnelle) est refusé", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const deps = cliDeps();
    expect(await executerCli([racine], deps)).not.toBe(0);
  });

  it("l'essai à blanc réussit et n'ouvre aucun client Prisma", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const deps = cliDeps();
    expect(await executerCli(["--source", racine], deps)).toBe(0);
    expect(deps.fabriquerClient).not.toHaveBeenCalled();
    expect(deps.lignes.join("\n")).toContain("ESSAI À BLANC");
  });
});

describe("4 · liste blanche des sous-dossiers", () => {
  it("seuls livres/*.md et livres/important-a-savoir/*.md sont lus ; le reste est ignoré et compté", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    ecrire("livres/important-a-savoir/faux-affiche.md", FICHE_AFFICHE);
    ecrire("livres/a-etudier/faux-etude.md", FICHE_FAUSSE);
    ecrire("secteurs/sante/faux-dossier.md", "# Faux\n\n## Un titre\n\nTexte inventé.\n");
    ecrire("livres-purs/faux-pur.md", FICHE_FAUSSE);
    ecrire("_controles/GLOBAL.md", "# faux controle\n\n## x\n\ny\n");
    ecrire("livres/LISEZ-MOI.md", "# notice");
    const lignes: string[] = [];
    const r = await executerImport({
      racine,
      ecrire: false,
      fabriquerClient: vi.fn(),
      journal: (l) => lignes.push(l),
    });
    const fichiers = new Set(r.sections.map((s) => s.fichier));
    expect(fichiers).toEqual(new Set(["faux-00-atelier-methode", "faux-affiche"]));
    expect(r.sections.every((s) => s.collection === COLLECTION_VENTE)).toBe(true);
    // a-etudier, secteurs, livres-purs, _controles = 4 fichiers hors liste blanche.
    expect(r.ignoresHorsListeBlanche).toBe(4);
    expect(lignes.join("\n")).toMatch(/hors liste blanche : 4/);
  });
});

describe("5 · fiche piégée refusée, jamais citée", () => {
  const PIEGE = [
    "# faux-piege",
    "1. Une section saine",
    `${LONG} Rien à signaler ici, texte inventé.`,
    "2. Une section au courriel",
    `${LONG} Écrire à ${COURRIEL} pour la suite.`,
    "3. Une section au téléphone",
    `${LONG} Appeler le ${TELEPHONE} le matin.`,
    "4. Une section au nom listé",
    `${LONG} Demander à ${NOM_SENSIBLE} de rappeler.`,
  ].join("\n");

  it("refuse les sections piégées, garde la saine ; journal = slug + motif, jamais le texte", async () => {
    ecrire("livres/faux-piege.md", PIEGE);
    const noms = path.join(racine, "noms-locaux.txt");
    writeFileSync(noms, `${NOM_SENSIBLE}\n`);
    const lignes: string[] = [];
    const r = await executerImport({
      racine,
      ecrire: false,
      nomsSensibles: [NOM_SENSIBLE],
      fabriquerClient: vi.fn(),
      journal: (l) => lignes.push(l),
    });
    expect(r.sections.map((s) => s.slug)).toEqual(["methode/faux-piege/01-une-section-saine"]);
    expect(r.refusees.map((x) => x.motif).sort()).toEqual([
      "courriel",
      "nom-sensible",
      "telephone",
    ]);
    const journal = lignes.join("\n");
    for (const secret of [COURRIEL, TELEPHONE, NOM_SENSIBLE, "Rien à signaler"]) {
      expect(journal).not.toContain(secret);
    }
    expect(journal).toContain("methode/faux-piege/02-une-section-au-courriel");
  });

  it("--noms-sensibles lit un fichier local, un nom par ligne", async () => {
    ecrire("livres/faux-piege.md", PIEGE);
    const noms = path.join(racine, "noms-locaux.txt");
    writeFileSync(noms, `\n${NOM_SENSIBLE}\n`);
    const deps = cliDeps();
    expect(await executerCli(["--source", racine, "--noms-sensibles", noms], deps)).toBe(0);
    const journal = deps.lignes.join("\n");
    expect(journal).toContain("nom-sensible");
    expect(journal).not.toContain(NOM_SENSIBLE);
  });
});

describe("6 · --ecrire est un geste humain", () => {
  const BASE = ["postgresql://utilisateur", "base.exemple.invalid:5432/faux"].join("@");

  it("refusé quand CI est posé", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const deps = cliDeps({ env: { CI: "true", DATABASE_URL: BASE } });
    expect(await executerCli(["--source", racine, "--ecrire"], deps)).not.toBe(0);
    expect(deps.fabriquerClient).not.toHaveBeenCalled();
  });

  it("refusé sans terminal (entrée standard redirigée)", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const deps = cliDeps({ env: { DATABASE_URL: BASE }, estTerminal: false });
    expect(await executerCli(["--source", racine, "--ecrire"], deps)).not.toBe(0);
    expect(deps.fabriquerClient).not.toHaveBeenCalled();
  });

  it("accepté avec terminal et sans CI : les entrées écrites sont team / internal / approved, jamais publiées", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const creees: Array<Record<string, unknown>> = [];
    const fake = {
      knowledgeTag: { upsert: async () => ({ id: "t" }) },
      knowledgeCollection: { upsert: async () => ({ id: "c" }) },
      knowledgeCollectionItem: {
        findUnique: async () => null,
        aggregate: async () => ({ _max: { position: null } }),
        create: async () => ({}),
      },
      knowledgeEntry: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async (a: { data: Record<string, unknown> }) => {
          creees.push(a.data);
          return { id: `e${String(creees.length)}` };
        },
      },
      knowledgeTranslation: { create: async () => ({}), update: async () => ({}) },
      knowledgeTagOnEntry: { upsert: async () => ({}) },
      $disconnect: async () => undefined,
    };
    const deps = cliDeps({
      env: { DATABASE_URL: BASE },
      fabriquerClient: vi.fn(async () => fake as never),
    });
    expect(await executerCli(["--source", racine, "--ecrire"], deps)).toBe(0);
    expect(creees.length).toBeGreaterThan(0);
    for (const d of creees) {
      expect(d).toMatchObject({
        audience: "team",
        confidentiality: "internal",
        status: "approved",
        sourceFactoryId: "methode-import",
      });
      expect(d).not.toHaveProperty("publishedAt");
    }
  });

  it("la base factice « stub.invalid » est refusée", async () => {
    ecrire("livres/faux-00-atelier-methode.md", FICHE_FAUSSE);
    const deps = cliDeps({
      env: { DATABASE_URL: ["postgresql://a:b", "stub.invalid:5432/x"].join("@") },
    });
    expect(await executerCli(["--source", racine, "--ecrire"], deps)).not.toBe(0);
    expect(deps.fabriquerClient).not.toHaveBeenCalled();
  });
});

describe("7 · interrupteur éteint = neutre", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("methodeActive : faux pour absent, « 1 », « TRUE », « oui » ; vrai seulement pour « true »", () => {
    vi.stubEnv("METHODE_ACTIVE", "");
    expect(methodeActive()).toBe(false);
    for (const v of ["1", "TRUE", "True", "oui", " true"]) {
      vi.stubEnv("METHODE_ACTIVE", v);
      expect(methodeActive()).toBe(false);
    }
    vi.stubEnv("METHODE_ACTIVE", "true");
    expect(methodeActive()).toBe(true);
  });

  it("éteint : contexte neutre, base jamais interrogée", async () => {
    for (const v of ["", "1", "TRUE", "oui"]) {
      vi.stubEnv("METHODE_ACTIVE", v);
      const ctx = await obtenirContexteMethode({ sujet: "objection prix" });
      expect(ctx).toEqual(CONTEXTE_NEUTRE);
      expect(ctx).toEqual({ noyau: null, extraits: [] });
    }
    expect(findManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("allumé : la recherche ne vise que l'audience équipe, approved, issue de l'import, collection vente", async () => {
    vi.stubEnv("METHODE_ACTIVE", "true");
    findManyMock.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([]);
    await obtenirContexteMethode({ sujet: "relance du matin" });
    const sql = queryRawMock.mock.calls[0]![0] as string;
    expect(sql).toContain(`ke.audience = 'team'`);
    expect(sql).toContain(`ke.status = 'approved'`);
    expect(sql).toContain("methode-import");
    expect(sql).not.toContain("published");
    expect(queryRawMock.mock.calls[0]![2]).toEqual([COLLECTION_VENTE]);
  });

  it("une panne de base rend le contexte neutre, sans exception", async () => {
    vi.stubEnv("METHODE_ACTIVE", "true");
    findManyMock.mockRejectedValue(new Error("base absente"));
    queryRawMock.mockRejectedValue(new Error("base absente"));
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await obtenirContexteMethode({ sujet: "relance" })).toEqual(CONTEXTE_NEUTRE);
    avertir.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  8 · DÉCISION DU PILOTE (18/11) : approbation à la main, section par section
// ─────────────────────────────────────────────────────────────────────────────

describe("8 · la marque d'approbation vient du corpus, et de lui seul", () => {
  const MARQUE = "sortie: validee";

  /** Format PDF : la marque est la première ligne SOUS le titre de la section. */
  const PDF = [
    "# faux-marque-pdf",
    "1. Une section approuvée",
    MARQUE,
    LONG,
    "2. Une section jamais relue",
    LONG,
    "3. Une marque cachée dans le corps",
    LONG,
    MARQUE,
    "4. Une marque en variante de casse",
    "Sortie: validee",
    LONG,
  ].join("\n");

  /** Format Markdown (titres #, ##) : même règle. */
  const MD = [
    "# Un dossier inventé",
    "## Approuvée",
    MARQUE,
    LONG,
    "## Jamais relue",
    LONG,
    "## Marque dans le corps",
    LONG,
    MARQUE,
    "## Marque en variante d'espace",
    "sortie:  validee",
    LONG,
  ].join("\n");

  it("PDF : seule la section dont la première ligne est la marque est approuvée", () => {
    const s = decouperFichier("livres/faux-marque-pdf.md", PDF);
    expect(s.map((x) => x.approuvee)).toEqual([true, false, false, false]);
    expect(s[0]!.texte.startsWith(`${MARQUE}\n`)).toBe(true);
  });

  it("Markdown : seule la section dont la première ligne est la marque est approuvée", () => {
    const s = decouperFichier("livres/faux-marque-md.md", MD);
    expect(s.map((x) => x.approuvee)).toEqual([true, false, false, false]);
    expect(s[0]!.texte.startsWith(`${MARQUE}\n`)).toBe(true);
  });

  it("l'import ne pose JAMAIS la marque : un corpus sans marque n'en produit aucune", () => {
    for (const [nom, contenu] of [
      ["livres/faux-00-atelier-methode.md", FICHE_FAUSSE],
      ["livres/important-a-savoir/faux-affiche.md", FICHE_AFFICHE],
      ["livres/faux-md.md", MD.replaceAll(MARQUE, "")],
    ] as const) {
      const sections = decouperFichier(nom, contenu);
      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) {
        expect(s.approuvee, s.slug).toBe(false);
        expect(s.texte, s.slug).not.toContain(MARQUE);
        expect(s.etiquettes.join(" "), s.slug).not.toContain("validee");
      }
    }
  });

  it("l'import ne déduit pas la marque : une section saine, sans marque, reste non approuvée", () => {
    const [s] = decouperFichier(
      "livres/faux-sain.md",
      ["# faux-sain", "1. Une section très saine", LONG].join("\n"),
    );
    expect(s!.signalements).toEqual([]);
    expect(s!.etiquettes).not.toContain(ETIQUETTE_DOCTRINE);
    expect(s!.approuvee).toBe(false);
  });

  it("l'avertissement « chiffres » ne déplace pas la marque ni ne la fait disparaître", () => {
    const [s] = decouperFichier(
      "livres/faux-chiffres.md",
      ["# faux-chiffres", "1. Un calcul", MARQUE, `${LONG} Exercice à ${MONTANT} par an.`].join(
        "\n",
      ),
    );
    expect(s!.etiquettes).toContain(ETIQUETTE_CHIFFRES);
    expect(s!.texte.startsWith(`${MARQUE}\n`)).toBe(true);
    expect(s!.texte).toContain(AVERTISSEMENT_CHIFFRES);
  });

  it("le texte écrit en base est celui du corpus, marque comprise ou absente", async () => {
    ecrire("livres/faux-marque-pdf.md", PDF);
    ecrire("livres/faux-sans-marque.md", ["# faux-sans-marque", "1. Une section", LONG].join("\n"));
    const textes: string[] = [];
    const fake = {
      knowledgeTag: { upsert: async () => ({ id: "t" }) },
      knowledgeCollection: { upsert: async () => ({ id: "c" }) },
      knowledgeCollectionItem: {
        findUnique: async () => null,
        aggregate: async () => ({ _max: { position: null } }),
        create: async () => ({}),
      },
      knowledgeEntry: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async (a: { data: { translations?: { create?: { bodyText?: string } } } }) => {
          const t = a.data.translations?.create?.bodyText;
          if (typeof t === "string") textes.push(t);
          return { id: "e" };
        },
      },
      knowledgeTranslation: {
        create: async (a: { data: { bodyText?: string } }) => {
          if (typeof a.data.bodyText === "string") textes.push(a.data.bodyText);
          return {};
        },
        update: async () => ({}),
      },
      knowledgeTagOnEntry: { upsert: async () => ({}) },
      $disconnect: async () => undefined,
    };
    const BASE = ["postgresql://utilisateur", "base.exemple.invalid:5432/faux"].join("@");
    const deps = cliDeps({
      env: { DATABASE_URL: BASE },
      fabriquerClient: vi.fn(async () => fake as never),
    });
    expect(await executerCli(["--source", racine, "--ecrire"], deps)).toBe(0);
    // 4 sections du premier fichier + 1 du second ; la marque n'est écrite que là où le corpus la porte
    expect(textes).toHaveLength(5);
    expect(textes.filter((t) => t.startsWith(`${MARQUE}\n`))).toHaveLength(1);
    expect(textes.filter((t) => t.includes(MARQUE) && !t.startsWith(`${MARQUE}\n`))).toHaveLength(
      1,
    );
  });

  it("aucune fonction du code ne peut poser la marque : le littéral n'existe que dans decoupage.ts, et seulement pour LIRE", () => {
    const racineDepot = path.resolve(__dirname, "../../../..");
    const fichiers = [
      "src/server/methode/filtre-sortie.ts",
      "src/server/methode/index.ts",
      "scripts/methode/importer-methode.ts",
      "src/server/actions/knowledge/_transition.ts",
    ];
    for (const f of fichiers) {
      const src = readFileSync(path.join(racineDepot, f), "utf8");
      expect(src, f).not.toContain("sortie: validee");
      expect(src, f).not.toMatch(/MARQUE_APPROBATION(?!\s*[,}])/);
    }
    const dec = readFileSync(path.join(racineDepot, "src/server/methode/decoupage.ts"), "utf8");
    // la constante ne sert qu'à comparer ou à retirer : jamais à concaténer ni à écrire
    const usages = dec
      .split("\n")
      .filter((l) => /MARQUE_APPROBATION/.test(l) && !/^\s*(\*|\/\/)/.test(l));
    for (const l of usages) {
      expect(l, l).not.toMatch(
        /\+\s*MARQUE_APPROBATION|MARQUE_APPROBATION\s*\+|\$\{MARQUE_APPROBATION\}\\?n?`|\.concat\(/,
      );
    }
  });
});

describe("9 · tour 1 de relecture : la tête de section vient du corpus, brute", () => {
  const MARQUE = "sortie: validee";
  const LS = String.fromCharCode(0x2028);
  const tetes = [
    `   ${MARQUE}`,
    `\t${MARQUE}`,
    `${String.fromCharCode(0xfeff)}${MARQUE}`,
    `${String.fromCharCode(0xa0)}${MARQUE}`,
    `${String.fromCharCode(0x3000)}${MARQUE}`,
    `${LS}${MARQUE}`,
  ];

  it("retrait, tabulation, BOM, insécable, idéographique, séparateur de ligne : jamais approuvée", () => {
    for (const tete of tetes) {
      const [s] = decouperFichier(
        "livres/faux-tete.md",
        ["# faux-tete", "1. Une section factice", tete, LONG].join("\n"),
      );
      expect(s!.approuvee, JSON.stringify(tete)).toBe(false);
      expect(s!.texte.startsWith(`${MARQUE}\n`), JSON.stringify(tete)).toBe(false);
    }
  });

  it("une ligne « # » intercalée sous le titre ne fait pas remonter la marque", () => {
    const [s] = decouperFichier(
      "livres/faux-titre-h.md",
      ["# faux-titre-h", "1. Une section factice", "# une note inventée", MARQUE, LONG].join("\n"),
    );
    expect(s!.approuvee).toBe(false);
    expect(s!.texte.startsWith(`${MARQUE}\n`)).toBe(false);
  });

  it("un encadré « essentiel » sans terminateur n'est pas approuvé et n'avale pas les sections suivantes", () => {
    const sections = decouperFichier(
      "livres/faux-00-sans-fin.md",
      [
        "# faux-00-sans-fin",
        "L'ESSENTIEL EN 30 SECONDES",
        MARQUE,
        "Un résumé banal.",
        "1. Une section jamais relue",
        LONG,
        "2. Une autre section jamais relue",
        LONG,
      ].join("\n"),
    );
    const noyau = sections.find((x) => x.slug.endsWith("/essentiel"))!;
    expect(noyau.approuvee).toBe(false);
    expect(noyau.texte).not.toContain("jamais relue");
    expect(sections.filter((x) => x.approuvee)).toEqual([]);
  });

  it("Markdown : un titre dans un bloc de code ne crée pas de section approuvée", () => {
    for (const cloture of ["```", "~~~"]) {
      const sections = decouperFichier(
        "livres/faux-code.md",
        [
          "## A",
          "Texte non marqué.",
          cloture,
          "## Exemple",
          MARQUE,
          "Texte d'exemple jamais approuvé.",
          cloture,
        ].join("\n"),
      );
      expect(sections.filter((x) => x.approuvee)).toEqual([]);
    }
  });

  it("montants masqués par un trait conditionnel, une espace sans chasse ou des lettres voisines", () => {
    const shy = String.fromCharCode(0xad);
    const zw = String.fromCharCode(0x200b);
    expect(contientMontant(["2400", `eu${shy}ros`].join(" "))).toBe(true);
    expect(contientMontant(["2400", `eu${zw}ros`].join(" "))).toBe(true);
    expect(contientMontant(["2400", `${String.fromCharCode(0x435)}uros`].join(" "))).toBe(true);
    expect(contientMontant("Accueillir le client, puis l'écouter.")).toBe(false);
  });

  it("réimport : une entrée refusée ou disparue perd sa marque en base, sans être supprimée", async () => {
    const maj: Array<{ id: string; bodyText: string }> = [];
    const fake = {
      knowledgeEntry: {
        findMany: async () => [
          {
            slug: "methode/faux-a/gardee",
            translations: [{ id: "t1", bodyText: `${MARQUE}\nUn.` }],
          },
          {
            slug: "methode/faux-a/refusee",
            translations: [{ id: "t2", bodyText: `${MARQUE}\nDeux.` }],
          },
          { slug: "methode/faux-a/sans", translations: [{ id: "t3", bodyText: "Trois." }] },
        ],
      },
      knowledgeTranslation: {
        update: async (a: { where: { id: string }; data: { bodyText: string } }) => {
          maj.push({ id: a.where.id, bodyText: a.data.bodyText });
          return {};
        },
      },
    };
    const n = await neutraliserAbsentes(fake as never, new Set(["methode/faux-a/gardee"]));
    expect(n).toBe(1);
    expect(maj).toEqual([{ id: "t2", bodyText: "Deux." }]);
  });
});

describe("10 · tour 2 de relecture : la marque touche son titre dans le corpus brut", () => {
  const M = "sortie: validee";
  const approuvees = (nom: string, lignes: string[]) =>
    decouperFichier(nom, lignes.join("\n")).filter((x) => x.approuvee);
  const jamais = (nom: string, lignes: string[]) => expect(approuvees(nom, lignes)).toEqual([]);

  it("une ligne supprimée ou sautée entre le titre et la marque : jamais approuvée", () => {
    for (const intercalee of [
      "<!-- page 2 -->",
      "1 / 3",
      "AXION IA · bas de page inventé",
      "Source : Google Drive inventé",
      "Appliqué à AXION IA",
      "Les idées clés",
    ]) {
      jamais("livres/faux-inter.md", ["# faux-inter", "1. Premier titre", intercalee, M, LONG]);
    }
    jamais("livres/faux-cas.md", [
      "# faux-cas",
      "Mises en situation",
      "Cas 1 — Un faux cas",
      "MISE EN SITUATION",
      M,
      LONG,
    ]);
    jamais("livres/important-a-savoir/faux-aff.md", ["<!-- page 1 -->", "2 / 5", M, LONG]);
    jamais("livres/faux-suite.md", [
      "# faux-suite",
      "1. Premier titre",
      "L'ESSENTIEL EN 30 SECONDES",
      "Un résumé.",
      "Les idées clés",
      M,
      LONG,
    ]);
  });

  it("titre puis marque sur la ligne suivante : approuvée (témoin positif)", () => {
    expect(
      approuvees("livres/faux-ok.md", ["# faux-ok", "1. Premier titre", M, LONG]),
    ).toHaveLength(1);
    expect(
      approuvees("livres/faux-ok-md.md", ["## Un titre", M, LONG, "## Un autre", LONG]),
    ).toHaveLength(1);
  });

  it("une fiche PDF avec une ligne « ## » dans un bloc de code reste PDF et n'avale rien", () => {
    const s = decouperFichier(
      "livres/faux-mixte.md",
      [
        "# Faux",
        "1. Premier titre",
        M,
        LONG,
        "2. Second titre non relu",
        LONG,
        "```",
        "## exemple",
        "```",
      ].join("\n"),
    );
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.filter((x) => x.approuvee && x.texte.includes("non relu"))).toEqual([]);
  });

  it("fichier mêlant titres « ## » et sections « N. » : ambigu, aucune section approuvée", () => {
    jamais("livres/faux-ambigu.md", [
      "## Un titre",
      M,
      LONG,
      "1. Premier titre",
      LONG,
      "2. Second titre",
      LONG,
    ]);
  });

  it("Markdown : clôture plus courte, commentaire HTML, titre indenté ou setext n'approuvent rien de caché", () => {
    const cas: string[][] = [
      ["## A", M, "Corps A.", "````", "```", "## B", M, "Corps B non relu.", "````"],
      ["## A", M, "Corps A.", "<!--", "## B", M, "Corps B non relu.", "-->"],
      ["## A", M, "Corps A.", "  ## B", "Corps B non relu."],
      ["## A", M, "Corps A.", "B", "---", "Corps B non relu."],
      ["## A", M, "Corps A.", "### Un sous-titre", "Corps B non relu."],
    ];
    for (const c of cas) {
      const s = decouperFichier("livres/faux-cm.md", c.join("\n"));
      expect(
        s.filter((x) => x.approuvee && x.texte.includes("non relu")),
        c.join("|"),
      ).toEqual([]);
      expect(s.filter((x) => x.approuvee && /^## B/m.test(x.texte))).toEqual([]);
    }
  });

  it("marque doublée : retirerMarque ne laisse jamais une entrée approuvée", async () => {
    expect(estApprouvee(retirerMarque(`${M}\n${M}\nTexte.`))).toBe(false);
    const maj: string[] = [];
    const fake = {
      knowledgeEntry: {
        findMany: async () => [
          { slug: "methode/faux-a/x", translations: [{ id: "t", bodyText: `${M}\n${M}\nTexte.` }] },
        ],
      },
      knowledgeTranslation: {
        update: async (a: { data: { bodyText: string } }) => {
          maj.push(a.data.bodyText);
          return {};
        },
      },
    };
    await neutraliserAbsentes(fake as never, new Set());
    expect(maj).toHaveLength(1);
    expect(estApprouvee(maj[0]!)).toBe(false);
  });
});

describe("11 · tour 4 : une ligne sautée ou avalée dans une section marquée la neutralise ENTIÈREMENT", () => {
  const M = "sortie: validee";
  const sections = (lignes: string[]) =>
    decouperFichier("livres/faux-quatre.md", lignes.join("\n"));
  const servies = (lignes: string[]) => sections(lignes).filter((x) => x.approuvee);
  const aucuneServie = (lignes: string[]) => expect(servies(lignes), lignes.join("|")).toEqual([]);

  it("B1 : une ligne « # » au milieu d'une section marquée : la section n'est pas servie", () => {
    aucuneServie([
      "# faux-quatre",
      "1. Premier titre",
      M,
      LONG,
      "# Autre titre",
      "Texte non relu.",
    ]);
    aucuneServie(["# faux-quatre", "1. Premier titre", M, "# Autre titre", LONG]);
    aucuneServie(["# faux-quatre", "1. Premier titre", M, LONG, "# Autre titre"]);
  });

  it("B2 : un titre « N. » avalé dans le corps (question, numéro sauté) neutralise la section", () => {
    aucuneServie([
      "# faux-quatre",
      "1. Premier titre",
      M,
      LONG,
      "2. Un titre en forme de question ?",
      "Court.",
      "Texte non relu.",
      "3. Suivant",
      LONG,
    ]);
    aucuneServie([
      "# faux-quatre",
      "1. Premier titre",
      M,
      LONG,
      "3. Numéro sauté",
      LONG,
      "Texte non relu.",
    ]);
    // la section avalée en cascade n'est pas servie non plus
    expect(
      servies(["# faux-quatre", "1. Premier titre", M, LONG, "3. Numéro sauté", M, LONG]),
    ).toEqual([]);
  });

  it("B3 : une étiquette de mise en page sautée neutralise la section", () => {
    for (const etiquette of ["Appliqué à AXION IA", "Les idées clés"]) {
      aucuneServie(["# faux-quatre", "1. Premier titre", M, LONG, etiquette, "Texte non relu."]);
    }
  });

  it("B3 : la ligne « MISE EN SITUATION » sautée dans un cas marqué le neutralise", () => {
    aucuneServie([
      "# faux-quatre",
      "Mises en situation",
      "Cas 1 — Un faux cas",
      M,
      LONG,
      "MISE EN SITUATION",
      "Texte non relu.",
    ]);
  });

  it("B3 : l'encadré qui coupe une section marquée la neutralise (fusion « -suite »)", () => {
    aucuneServie([
      "# faux-quatre",
      "1. Premier titre",
      M,
      LONG,
      "L'ESSENTIEL EN 30 SECONDES",
      "Un résumé.",
      "Les idées clés",
      "Suite non relue.",
    ]);
  });

  it("témoin positif : une section marquée, intacte, reste servie", () => {
    expect(
      servies(["# faux-quatre", "1. Premier titre", M, LONG, "2. Second titre", LONG]),
    ).toHaveLength(1);
  });
});
