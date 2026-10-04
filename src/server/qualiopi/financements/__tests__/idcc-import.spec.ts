/**
 * INT-T60-A — import IDCC → OPCO.
 *
 * Deux sortes de données, jamais mêlées :
 *  - RÉELLES : `fixtures/siro-extrait-202606.csv` (264 lignes du fichier
 *    `siro-202606.csv`) et `fixtures/siro-202606-couples-idcc-opco.txt` (TOUS
 *    les couples du millésime, agrégés depuis le fichier réel), lus le
 *    2026-10-04 — cf. `fixtures/SOURCE-SIRO.md` ;
 *  - SYNTHÉTIQUES : lignes construites ici avec des IDCC `90xx` (aucun n'existe
 *    dans le millésime) pour exercer un cas précis. Ne rien en déduire sur le
 *    rattachement réel d'une convention collective.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Opco } from "../../../../../prisma/generated/client";
import {
  calculerChangements,
  urlSiroAutorisee,
  HOTES_FICHIER_SIRO,
  TAILLE_MAX_FICHIER_SIRO_OCTETS,
  choisirRessourceSiro,
  CONFIG_FICHIER_SIRO,
  FichierIdccOpcoRefuse,
  IDCC_MOTIF,
  importerFichierIdccOpco,
  importerMillesimeIdccOpco,
  importerSiroDuMois,
  ImportIdccOpcoRefuse,
  lireFichierSiro,
  lireFluxSiro,
  SIRO_DATASET_API,
  TelechargementSiroRefuse,
  type BaseIdccOpco,
  type ConfigFichierSiro,
  type CoupleIdccOpco,
  type TxIdccOpco,
} from "../idcc-import";

const FIXTURES = join(__dirname, "fixtures");
const EXTRAIT = readFileSync(join(FIXTURES, "siro-extrait-202606.csv"), "utf8");
const AGREGE = readFileSync(join(FIXTURES, "siro-202606-couples-idcc-opco.txt"), "utf8")
  .split("\n")
  .filter((l) => l.trim().length > 0)
  .map((l) => {
    const [idcc, libelle, n] = l.split("|") as [string, string, string];
    return { idcc, libelle, siretNombre: Number(n) };
  });
const ECHAPPEMENT = new Set(["5100", "5501", "9998", "9999"]);
const URL_SIRO =
  "https://static.data.gouv.fr/resources/table-siret-opco/20260924-155236/siro-202606.csv";

/** La config réelle sans plancher : l'extrait n'a que quelques centaines de couples. */
const CONFIG_EXTRAIT: ConfigFichierSiro = { ...CONFIG_FICHIER_SIRO, couplesMinimum: 1 };

const ENTETE = "SIRET|IDCC|OPCO_PROPRIETAIRE|OPCO_GESTION";
/** SIRET synthétique de 14 chiffres. */
const siret = (n: number) => String(90_000_000_000_000 + n);

/** Fichier SYNTHÉTIQUE au format réel. */
function synthetique(lignes: Array<[string, string]>): string {
  return [ENTETE, ...lignes.map(([idcc, opco], i) => `${siret(i)}|${idcc}|${opco}|`)].join("\n");
}

const couples = (l: readonly CoupleIdccOpco[]) => l.map((c) => `${c.idcc}|${c.opco}`);

/** Flux d'octets découpé à des positions données (une ligne coupée entre deux morceaux). */
function flux(texte: string, coupures: number[]): ReadableStream<Uint8Array> {
  const octets = new TextEncoder().encode(texte);
  const bornes = [0, ...coupures, octets.length];
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= bornes.length - 1) return c.close();
      c.enqueue(octets.slice(bornes[i], bornes[i + 1]));
      i++;
    },
  });
}

interface Ligne {
  idcc: string;
  opco: Opco;
  siretNombre: number;
  millesimeSource: Date;
  sourceUrl: string;
  importeAt: Date;
  intitule: string | null;
  intituleSource: string | null;
}
interface Changement {
  idcc: string;
  ancienOpco: Opco | null;
  nouvelOpco: Opco | null;
  millesimeSource: Date;
  importeAt: Date;
}

