import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **LE FILTRE DE SORTIE (ADR 0076) — RIEN D'INTERDIT NE SORT.**
 *
 * Corpus entièrement FAUX et inventé. Les montants, courriels et téléphones sont
 * fabriqués à l'exécution : aucun n'est écrit en clair dans ce fichier.
 */

const findManyMock = vi.fn();
const queryRawMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: { findMany: (...a: unknown[]) => findManyMock(...a) },
    $queryRawUnsafe: (...a: unknown[]) => queryRawMock(...a),
  },
}));

import { ETIQUETTE_CHIFFRES, ETIQUETTE_DOCTRINE, ETIQUETTE_SANTE } from "../decoupage";
import { obtenirContexteMethode, filtrerPourSortie } from "../index";
import { contientCourriel, contientTelephone, motifRefus } from "../filtre-sortie";

const EURO = String.fromCharCode(0x20ac);
const MONTANT = `${["4", "200"].join(" ")} ${EURO}`;
const COURRIEL = ["faux.nom", "exemple.invalid"].join("@");
const TELEPHONE = ["06", "12", "34", "56", "78"].join(" ");
/** Le nom de la ville du siège n'est écrit nulle part : on déclenche le motif « ancrage local ». */
const ANCRAGE = "Axion-IA est basée à l'étage du fond";
const SLUG_NOYAU_FAUX = "methode/faux-00-atelier/essentiel";

function fiche(texte: string, etiquettes: string[] = [], titre = "Un titre inventé") {
  return { slug: "methode/faux-atelier/une-fiche", titre, texte, etiquettes };
}

describe("motifRefus — fiche par fiche", () => {
  it("une fiche saine passe", () => {
    expect(
      motifRefus(fiche("Accueillir le client, puis l'écouter sans l'interrompre.")),
    ).toBeNull();
  });

  it("refuse un montant en euros, dans le texte comme dans le titre", () => {
    expect(motifRefus(fiche(`Un exercice à ${MONTANT} par an.`))).toBe("montant");
    expect(motifRefus(fiche("Texte sain.", [], `Titre à ${MONTANT}`))).toBe("montant");
  });

  it("refuse les étiquettes chiffres-exercice, doctrine:a-revoir et secteur:sante", () => {
    for (const e of [ETIQUETTE_CHIFFRES, ETIQUETTE_DOCTRINE, ETIQUETTE_SANTE]) {
      expect(motifRefus(fiche("Texte sain.", [e]))).toBe(`etiquette:${e}`);
    }
  });

  it("refuse un courriel et un téléphone", () => {
    expect(motifRefus(fiche(`Écrire à ${COURRIEL}.`))).toBe("courriel");
    expect(motifRefus(fiche(`Appeler le ${TELEPHONE}.`))).toBe("telephone");
    expect(contientCourriel(`x ${COURRIEL}`)).toBe(true);
    expect(contientTelephone(`${["+33", "6", "12", "34", "56", "78"].join(" ")}`)).toBe(true);
    expect(contientTelephone("Il y a 12 fournées en 2026.")).toBe(false);
  });

  it("refuse une promesse de gain, un témoignage et un ancrage local", () => {
    expect(motifRefus(fiche("Un gain garanti pour tous."))).toMatch(/^doctrine:promesse-garantie/);
    expect(motifRefus(fiche("Un de nos clients a doublé son chiffre."))).toMatch(
      /^doctrine:temoignage-axion/,
    );
    expect(motifRefus(fiche(ANCRAGE))).toMatch(/^doctrine:ancrage-local/);
  });
});

describe("motifRefus — formes de montant (k, M, symbole devant)", () => {
  const formes = [
    ["5", " k", EURO],
    ["5k", EURO],
    ["1,5 M", EURO],
    [EURO, "500"],
    [EURO, " 500"],
    ["5 K", "EUR"],
    ["3 millions d'", "euros"],
    ["2 mille ", "euros"],
    ["EUR", " 40"],
  ].map((morceaux) => morceaux.join(""));

  for (const forme of formes) {
    it(`refuse la forme « ${forme.length} caractères » dans le texte`, () => {
      expect(motifRefus(fiche(`Un exercice : ${forme} par an.`))).toBe("montant");
    });
  }

  it("ne refuse pas un texte sans montant", () => {
    expect(motifRefus(fiche("Cinq clients, 3 étapes, 12 fournées, 2026."))).toBeNull();
  });
});

