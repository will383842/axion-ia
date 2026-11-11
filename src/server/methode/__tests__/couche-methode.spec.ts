import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **COUCHE « MÉTHODE » (ADR 0076) — CE QUI NE DOIT JAMAIS BOUGER.**
 *
 *   1. le découpage rend des slugs STABLES `methode/<fichier>/<section>` ;
 *   2. toute section qui porte un montant est étiquetée `chiffres-exercice`
 *      et commence par l'avertissement ;
 *   3. l'essai à blanc n'ouvre même pas de client Prisma ;
 *   4. interrupteur éteint = contexte neutre, sans toucher la base ;
 *   5. la santé ne sort jamais sans `secteur: "sante"`.
 */

const findFirstMock = vi.fn();
const queryRawMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: { findFirst: (...a: unknown[]) => findFirstMock(...a) },
    $queryRawUnsafe: (...a: unknown[]) => queryRawMock(...a),
  },
}));

import {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  decouperFichier,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
  SLUG_NOYAU,
} from "../decoupage";
import { CONTEXTE_NEUTRE, obtenirContexteMethode } from "../index";
import { executerImport } from "../../../../scripts/methode/importer-methode";
import { blocMethodePourPromptSysteme } from "@/server/content-gen/methode-commerciale";

const LONG =
  "Ce paragraphe d'explication est assez long pour ressembler à une vraie ligne de fiche PDF.";

/** Une fiche « livre appliqué » minimale, à la forme exacte des extractions du Drive. */
const FICHE_00 = [
  "# 00-AXION-IA-Methode-de-vente",
  "",
  "Source : Google Drive « Livres savoir par cœur » (compte Axion-IA), copie du 1, 2 pages.",
  "",
  "<!-- page 1 -->",
  "",
  "1 / 2",
  "AXION IA · Plus de performance, moins de charges",
  "1. Dire non doit coûter plus cher que dire oui",
  LONG,
  "L'ESSENTIEL EN 30 SECONDES",
  "Dire non doit coûter plus cher que dire oui.",
  "LE CHEMIN",
  "Se positionner et attirer.",
  "Les idées clés",
  "",
  "<!-- page 2 -->",
  "2. Les calculs à connaître par cœur",
  `${LONG} Perte : 10 h × 35 € × 45 = 15 750 € par an.`,
  "3. Le parcours en étapes",
  LONG,
  "1. Se positionner",
  "Court fragment",
  "2. Comprendre",
  "Court fragment",
  "3. Construire",
  "Court fragment",
  "4. Formuler le message",
  "Court fragment de cellule",
  "4. Les scripts par étape",
  LONG,
  "Si… alors…",
  "Un client dit trop cher, alors je me tais.",
  "Mises en situation",
  "MISE EN SITUATION",
  "Cas 1 — Le menuisier croisé à un déjeuner",
  "Contexte : un salon près de Grenoble.",
  "Teste-toi",
  "1. Combien perd-il par an ?",
].join("\n");