/** Fausse base : la transaction travaille sur une copie, validée seulement au succès. */
function fausseBase() {
  const etat = { lignes: [] as Ligne[], changements: [] as Changement[], ecritures: 0 };
  const db: BaseIdccOpco = {
    async $transaction(fn) {
      const copie = { lignes: [...etat.lignes], changements: [...etat.changements] };
      let ecritures = 0;
      const tx: TxIdccOpco = {
        idccOpco: {
          async findMany() {
            return copie.lignes.map((l) => ({ ...l }));
          },
          async deleteMany() {
            ecritures++;
            const count = copie.lignes.length;
            copie.lignes = [];
            return { count };
          },
          async createMany({ data }) {
            ecritures++;
            for (const l of data) {
              // Rejoue la PK composée et les CHECK de la migration.
              if (!/^[0-9]{4}$/.test(l.idcc)) throw new Error("CHECK idcc");
              if (!(l.siretNombre >= 1)) throw new Error("CHECK siret_nombre");
              if (copie.lignes.some((x) => x.idcc === l.idcc && x.opco === l.opco)) {
                throw new Error("PK (idcc, opco)");
              }
              copie.lignes.push({ ...l });
            }
            return { count: data.length };
          },
        },
        idccOpcoChangement: {
          async createMany({ data }) {
            ecritures++;
            copie.changements.push(...data.map((c) => ({ ...c })));
            return { count: data.length };
          },
        },
      };
      const r = await fn(tx);
      etat.lignes = copie.lignes;
      etat.changements = copie.changements;
      etat.ecritures += ecritures;
      return r;
    },
  };
  return { db, etat };
}

const M1 = new Date("2026-05-01T00:00:00Z");
const M2 = new Date("2026-06-01T00:00:00Z");
const URL_TEST = "https://exemple.invalid/siro-test.csv";
const c = (idcc: string, opco: Opco, siretNombre = 1): CoupleIdccOpco => ({
  idcc,
  opco,
  siretNombre,
});

describe("CONFIG_FICHIER_SIRO — la SIRO réelle", () => {
  it("lit OPCO_PROPRIETAIRE, jamais OPCO_GESTION ; onze libellés vers onze codes distincts", () => {
    expect(CONFIG_FICHIER_SIRO.separateur).toBe("|");
    expect(CONFIG_FICHIER_SIRO.colonneIdcc).toBe("IDCC");
    expect(CONFIG_FICHIER_SIRO.colonneOpco).toBe("OPCO_PROPRIETAIRE");
    const libelles = Object.keys(CONFIG_FICHIER_SIRO.libellesOpco).sort();
    expect(libelles).toEqual([...new Set(AGREGE.map((a) => a.libelle))].sort());
    expect(new Set(Object.values(CONFIG_FICHIER_SIRO.libellesOpco)).size).toBe(11);
    expect([...CONFIG_FICHIER_SIRO.idccEchappement].sort()).toEqual([...ECHAPPEMENT].sort());
  });
});