describe("filtrerPourSortie — point unique", () => {
  it("ne garde que les fiches sans motif, dans l'ordre", () => {
    const saines = [fiche("Un."), fiche("Deux.")];
    const rendues = filtrerPourSortie([
      saines[0]!,
      fiche(`À ${MONTANT}`),
      saines[1]!,
      fiche("ok", [ETIQUETTE_CHIFFRES]),
    ]);
    expect(rendues).toEqual(saines);
  });
});

describe("obtenirContexteMethode — rien d'interdit ne sort", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    queryRawMock.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  function noyauEn(texte: string, titre = "Essentiel inventé") {
    findManyMock.mockResolvedValue([
      { slug: SLUG_NOYAU_FAUX, translations: [{ title: titre, bodyText: texte }] },
    ]);
  }
  function extraitsEn(
    lignes: Array<{ slug: string; texte: string; etiquettes?: string[]; titre?: string }>,
  ) {
    queryRawMock.mockResolvedValue(
      lignes.map((l) => ({
        slug: l.slug,
        titre: l.titre ?? "Titre inventé",
        texte: l.texte,
        collection: "methode-vente",
        etiquettes: l.etiquettes ?? [],
      })),
    );
  }

  it("noyau sain : servi", async () => {
    noyauEn("Une vitrine chaleureuse vaut mieux qu'une longue explication.");
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.noyau?.slug).toBe(SLUG_NOYAU_FAUX);
  });

  it("noyau qui contient un montant : NON servi", async () => {
    noyauEn(`Un exercice à ${MONTANT}.`);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.noyau).toBeNull();
  });

  it("noyau avec une promesse, un témoignage ou un ancrage local : NON servi", async () => {
    for (const t of ["Un gain garanti.", "Un de nos clients a réussi.", ANCRAGE]) {
      noyauEn(t);
      expect((await obtenirContexteMethode({ sujet: "vitrine" })).noyau).toBeNull();
    }
  });

  it("extrait étiqueté chiffres-exercice : NON servi", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/un", texte: "Texte sain un." },
      { slug: "methode/faux-a/deux", texte: "Texte sain deux.", etiquettes: [ETIQUETTE_CHIFFRES] },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/un"]);
  });

  it("extrait avec « garanti », témoignage, ancrage local, courriel, téléphone ou montant : NON servi", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/garanti", texte: "Un gain garanti." },
      { slug: "methode/faux-a/temoin", texte: "Un de nos clients a doublé." },
      { slug: "methode/faux-a/siege", texte: ANCRAGE },
      { slug: "methode/faux-a/mail", texte: `Écrire à ${COURRIEL}` },
      { slug: "methode/faux-a/tel", texte: `Appeler le ${TELEPHONE}` },
      { slug: "methode/faux-a/montant", texte: `Pour ${MONTANT}` },
      { slug: "methode/faux-a/sante", texte: "Texte sain.", etiquettes: [ETIQUETTE_SANTE] },
      { slug: "methode/faux-a/bon", texte: "Texte sain." },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine", max: 10 });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/bon"]);
  });

  it("un extrait refusé ne fait pas passer le total sous la demande si d'autres sont sains", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/1", texte: "Un gain garanti." },
      { slug: "methode/faux-a/2", texte: "Sain deux." },
      { slug: "methode/faux-a/3", texte: "Sain trois." },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine", max: 2 });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/2", "methode/faux-a/3"]);
  });

  it("la demande n'a plus de paramètre « secteur » : la santé n'est jamais interrogée", async () => {
    noyauEn("Texte sain.");
    await obtenirContexteMethode({ sujet: "vitrine", secteur: "sante" } as never);
    expect(queryRawMock.mock.calls[0]![2]).toEqual(["methode-vente"]);
    expect(queryRawMock.mock.calls[0]![4] as number).toBeGreaterThan(0);
    expect(queryRawMock.mock.calls[0]![5]).toContain(ETIQUETTE_SANTE);
  });
});