describe("1 · découpage et slugs stables", () => {
  const sections = decouperFichier("livres/00-AXION-IA-Methode-de-vente.md", FICHE_00);
  const slugs = sections.map((s) => s.slug);

  it("rend les sections attendues, dans l'ordre, sous methode/<fichier>/<section>", () => {
    expect(slugs).toEqual([
      "methode/00-axion-ia-methode-de-vente/01-dire-non-doit-couter-plus-cher-que-dire-oui",
      SLUG_NOYAU,
      "methode/00-axion-ia-methode-de-vente/02-les-calculs-a-connaitre-par-coeur",
      "methode/00-axion-ia-methode-de-vente/03-le-parcours-en-etapes",
      "methode/00-axion-ia-methode-de-vente/04-les-scripts-par-etape",
      "methode/00-axion-ia-methode-de-vente/si-alors",
      "methode/00-axion-ia-methode-de-vente/cas-1-le-menuisier-croise-a-un-dejeuner",
      "methode/00-axion-ia-methode-de-vente/teste-toi",
    ]);
  });

  it("la cellule « 4. Formuler le message » n'est PAS prise pour la section 4", () => {
    const parcours = sections.find((s) => s.slug.endsWith("/03-le-parcours-en-etapes"))!;
    expect(parcours.texte).toContain("4. Formuler le message");
  });

  it("le noyau contient l'essentiel ET le chemin, pas « Les idées clés »", () => {
    const noyau = sections.find((s) => s.slug === SLUG_NOYAU)!;
    expect(noyau.texte).toContain("Dire non doit coûter plus cher que dire oui.");
    expect(noyau.texte).toContain("LE CHEMIN");
    expect(noyau.texte).not.toContain("Les idées clés");
  });

  it("le même texte redonne les mêmes slugs (idempotence de l'import)", () => {
    const encore = decouperFichier("livres/00-AXION-IA-Methode-de-vente.md", FICHE_00);
    expect(encore.map((s) => s.slug)).toEqual(slugs);
  });

  it("les artefacts de mise en page (pagination, bandeau) ne passent pas en base", () => {
    for (const s of sections) {
      expect(s.texte).not.toMatch(/^\d+ \/ \d+$/m);
      expect(s.texte).not.toContain("<!-- page");
    }
  });

  it("une fiche qui dit « Grenoble » est étiquetée doctrine:a-revoir", () => {
    const cas = sections.find((s) => s.slug.includes("/cas-1-"))!;
    expect(cas.etiquettes).toContain(ETIQUETTE_DOCTRINE);
    expect(cas.signalements).toContain("grenoble");
  });
});