describe("TÉMOIN sur l'EXTRAIT RÉEL (siro-extrait-202606.csv)", () => {
  const lecture = lireFichierSiro(EXTRAIT, CONFIG_EXTRAIT);
  const idccExtrait = new Set(
    EXTRAIT.split("\n")
      .slice(1)
      .map((l) => l.split("|"))
      .filter((ch) => (ch[1] ?? "") !== "" && (ch[2] ?? "") !== "")
      .map((ch) => ch[1]!),
  );

  it("les couples obtenus = ceux du fichier agrégé, restreints aux IDCC de l'extrait", () => {
    const attendus = AGREGE.filter((a) => idccExtrait.has(a.idcc) && !ECHAPPEMENT.has(a.idcc))
      .map((a) => `${a.idcc}|${CONFIG_FICHIER_SIRO.libellesOpco[a.libelle]}`)
      .sort();
    // Un couple de l'agrégat sur un IDCC présent peut manquer à l'extrait (une
    // ligne sur 15 000) : l'égalité porte donc sur les couples de l'extrait,
    // contenus dans l'agrégat, et l'agrégat restreint en est un sur-ensemble.
    const obtenus = couples(lecture.couples).sort();
    for (const o of obtenus) expect(attendus).toContain(o);
    const lignesExtrait = new Set(
      EXTRAIT.split("\n")
        .slice(1)
        .map((l) => l.split("|"))
        .filter((ch) => (ch[1] ?? "") !== "" && (ch[2] ?? "") !== "" && !ECHAPPEMENT.has(ch[1]!))
        .map((ch) => `${ch[1]}|${CONFIG_FICHIER_SIRO.libellesOpco[ch[2]!]}`),
    );
    expect(obtenus).toEqual([...lignesExtrait].sort());
    expect(obtenus.length).toBeGreaterThan(50);
  });

  it("aucune valeur d'échappement dans les couples, alors que l'extrait en porte", () => {
    expect([...idccExtrait].some((i) => ECHAPPEMENT.has(i))).toBe(true);
    expect(lecture.couples.filter((x) => ECHAPPEMENT.has(x.idcc))).toEqual([]);
    expect(lecture.statistiques.lignesEchappement).toBeGreaterThan(0);
  });

  it("1596 donne DEUX lignes, CONSTRUCTYS et OPCO EP : la forme d'A02 interdit de trancher", () => {
    expect(lecture.couples.filter((x) => x.idcc === "1596").map((x) => x.opco)).toEqual([
      "constructys",
      "opco_ep",
    ]);
  });

  it("IDCC ou OPCO vide : ignoré SANS compter comme invalide ; aucune ligne invalide", () => {
    expect(lecture.statistiques.lignesSansCouple).toBeGreaterThan(0);
    expect(lecture.statistiques.lignesInvalides).toBe(0);
    expect(lecture.statistiques.lignes).toBe(264);
  });

  it("les lignes outre-mer (OPCO_GESTION = AKTO) gardent l'OPCO PROPRIÉTAIRE", () => {
    const outreMer = EXTRAIT.split("\n")
      .map((l) => l.split("|"))
      .filter((ch) => ch[3] === "AKTO" && ch[2] !== "AKTO" && (ch[1] ?? "") !== "");
    expect(outreMer.length).toBeGreaterThan(0);
    for (const ch of outreMer) {
      const proprietaire = CONFIG_FICHIER_SIRO.libellesOpco[ch[2]!];
      expect(lecture.couples.some((x) => x.idcc === ch[1] && x.opco === proprietaire)).toBe(true);
    }
  });

  it("le plancher réel de 1 000 couples refuse l'extrait (un fichier tronqué ne vide pas la table)", () => {
    expect(() => lireFichierSiro(EXTRAIT, CONFIG_FICHIER_SIRO)).toThrow(/plancher de 1000/);
  });

  it("le millésime agrégé complet compte 1 009 couples réels, dont 56 IDCC à ≥ 2 OPCO", () => {
    const reels = AGREGE.filter((a) => !ECHAPPEMENT.has(a.idcc));
    expect(reels).toHaveLength(1009);
    const parIdcc = new Map<string, number>();
    for (const a of reels) parIdcc.set(a.idcc, (parIdcc.get(a.idcc) ?? 0) + 1);
    expect([...parIdcc.values()].filter((n) => n >= 2)).toHaveLength(56);
    expect(reels.length).toBeGreaterThanOrEqual(CONFIG_FICHIER_SIRO.couplesMinimum!);
  });
});

describe("lireFluxSiro — lecture EN FLUX", () => {
  it("l'extrait réel découpé en morceaux arbitraires donne exactement la lecture d'un bloc", async () => {
    const enBloc = lireFichierSiro(EXTRAIT, CONFIG_EXTRAIT);
    // Coupures arbitraires, dont une en plein milieu d'une ligne de données.
    const milieu = EXTRAIT.indexOf("\n", 2_000) - 7;
    for (const coupures of [
      [milieu],
      [1, 13, 44, milieu, 9_001],
      [...Array(400).keys()].map((i) => i * 31 + 5),
    ]) {
      const parFlux = await lireFluxSiro(flux(EXTRAIT, coupures), CONFIG_EXTRAIT);
      expect(parFlux).toEqual(enBloc);
    }
  });

  it("une ligne coupée entre deux morceaux est recollée (SIRET coupé en deux)", async () => {
    const texte = synthetique([["9001", "ATLAS"]]);
    const coupure = texte.indexOf("|9001") - 5;
    const r = await lireFluxSiro(flux(texte, [coupure]), { ...CONFIG_EXTRAIT });
    expect(r.couples).toEqual([c("9001", "atlas", 1)]);
  });

  it("un caractère UTF-8 coupé entre deux morceaux est recollé", async () => {
    // Libellé synthétique accentué, déclaré dans une config de test.
    const config = { ...CONFIG_EXTRAIT, libellesOpco: { ÉSSAI: "atlas" as Opco } };
    const texte = `${ENTETE}\n${siret(1)}|9001|ÉSSAI|`;
    const octets = new TextEncoder().encode(texte);
    const posE = octets.indexOf(0xc3);
    const r = await lireFluxSiro(flux(texte, [posE + 1]), config);
    expect(r.couples).toEqual([c("9001", "atlas", 1)]);
  });

  it("refuse une page HTML, un fichier vide, un encodage non UTF-8, une ligne démesurée", async () => {
    await expect(lireFluxSiro(flux("<html>503</html>", []), CONFIG_EXTRAIT)).rejects.toThrow(
      /colonne absente/,
    );
    await expect(lireFluxSiro(flux("", []), CONFIG_EXTRAIT)).rejects.toThrow(/fichier vide/);
    const latin1 = new ReadableStream<Uint8Array>({
      start(ctl) {
        ctl.enqueue(new TextEncoder().encode(`${ENTETE}\n${siret(1)}|9001|`));
        ctl.enqueue(new Uint8Array([0xc9, 0x0a]));
        ctl.close();
      },
    });
    await expect(lireFluxSiro(latin1, CONFIG_EXTRAIT)).rejects.toThrow(/UTF-8/);
    await expect(lireFluxSiro(flux("x".repeat(70_000), []), CONFIG_EXTRAIT)).rejects.toThrow(
      /démesurée/,
    );
  });
});

