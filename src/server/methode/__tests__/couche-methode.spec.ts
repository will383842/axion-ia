import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
} from "../decoupage";
import { CONTEXTE_NEUTRE, methodeActive, obtenirContexteMethode } from "../index";
import {
  executerCli,
  executerImport,
  type OptionsCli,
} from "../../../../scripts/methode/importer-methode";

const EURO = "€";
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
  "AXION IA · Plus de performance, moins de charges",
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
      ["# faux", "1. Une promesse", `${LONG} Le gain est garanti pour chaque boulangerie.`].join(
        "\n",
      ),
    );
    expect(s!.etiquettes).toContain(ETIQUETTE_DOCTRINE);
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
  const BASE = "postgresql://utilisateur@base.exemple.invalid:5432/faux";

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
    const deps = cliDeps({ env: { DATABASE_URL: "postgresql://a:b@stub.invalid:5432/x" } });
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