describe("2 · séparation des chiffres", () => {
  const sections = decouperFichier("livres/00-AXION-IA-Methode-de-vente.md", FICHE_00);

  it("une section qui porte un montant en € reçoit chiffres-exercice et l'avertissement en tête", () => {
    const calculs = sections.find((s) => s.slug.endsWith("/02-les-calculs-a-connaitre-par-coeur"))!;
    expect(calculs.etiquettes).toContain(ETIQUETTE_CHIFFRES);
    expect(calculs.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
  });

  it("une section sans montant n'est pas étiquetée", () => {
    const scripts = sections.find((s) => s.slug.endsWith("/04-les-scripts-par-etape"))!;
    expect(scripts.etiquettes).not.toContain(ETIQUETTE_CHIFFRES);
    expect(scripts.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(false);
  });
});

describe("3 · l'essai à blanc n'écrit rien", () => {
  let racine = "";
  beforeEach(() => {
    racine = mkdtempSync(path.join(tmpdir(), "methode-"));
    mkdirSync(path.join(racine, "livres"), { recursive: true });
    mkdirSync(path.join(racine, "secteurs", "sante"), { recursive: true });
    writeFileSync(path.join(racine, "livres", "00-AXION-IA-Methode-de-vente.md"), FICHE_00);
    writeFileSync(path.join(racine, "livres", "LISEZ-MOI.md"), "# notice");
    writeFileSync(
      path.join(racine, "secteurs", "sante", "Dossier.md"),
      "# Santé\n\n## Dentistes\n\nTexte santé.\n",
    );
    writeFileSync(path.join(racine, "secteurs", "sante", "Dossier-extrait-pdf.md"), "# x\n## y\nz");
  });
  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  it("sans --ecrire, aucun client Prisma n'est construit", async () => {
    const fabriquerClient = vi.fn();
    const journal: string[] = [];
    const { sections, bilan } = await executerImport({
      racine,
      ecrire: false,
      fabriquerClient,
      journal: (l) => journal.push(l),
    });
    expect(fabriquerClient).not.toHaveBeenCalled();
    expect(bilan).toBeNull();
    expect(sections.length).toBeGreaterThan(0);
    expect(journal.join("\n")).toContain("ESSAI À BLANC");
  });

  it("la notice et l'extraction PDF santé sont ignorées ; le dossier santé va à part", async () => {
    const { sections } = await executerImport({
      racine,
      ecrire: false,
      fabriquerClient: vi.fn(),
      journal: () => undefined,
    });
    expect(sections.some((s) => s.fichier.includes("lisez-moi"))).toBe(false);
    expect(sections.some((s) => s.fichier.includes("extrait-pdf"))).toBe(false);
    const sante = sections.filter((s) => s.fichier === "dossier");
    expect(sante.length).toBeGreaterThan(0);
    for (const s of sante) {
      expect(s.collection).toBe(COLLECTION_SANTE);
      expect(s.etiquettes).toContain(ETIQUETTE_SANTE);
    }
    for (const s of sections.filter((x) => x.fichier !== "dossier")) {
      expect(s.collection).toBe(COLLECTION_VENTE);
    }
  });
});

describe("4 · interrupteur éteint = neutre", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    queryRawMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("METHODE_ACTIVE absent : contexte vide, base jamais interrogée", async () => {
    vi.stubEnv("METHODE_ACTIVE", "");
    const ctx = await obtenirContexteMethode({ sujet: "objection prix" });
    expect(ctx).toEqual(CONTEXTE_NEUTRE);
    expect(ctx).toEqual({ noyau: null, extraits: [] });
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("toute valeur autre que « true » laisse la couche éteinte", async () => {
    vi.stubEnv("METHODE_ACTIVE", "1");
    expect(await obtenirContexteMethode({ sujet: "relance" })).toEqual(CONTEXTE_NEUTRE);
  });

  it("content-gen : rien n'est injecté, éteint ou pour un contenu non commercial", async () => {
    vi.stubEnv("METHODE_ACTIVE", "");
    expect(await blocMethodePourPromptSysteme("mail")).toBe("");
    vi.stubEnv("METHODE_ACTIVE", "true");
    expect(await blocMethodePourPromptSysteme("article")).toBe("");
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});

describe("5 · le secteur santé reste à part", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    findFirstMock.mockResolvedValue({
      slug: SLUG_NOYAU,
      translations: [{ title: "Essentiel", bodyText: "Dire non doit coûter plus cher." }],
    });
    queryRawMock.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  function parametres(): { collections: string[]; exclues: string[] } {
    const appel = queryRawMock.mock.calls[0]!;
    return { collections: appel[2] as string[], exclues: appel[5] as string[] };
  }

  it("sans secteur : collection santé absente ET étiquette santé exclue", async () => {
    const ctx = await obtenirContexteMethode({ sujet: "objection prix" });
    expect(ctx.noyau?.slug).toBe(SLUG_NOYAU);
    const { collections, exclues } = parametres();
    expect(collections).toEqual([COLLECTION_VENTE]);
    expect(exclues).toContain(ETIQUETTE_SANTE);
    expect(exclues).toContain(ETIQUETTE_DOCTRINE);
  });

  it("un autre secteur n'ouvre pas la santé", async () => {
    await obtenirContexteMethode({ sujet: "objection prix", secteur: "btp" });
    expect(parametres().collections).not.toContain(COLLECTION_SANTE);
  });

  it("secteur « sante » : la collection santé s'ouvre, la doctrine reste exclue", async () => {
    await obtenirContexteMethode({ sujet: "rendez-vous patient", secteur: "sante" });
    const { collections, exclues } = parametres();
    expect(collections).toEqual([COLLECTION_VENTE, COLLECTION_SANTE]);
    expect(exclues).not.toContain(ETIQUETTE_SANTE);
    expect(exclues).toContain(ETIQUETTE_DOCTRINE);
  });

  it("la recherche ne vise que l'audience équipe au statut approved", async () => {
    await obtenirContexteMethode({ sujet: "objection prix" });
    const sql = queryRawMock.mock.calls[0]![0] as string;
    expect(sql).toContain(`ke.audience = 'team'`);
    expect(sql).toContain(`ke.status = 'approved'`);
    expect(sql).not.toContain("published");
  });

  it("une panne de base rend le contexte neutre, sans exception", async () => {
    queryRawMock.mockRejectedValue(new Error("base absente"));
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await obtenirContexteMethode({ sujet: "relance" })).toEqual(CONTEXTE_NEUTRE);
    avertir.mockRestore();
  });
});