describe("lireFichierSiro — cas SYNTHÉTIQUES au format réel", () => {
  it("TÉMOIN A02 — un IDCC à deux OPCO (1 000 SIRET et 1 SIRET) donne deux lignes aux comptes exacts", () => {
    const lignes: Array<[string, string]> = [
      ...Array.from({ length: 1000 }, () => ["9001", "CONSTRUCTYS"] as [string, string]),
      ["9001", "OPCO EP"],
    ];
    expect(lireFichierSiro(synthetique(lignes), CONFIG_EXTRAIT).couples).toEqual([
      c("9001", "constructys", 1000),
      c("9001", "opco_ep", 1),
    ]);
  });

  it("compte les SIRET DISTINCTS : un SIRET répété ne compte qu'une fois", () => {
    const texte = [
      ENTETE,
      `${siret(1)}|9001|ATLAS|`,
      `${siret(1)}|9001|ATLAS|`,
      `${siret(2)}|9001|ATLAS|`,
    ].join("\n");
    expect(lireFichierSiro(texte, CONFIG_EXTRAIT).couples).toEqual([c("9001", "atlas", 2)]);
  });

  it("refuse un libellé OPCO non répertorié plutôt que de le deviner", () => {
    expect(() => lireFichierSiro(synthetique([["9001", "OPCO INCONNU"]]), CONFIG_EXTRAIT)).toThrow(
      /non répertorié/,
    );
  });

  it("SIRET ou IDCC hors format = ligne invalide, comptée dans la tolérance", () => {
    const texte = [
      ENTETE,
      `${siret(1)}|9001|ATLAS|`,
      `${siret(2)}|123|ATLAS|`,
      `12|9002|AKTO|`,
    ].join("\n");
    expect(() => lireFichierSiro(texte, CONFIG_EXTRAIT)).not.toThrow();
    expect(lireFichierSiro(texte, CONFIG_EXTRAIT).statistiques.lignesInvalides).toBe(2);
    expect(() => lireFichierSiro(texte, { ...CONFIG_EXTRAIT, lignesInvalidesTolerees: 1 })).toThrow(
      /plus de 1 ligne/,
    );
  });

  it("refuse un fichier vide, sans colonne attendue, ou sans couple", () => {
    expect(() => lireFichierSiro("", CONFIG_EXTRAIT)).toThrow(/fichier vide/);
    expect(() => lireFichierSiro(`${ENTETE}\n`, CONFIG_EXTRAIT)).toThrow(/aucun couple/);
    expect(() => lireFichierSiro("SIRET|IDCC|OPCO_GESTION\n1|2|3", CONFIG_EXTRAIT)).toThrow(
      /colonne absente : OPCO_PROPRIETAIRE/,
    );
  });

  it("tolère BOM, CRLF et champs entre guillemets", () => {
    const texte = `﻿${ENTETE}\r\n"${siret(1)}"|"9001"|"ATLAS"|\r\n`;
    expect(lireFichierSiro(texte, CONFIG_EXTRAIT).couples).toEqual([c("9001", "atlas", 1)]);
  });
});

describe("importerMillesimeIdccOpco — témoins INT-T60-A", () => {
  it("TÉMOIN — double import du même millésime (extrait réel) : aucun effet, aucun changement journalisé", async () => {
    const { db, etat } = fausseBase();
    const entree = { texte: EXTRAIT, config: CONFIG_EXTRAIT, millesime: M2, sourceUrl: URL_SIRO };
    const premier = await importerFichierIdccOpco(db, entree);
    expect(premier).toMatchObject({ statut: "importe", changements: 0, premierImport: true });
    const instantane = JSON.stringify(etat.lignes);
    const ecritures = etat.ecritures;

    const second = await importerFichierIdccOpco(db, entree);
    expect(second).toEqual({ statut: "deja_importe", lignes: etat.lignes.length });
    expect(JSON.stringify(etat.lignes)).toBe(instantane);
    expect(etat.ecritures).toBe(ecritures);
    expect(etat.changements).toEqual([]);
    expect(etat.lignes.every((l) => l.sourceUrl === URL_SIRO)).toBe(true);
  });

  it("TÉMOIN — un changement d'OPCO entre deux millésimes est journalisé", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M1,
      sourceUrl: URL_TEST,
      couples: [c("9001", "atlas"), c("9002", "akto")],
    });
    const r = await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_TEST,
      couples: [c("9001", "afdas"), c("9002", "akto")],
    });
    expect(r).toMatchObject({ statut: "importe", changements: 1, premierImport: false });
    expect(etat.changements).toEqual([
      expect.objectContaining({
        idcc: "9001",
        ancienOpco: "atlas",
        nouvelOpco: "afdas",
        millesimeSource: M2,
      }),
    ]);
    // Le millésime entier est remplacé : plus aucune ligne de M1.
    expect(new Set(etat.lignes.map((l) => l.millesimeSource.toISOString()))).toEqual(
      new Set([M2.toISOString()]),
    );
  });

  it("TÉMOIN A02 — un second import REMPLACE les comptes, sans les additionner", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M1,
      sourceUrl: URL_TEST,
      couples: [c("9001", "constructys", 1000), c("9001", "opco_ep", 1)],
    });
    await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_TEST,
      couples: [c("9001", "constructys", 1003), c("9001", "opco_ep", 2)],
    });
    expect(etat.lignes.map((l) => [l.opco, l.siretNombre])).toEqual([
      ["constructys", 1003],
      ["opco_ep", 2],
    ]);
    // Des comptes qui bougent ne sont pas des changements de rattachement.
    expect(etat.changements).toEqual([]);
  });

  it("TÉMOIN — un fichier illisible ou vide ne touche pas la table", async () => {
    const { db, etat } = fausseBase();
    await importerFichierIdccOpco(db, {
      texte: EXTRAIT,
      config: CONFIG_EXTRAIT,
      millesime: M1,
      sourceUrl: URL_SIRO,
    });
    const instantane = JSON.stringify(etat);
    for (const texte of ["", "   \n", "<html>503</html>", `${ENTETE}\n`]) {
      await expect(
        importerFichierIdccOpco(db, {
          texte,
          config: CONFIG_EXTRAIT,
          millesime: M2,
          sourceUrl: URL_SIRO,
        }),
      ).rejects.toThrow(FichierIdccOpcoRefuse);
    }
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("TÉMOIN — l'IDCC refuse « 123 » et « 12a4 », le compte refuse 0 (code et CHECK)", async () => {
    expect(IDCC_MOTIF.test("123")).toBe(false);
    expect(IDCC_MOTIF.test("12a4")).toBe(false);
    expect(IDCC_MOTIF.test("1516")).toBe(true);
    const { db, etat } = fausseBase();
    for (const couple of [c("123", "atlas"), c("12a4", "atlas"), c("9001", "atlas", 0)]) {
      await expect(
        importerMillesimeIdccOpco(db, { millesime: M1, sourceUrl: URL_TEST, couples: [couple] }),
      ).rejects.toThrow(ImportIdccOpcoRefuse);
    }
    expect(etat.lignes).toEqual([]);
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261004230500_idcc_opco/migration.sql"),
      "utf8",
    );
    expect(sql).toContain(`ALTER TABLE "idcc_opco" ADD CONSTRAINT "idcc_opco_idcc_check"`);
    expect(sql).toContain(`CHECK ("idcc" ~ '^[0-9]{4}$')`);
    expect(sql).toContain(`PRIMARY KEY ("idcc", "opco")`);
    expect(sql).toContain(`"siret_nombre" INTEGER NOT NULL`);
    expect(sql).toContain(
      `ADD CONSTRAINT "idcc_opco_siret_nombre_positif"\n  CHECK ("siret_nombre" >= 1)`,
    );
  });

  it("refuse un millésime plus ancien, et un même millésime au contenu (ou aux comptes) différent", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_TEST,
      couples: [c("9001", "atlas", 5)],
    });
    const instantane = JSON.stringify(etat);
    await expect(
      importerMillesimeIdccOpco(db, {
        millesime: M1,
        sourceUrl: URL_TEST,
        couples: [c("9001", "akto")],
      }),
    ).rejects.toThrow(/plus ancien/);
    for (const couple of [c("9001", "akto", 5), c("9001", "atlas", 6)]) {
      await expect(
        importerMillesimeIdccOpco(db, { millesime: M2, sourceUrl: URL_TEST, couples: [couple] }),
      ).rejects.toThrow(/contenu différent/);
    }
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("conserve l'intitulé (source distincte) d'un millésime à l'autre", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M1,
      sourceUrl: URL_TEST,
      couples: [c("9001", "atlas")],
    });
    etat.lignes[0]!.intitule = "Convention synthétique d'essai";
    etat.lignes[0]!.intituleSource = "https://exemple.invalid/liste";
    await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_TEST,
      couples: [c("9001", "akto")],
    });
    expect(etat.lignes).toEqual([
      expect.objectContaining({
        opco: "akto",
        intitule: "Convention synthétique d'essai",
        intituleSource: "https://exemple.invalid/liste",
      }),
    ]);
  });
});

describe("calculerChangements", () => {
  it("journalise les ajouts et disparitions seuls, sans arbitrer entre deux OPCO", () => {
    expect(
      calculerChangements(
        [c("9001", "atlas"), c("9002", "akto")],
        [c("9001", "atlas"), c("9001", "afdas"), c("9003", "akto")],
      ),
    ).toEqual([
      { idcc: "9001", ancienOpco: null, nouvelOpco: "afdas" },
      { idcc: "9002", ancienOpco: "akto", nouvelOpco: null },
      { idcc: "9003", ancienOpco: null, nouvelOpco: "akto" },
    ]);
  });
});

// ───────────────────────── Téléchargement (réseau INJECTÉ) ─────────────────

const reponseApi = {
  resources: [
    {
      format: "pdf",
      title: "dictionnaire-donnees-table-siro-v2au310725.pdf",
      url: "https://static.data.gouv.fr/d.pdf",
    },
    {
      format: "csv",
      title: "siro-202605.csv",
      url: "https://static.data.gouv.fr/r/siro-202605.csv",
    },
    { format: "CSV", title: "siro-202606.csv", url: URL_SIRO },
    { format: "csv", title: "autre-202612.csv", url: "https://static.data.gouv.fr/r/autre.csv" },
  ],
};

/** Fichier synthétique de N couples distincts, au format réel. */
function fichierDeCouples(n: number): string {
  const lignes: Array<[string, string]> = [];
  const libelles = Object.keys(CONFIG_FICHIER_SIRO.libellesOpco);
  for (let i = 0; i < n; i++) {
    lignes.push([
      String(1000 + Math.floor(i / libelles.length)).padStart(4, "0"),
      libelles[i % libelles.length]!,
    ]);
  }
  return synthetique(lignes.filter(([idcc]) => !ECHAPPEMENT.has(idcc)));
}

function faussesRoutes(routes: Record<string, () => Response | Promise<Response>>) {
  const appels: string[] = [];
  const fetch = async (url: string, init: { signal: AbortSignal; redirect: "manual" }) => {
    appels.push(url);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect, "aucune redirection ne doit être suivie").toBe("manual");
    const r = routes[url];
    if (!r) throw new Error(`URL inattendue : ${url}`);
    return r();
  };
  return { fetch, appels };
}

const json = (corps: unknown) =>
  new Response(JSON.stringify(corps), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const csv = (texte: string, status = 200, type = "text/csv") =>
  new Response(flux(texte, [7, 100, 5_000]), { status, headers: { "content-type": type } });

describe("choisirRessourceSiro", () => {
  it("prend la ressource CSV « siro-AAAAMM.csv » la plus récente ; millésime = AAAA-MM-01", () => {
    expect(choisirRessourceSiro(reponseApi)).toEqual({
      url: URL_SIRO,
      titre: "siro-202606.csv",
      millesime: new Date("2026-06-01T00:00:00Z"),
    });
  });

  it("rend null sans ressource conforme", () => {
    expect(
      choisirRessourceSiro({
        resources: [{ format: "csv", title: "siro-202613.csv", url: "https://x" }],
      }),
    ).toBeNull();
    expect(choisirRessourceSiro({})).toBeNull();
    expect(choisirRessourceSiro(null)).toBeNull();
  });
});

describe("importerSiroDuMois — téléchargement, sans réseau", () => {
  const grand = fichierDeCouples(1_100);

  it("trouve la ressource par l'API, lit en flux, importe ; sourceUrl = URL de la ressource", async () => {
    const { db, etat } = fausseBase();
    const { fetch, appels } = faussesRoutes({
      [SIRO_DATASET_API]: () => json(reponseApi),
      [URL_SIRO]: () => csv(grand),
    });
    const r = await importerSiroDuMois(db, { fetch });
    expect(appels).toEqual([SIRO_DATASET_API, URL_SIRO]);
    expect(r).toMatchObject({ statut: "importe", premierImport: true });
    expect(r.lignes).toBeGreaterThanOrEqual(1_000);
    expect(new Set(etat.lignes.map((l) => l.sourceUrl))).toEqual(new Set([URL_SIRO]));
    expect(new Set(etat.lignes.map((l) => l.millesimeSource.toISOString()))).toEqual(
      new Set(["2026-06-01T00:00:00.000Z"]),
    );
  });

  it("refuse HTTP ≠ 200, page HTML, fichier vide ou < 1 000 couples, réseau en panne : table intacte", async () => {
    const { db, etat } = fausseBase();
    await importerSiroDuMois(db, {
      fetch: faussesRoutes({
        [SIRO_DATASET_API]: () => json(reponseApi),
        [URL_SIRO]: () => csv(grand),
      }).fetch,
    });
    const instantane = JSON.stringify(etat);
    const cas: Array<[Record<string, () => Response | Promise<Response>>, RegExp]> = [
      [{ [SIRO_DATASET_API]: () => new Response("", { status: 503 }) }, /HTTP 503/],
      [{ [SIRO_DATASET_API]: () => json({ resources: [] }) }, /aucune ressource/],
      [{ [SIRO_DATASET_API]: () => json(reponseApi), [URL_SIRO]: () => csv("", 404) }, /HTTP 404/],
      [
        {
          [SIRO_DATASET_API]: () => json(reponseApi),
          [URL_SIRO]: () => csv("<html>maintenance</html>", 200, "text/html; charset=utf-8"),
        },
        /page HTML/,
      ],
      [{ [SIRO_DATASET_API]: () => json(reponseApi), [URL_SIRO]: () => csv("") }, /fichier vide/],
      [
        { [SIRO_DATASET_API]: () => json(reponseApi), [URL_SIRO]: () => csv(`${ENTETE}\n`) },
        /aucun couple/,
      ],
      [
        { [SIRO_DATASET_API]: () => json(reponseApi), [URL_SIRO]: () => csv(fichierDeCouples(50)) },
        /plancher de 1000/,
      ],
      [
        {
          [SIRO_DATASET_API]: () => json(reponseApi),
          [URL_SIRO]: () =>
            Promise.reject(Object.assign(new Error("délai"), { name: "TimeoutError" })),
        },
        /injoignable \(TimeoutError\)/,
      ],
    ];
    for (const [routes, motif] of cas) {
      await expect(importerSiroDuMois(db, { fetch: faussesRoutes(routes).fetch })).rejects.toThrow(
        motif,
      );
    }
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("le délai d'attente est borné et passé au réseau", async () => {
    const signaux: AbortSignal[] = [];
    const fetch = async (_url: string, init: { signal: AbortSignal; redirect: "manual" }) => {
      signaux.push(init.signal);
      return new Promise<Response>((_, rejeter) =>
        init.signal.addEventListener("abort", () => rejeter(init.signal.reason)),
      );
    };
    await expect(importerSiroDuMois(fausseBase().db, { fetch, delaiApiMs: 20 })).rejects.toThrow(
      TelechargementSiroRefuse,
    );
    expect(signaux[0]?.aborted).toBe(true);
  });
});

describe("🔴 SSRF — le worker n'appelle que data.gouv (condition de la sécurité)", () => {
  const grand = fichierDeCouples(1_100);

  it("urlSiroAutorisee : seul static.data.gouv.fr en https, en égalité exacte", () => {
    expect(urlSiroAutorisee(URL_SIRO, HOTES_FICHIER_SIRO)).toBe(true);
    for (const etrangere of [
      "https://exemple.invalid/siro-202606.csv",
      "https://static.data.gouv.fr.exemple.invalid/siro-202606.csv",
      "https://127.0.0.1/siro-202606.csv",
      "https://169.254.169.254/latest/meta-data",
      "http://static.data.gouv.fr/siro-202606.csv",
      "https://static.data.gouv.fr:8443/siro-202606.csv",
      "https://user:mdp@static.data.gouv.fr/siro-202606.csv",
      "https://sous.static.data.gouv.fr/siro-202606.csv",
      "https://www.data.gouv.fr/siro-202606.csv",
      "pas une url",
    ]) {
      expect(urlSiroAutorisee(etrangere, HOTES_FICHIER_SIRO), etrangere).toBe(false);
    }
  });

  it("une ressource sur un hôte étranger est écartée par choisirRessourceSiro", () => {
    const r = choisirRessourceSiro({
      resources: [
        { format: "csv", title: "siro-202607.csv", url: "https://127.0.0.1/siro-202607.csv" },
        { format: "csv", title: "siro-202606.csv", url: URL_SIRO },
      ],
    });
    expect(r?.url).toBe(URL_SIRO);
  });

  it("une API qui ne propose qu'un hôte étranger : AUCUN appel vers lui, table intacte", async () => {
    const { db, etat } = fausseBase();
    const instantane = JSON.stringify(etat);
    const { fetch, appels } = faussesRoutes({
      [SIRO_DATASET_API]: () =>
        json({
          resources: [
            { format: "csv", title: "siro-202607.csv", url: "https://exemple.invalid/siro.csv" },
          ],
        }),
    });
    await expect(importerSiroDuMois(db, { fetch })).rejects.toThrow(/aucune ressource/);
    expect(appels).toEqual([SIRO_DATASET_API]);
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("une redirection, même vers data.gouv, est refusée : table intacte", async () => {
    const { db, etat } = fausseBase();
    const instantane = JSON.stringify(etat);
    for (const cible of ["https://127.0.0.1/siro.csv", URL_SIRO]) {
      const { fetch } = faussesRoutes({
        [SIRO_DATASET_API]: () => json(reponseApi),
        [URL_SIRO]: () => new Response(null, { status: 302, headers: { location: cible } }),
      });
      await expect(importerSiroDuMois(db, { fetch })).rejects.toThrow(/redirection refusée/);
    }
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("une réponse servie par un hôte étranger (URL finale) est refusée", async () => {
    const { db } = fausseBase();
    const servie = csv(grand);
    Object.defineProperty(servie, "url", { value: "https://127.0.0.1/siro.csv" });
    const { fetch } = faussesRoutes({
      [SIRO_DATASET_API]: () => json(reponseApi),
      [URL_SIRO]: () => servie,
    });
    await expect(importerSiroDuMois(db, { fetch })).rejects.toThrow(/hôte non autorisé/);
  });

  it("au-delà du plafond d'octets : refus nommé, sans import partiel — en flux ou annoncé", async () => {
    const { db, etat } = fausseBase();
    const instantane = JSON.stringify(etat);
    const enFlux = faussesRoutes({
      [SIRO_DATASET_API]: () => json(reponseApi),
      [URL_SIRO]: () => csv(grand),
    });
    await expect(
      importerSiroDuMois(db, { fetch: enFlux.fetch, tailleMaxOctets: 2_000 }),
    ).rejects.toThrow(/au-delà du plafond/);
    const annonce = faussesRoutes({
      [SIRO_DATASET_API]: () => json(reponseApi),
      [URL_SIRO]: () =>
        new Response(flux(grand, [100]), {
          status: 200,
          headers: { "content-type": "text/csv", "content-length": "999999999999" },
        }),
    });
    await expect(importerSiroDuMois(db, { fetch: annonce.fetch })).rejects.toThrow(
      /au-delà du plafond/,
    );
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("cas nominal : static.data.gouv.fr, 200, sous le plafond → importé", async () => {
    const { db } = fausseBase();
    const { fetch } = faussesRoutes({
      [SIRO_DATASET_API]: () => json(reponseApi),
      [URL_SIRO]: () => csv(grand),
    });
    expect(TAILLE_MAX_FICHIER_SIRO_OCTETS).toBeGreaterThan(109_242_949);
    await expect(importerSiroDuMois(db, { fetch })).resolves.toMatchObject({ statut: "importe" });
  });
});
