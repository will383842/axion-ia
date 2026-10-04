// @req REQ-INT-062
/**
 * INT-T61-A — contrôle croisé de l'IDCC : statut fermé, règle de la part, neuf
 * cas, confirmation par preuve déclarative sans aucun fichier.
 *
 * Données RÉELLES : `fixtures/siro-202606-couples-idcc-opco.txt` (tous les
 * couples du millésime SIRO 2026-06, cf. `fixtures/SOURCE-SIRO.md`), lu tel
 * quel, valeurs d'échappement écartées comme le fait l'import. Les seuls
 * couples SYNTHÉTIQUES sont ceux qui éprouvent le seuil au point de base ; ils
 * portent des IDCC `90xx`, absents du millésime.
 *
 * `liste_idcc` : forme de la spécification OpenAPI officielle de l'API
 * Recherche d'entreprises (`results[].complements.liste_idcc`, tableau de
 * chaînes). Aucune réponse vivante n'a pu être lue depuis l'environnement
 * (CONNECT 403) : les réponses ci-dessous sont construites sur cette forme.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEUIL_CONCORDANCE_IDCC_OPCO_BPS } from "@/server/qualiopi/config/financing";
import type { OpcoId } from "@/server/qualiopi/financements/opco-referentiel";
import { CONFIG_FICHIER_SIRO } from "../idcc-import";
import {
  ConfirmationIdccRefusee,
  confirmerIdccParPreuve,
  controlerIdcc,
  enregistrerControleIdcc,
  lireCouplesIdcc,
  listeIdccDuResultat,
  PREUVES_IDCC_DECLARATIVES,
  preuveDeclarativeSchema,
  regleDeLaPart,
  STATUTS_IDCC,
  type BaseControleIdcc,
  type CoupleIdccLu,
  type EntreeControleIdcc,
  type EntreeJournalIdcc,
  type LigneControleIdcc,
  type TxControleIdcc,
} from "../idcc-controle";

const RACINE = join(__dirname, "..", "..", "..", "..", "..");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

const MILLESIME = new Date("2026-06-01T00:00:00Z");
const ECHAPPEMENT = new Set(CONFIG_FICHIER_SIRO.idccEchappement);

/** La table `idcc_opco` telle que l'import la remplit depuis le millésime réel. */
const TABLE: ReadonlyMap<string, CoupleIdccLu[]> = (() => {
  const t = new Map<string, CoupleIdccLu[]>();
  const texte = readFileSync(
    join(__dirname, "fixtures", "siro-202606-couples-idcc-opco.txt"),
    "utf8",
  );
  for (const ligne of texte.split("\n")) {
    if (ligne.trim().length === 0) continue;
    const [idcc, libelle, n] = ligne.split("|") as [string, string, string];
    if (ECHAPPEMENT.has(idcc)) continue;
    const opco = CONFIG_FICHIER_SIRO.libellesOpco[libelle];
    if (opco === undefined) throw new Error(`libellé inattendu dans la fixture : ${libelle}`);
    const couples = t.get(idcc) ?? [];
    couples.push({ opco, siretNombre: Number(n), millesimeSource: MILLESIME });
    t.set(idcc, couples);
  }
  return t;
})();
const couples = (idcc: string) => TABLE.get(idcc) ?? [];

/** Un résultat de l'API Recherche d'entreprises, réduit au champ lu. */
const reponseApi = (liste: string[] | undefined) =>
  liste === undefined
    ? { siren: "356000000", complements: {} }
    : { siren: "356000000", complements: { liste_idcc: liste } };

function entree(
  partiel: Partial<EntreeControleIdcc> & { idccSaisi: string | null },
): EntreeControleIdcc {
  return {
    opcoSaisi: null,
    listeIdcc: null,
    naf: null,
    preuve: null,
    ...partiel,
    couples: partiel.couples ?? (partiel.idccSaisi ? couples(partiel.idccSaisi.trim()) : []),
  };
}

const AUTEUR = "2f6c1c2e-4b8a-4c1e-9a55-0d7b3f2a1e01";
const CLIENT = "7a0e8a52-1b7c-4f0e-8d0f-5c3a9e6b2d10";

// ─── Le millésime réel dit bien ce que les témoins supposent ───────────────

describe("fixture SIRO 2026-06 — les comptes des témoins", () => {
  it("1596 : CONSTRUCTYS 274 837, OPCO EP 1 ; 8822 : AKTO 235, OCAPIAT 67", () => {
    const compte = (idcc: string) =>
      Object.fromEntries(couples(idcc).map((c) => [c.opco, c.siretNombre]));
    expect(compte("1596")).toEqual({ constructys: 274_837, opco_ep: 1 });
    expect(compte("8822")).toEqual({ akto: 235, ocapiat: 67 });
  });
  it("les IDCC choisis comme « inconnus » sont bien absents de la table", () => {
    expect(TABLE.has("1234")).toBe(false);
    expect(TABLE.has("9999")).toBe(false);
  });
});

// ─── Règle de la part ──────────────────────────────────────────────────────

describe("règle de la part (A02, commentaire 5980505240)", () => {
  it("le seuil est en SSOT : 9 000 points de base, sourcé et daté", () => {
    expect(SEUIL_CONCORDANCE_IDCC_OPCO_BPS).toBe(9000);
    const src = lire("src/server/qualiopi/config/financing.ts");
    expect(src).toContain("arbitrage de la coordination du 2026-10-04");
    expect(src).toContain("distribution SIRO de 2026-06");
    expect(src).toContain("ne bloque rien");
  });

  it("TÉMOIN : 1596 avec CONSTRUCTYS est concordant", () => {
    const r = regleDeLaPart({ opcoSaisi: "constructys", couples: couples("1596") });
    expect(r).toEqual({
      issue: "concordant",
      siretOpco: 274_837,
      siretTotal: 274_838,
      millesime: "2026-06-01",
    });
  });

  it("TÉMOIN : 1596 avec OPCO EP est à confirmer", () => {
    expect(regleDeLaPart({ opcoSaisi: "opco_ep", couples: couples("1596") }).issue).toBe(
      "a_confirmer",
    );
  });

  it("TÉMOIN : 8822 (structurel) — AKTO à confirmer (77,8 %), OCAPIAT à confirmer", () => {
    const akto = regleDeLaPart({ opcoSaisi: "akto", couples: couples("8822") });
    expect(akto.issue).toBe("a_confirmer");
    // 235 / 302 = 7 781 points de base, sous 9 000.
    expect(Math.floor((akto.siretOpco * 10_000) / akto.siretTotal)).toBe(7781);
    expect(regleDeLaPart({ opcoSaisi: "ocapiat", couples: couples("8822") }).issue).toBe(
      "a_confirmer",
    );
  });

  it("TÉMOIN : le seuil est jugé au point de base — seuil − 1 → à confirmer, seuil pile → concordant", () => {
    const de = (n: number): CoupleIdccLu[] => [
      { opco: "atlas", siretNombre: n, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 10_000 - n, millesimeSource: MILLESIME },
    ];
    // Part de 8 999 points de base contre un seuil de 9 000.
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: de(8_999) }).issue).toBe("a_confirmer");
    // Part de 9 000 points de base, pile au seuil.
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: de(9_000) }).issue).toBe("concordant");
    // Même part de 9 000, seuil porté à 9 001.
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: de(9_000), seuilBps: 9_001 }).issue).toBe(
      "a_confirmer",
    );
    // 9 contre 1 : 90 % exactement, sans flottant.
    const neufContreUn: CoupleIdccLu[] = [
      { opco: "atlas", siretNombre: 9, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 1, millesimeSource: MILLESIME },
    ];
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: neufContreUn }).issue).toBe("concordant");
  });

  it("calcul en entiers : pas d'erreur d'arrondi sur de grands comptes", () => {
    // 0,9 × 3 000 000 001 n'est pas représentable exactement en flottant.
    const grands: CoupleIdccLu[] = [
      { opco: "atlas", siretNombre: 2_700_000_001, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 300_000_000, millesimeSource: MILLESIME },
    ];
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: grands }).issue).toBe("concordant");
    const justeSous: CoupleIdccLu[] = [
      { opco: "atlas", siretNombre: 2_699_999_999, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 300_000_001, millesimeSource: MILLESIME },
    ];
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: justeSous }).issue).toBe("a_confirmer");
  });

  it("un OPCO saisi ABSENT de la table pour cet IDCC est à confirmer, jamais concordant", () => {
    // 1596 n'a aucune ligne ATLAS.
    expect(regleDeLaPart({ opcoSaisi: "atlas", couples: couples("1596") }).issue).toBe(
      "a_confirmer",
    );
    // Même pour un IDCC à un seul OPCO, à 100 %.
    const seul = couples("1486").filter((c) => c.opco === "atlas");
    expect(regleDeLaPart({ opcoSaisi: "akto", couples: seul }).issue).toBe("a_confirmer");
  });

  it("aucun OPCO saisi : à confirmer (rien à juger)", () => {
    expect(regleDeLaPart({ opcoSaisi: null, couples: couples("1596") }).issue).toBe("a_confirmer");
  });

  it("un IDCC absent de la table est « inconnu », distinct des deux autres", () => {
    const r = regleDeLaPart({ opcoSaisi: "constructys", couples: couples("1234") });
    expect(r).toEqual({ issue: "inconnu", siretOpco: 0, siretTotal: 0, millesime: null });
  });

  it("même millésime : un millésime plus ancien n'est jamais cumulé", () => {
    const melange: CoupleIdccLu[] = [
      { opco: "atlas", siretNombre: 95, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 5, millesimeSource: MILLESIME },
      { opco: "opco2i", siretNombre: 1_000, millesimeSource: new Date("2026-03-01T00:00:00Z") },
    ];
    const r = regleDeLaPart({ opcoSaisi: "atlas", couples: melange });
    expect(r).toMatchObject({ issue: "concordant", siretTotal: 100, millesime: "2026-06-01" });
  });

  it("un seuil hors bornes est refusé, jamais interprété", () => {
    expect(() => regleDeLaPart({ opcoSaisi: "atlas", couples: [], seuilBps: 0 })).toThrow(
      RangeError,
    );
    expect(() => regleDeLaPart({ opcoSaisi: "atlas", couples: [], seuilBps: 9_000.5 })).toThrow(
      RangeError,
    );
    expect(() => regleDeLaPart({ opcoSaisi: "atlas", couples: [], seuilBps: 10_001 })).toThrow(
      RangeError,
    );
  });
});

// ─── liste_idcc ────────────────────────────────────────────────────────────

describe("liste_idcc de l'API Recherche d'entreprises (RM-08)", () => {
  it("lit complements.liste_idcc, normalise, dédoublonne, trie", () => {
    expect(listeIdccDuResultat(reponseApi(["1596", "0016", "1596", "16"]))).toEqual([
      "0016",
      "1596",
    ]);
  });
  it("champ absent ou mal formé : null (l'API n'a rien dit)", () => {
    expect(listeIdccDuResultat(reponseApi(undefined))).toBeNull();
    expect(listeIdccDuResultat({ complements: { liste_idcc: "1596" } })).toBeNull();
    expect(listeIdccDuResultat(null)).toBeNull();
  });
  it("une valeur illisible est écartée, pas devinée", () => {
    expect(listeIdccDuResultat(reponseApi(["11516", "abc", "1516"]))).toEqual(["1516"]);
  });
  it("réponse RÉELLE (LA POSTE, lue le 2026-10-04) : la valeur d'échappement 9999 est écartée", () => {
    // Extrait de `GET /search?q=356000000&per_page=1`, résultat 0 (siren 356000000).
    const reponseReelle = { siren: "356000000", complements: { liste_idcc: ["9999", "5516"] } };
    expect(listeIdccDuResultat(reponseReelle)).toEqual(["5516"]);
  });
  it("une entreprise qui ne publie QUE des échappements n'a rien de publié d'utile", () => {
    expect(listeIdccDuResultat(reponseApi(["9999", "5100", "5501", "9998"]))).toEqual([]);
  });
});

// ─── Les neuf cas ──────────────────────────────────────────────────────────

describe("contrôle croisé — les NEUF cas sont neuf témoins", () => {
  const cas: Array<{
    nom: string;
    e: EntreeControleIdcc;
    statut: (typeof STATUTS_IDCC)[number];
    cas: string;
  }> = [
    {
      nom: "1. rien saisi, rien publié",
      e: entree({ idccSaisi: null, listeIdcc: listeIdccDuResultat(reponseApi([])) }),
      statut: "non_renseigne",
      cas: "c1_rien_saisi_rien_publie",
    },
    {
      nom: "2. rien saisi, l'API publie 1596",
      e: entree({ idccSaisi: "", listeIdcc: ["1596"], naf: "4120A" }),
      statut: "probable",
      cas: "c2_rien_saisi_un_idcc_publie",
    },
    {
      nom: "3. rien saisi, l'API publie 1486 et 1596",
      e: entree({ idccSaisi: "  ", listeIdcc: ["1486", "1596"] }),
      statut: "non_renseigne",
      cas: "c3_rien_saisi_plusieurs_idcc_publies",
    },
    {
      nom: "4. 1596 saisi et publié, CONSTRUCTYS",
      e: entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: ["1596"], naf: "4120A" }),
      statut: "concordant",
      cas: "c4_saisi_publie_part_concordante",
    },
    {
      nom: "5. 8822 saisi et publié, AKTO (part 77,8 %)",
      e: entree({ idccSaisi: "8822", opcoSaisi: "akto", listeIdcc: ["8822"] }),
      statut: "probable",
      cas: "c5_saisi_publie_part_a_confirmer",
    },
    {
      nom: "6. 1596 saisi, rien publié, NAF 4120A (CONSTRUCTYS, dans la table)",
      e: entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: null, naf: "4120A" }),
      statut: "probable",
      cas: "c6_saisi_rien_publie_naf_compatible",
    },
    {
      nom: "7. 1596 saisi, rien publié, NAF 6201Z (ATLAS, hors table pour 1596)",
      e: entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: [], naf: "6201Z" }),
      statut: "anomalie",
      cas: "c7_saisi_rien_publie_naf_contraire",
    },
    {
      nom: "8. 1596 saisi, l'API ne publie que 1486",
      e: entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: ["1486"], naf: "4120A" }),
      statut: "anomalie",
      cas: "c8_saisi_contredit_par_la_liste",
    },
    {
      nom: "9. 1234 saisi, absent de la table (même publié)",
      e: entree({ idccSaisi: "1234", opcoSaisi: "constructys", listeIdcc: ["1234"], naf: "4120A" }),
      statut: "anomalie",
      cas: "c9_saisi_inconnu_de_la_table",
    },
  ];

  it.each(cas)("$nom → $statut", ({ e, statut, cas: attendu }) => {
    const r = controlerIdcc(e);
    expect(r.statut).toBe(statut);
    expect(r.cas).toBe(attendu);
  });

  it("les neuf cas sont distincts et couvrent tous les statuts calculables", () => {
    expect(new Set(cas.map((c) => c.cas)).size).toBe(9);
    expect(new Set(cas.map((c) => c.statut))).toEqual(
      new Set(STATUTS_IDCC.filter((s) => s !== "confirme")),
    );
  });

  it("cas 2 : l'IDCC publié est une PROPOSITION, jamais une saisie", () => {
    const r = controlerIdcc(cas[1]!.e);
    expect(r).toMatchObject({ idcc: null, idccPropose: "1596" });
  });

  it("cas 4 et 5 portent l'issue de la part qui les a départagés", () => {
    expect(controlerIdcc(cas[3]!.e).part?.issue).toBe("concordant");
    expect(controlerIdcc(cas[4]!.e).part?.issue).toBe("a_confirmer");
    expect(controlerIdcc(cas[8]!.e).part?.issue).toBe("inconnu");
  });

  it("1596 + OPCO EP, publié : probable — l'OPCO à 1 SIRET ne passe pas", () => {
    const r = controlerIdcc(
      entree({ idccSaisi: "1596", opcoSaisi: "opco_ep", listeIdcc: ["1596"] }),
    );
    expect(r.statut).toBe("probable");
  });

  it("8822 + OCAPIAT, publié : probable", () => {
    const r = controlerIdcc(
      entree({ idccSaisi: "8822", opcoSaisi: "ocapiat", listeIdcc: ["8822"] }),
    );
    expect(r.statut).toBe("probable");
  });

  it("une saisie illisible est un IDCC inconnu (cas 9), jamais tronquée", () => {
    for (const idccSaisi of ["123456", "11596"]) {
      expect(controlerIdcc(entree({ idccSaisi, couples: [] })).cas).toBe(
        "c9_saisi_inconnu_de_la_table",
      );
    }
  });

  it("une saisie à zéro de tête est normalisée avant d'être confrontée", () => {
    const r = controlerIdcc(
      entree({
        idccSaisi: "01596",
        opcoSaisi: "constructys",
        listeIdcc: ["1596"],
        couples: couples("1596"),
      }),
    );
    expect(r).toMatchObject({ idcc: "1596", statut: "concordant" });
  });

  it("le NAF ne fait jamais monter un statut : l'OPCO du NAF seul ne donne pas « concordant »", () => {
    const r = controlerIdcc(
      entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: null, naf: "4120A" }),
    );
    expect(r.statut).not.toBe("concordant");
  });
});

// ─── Confirmation par preuve déclarative ───────────────────────────────────

describe("confirme ⇔ preuve déclarative typée, pour l'IDCC saisi", () => {
  const preuve = (idcc: string) => ({
    type: "attestation_entreprise" as const,
    idcc,
    auteurId: AUTEUR,
    le: new Date("2026-10-04T10:00:00Z"),
  });

  it("une preuve pour l'IDCC saisi → confirme, même sur une anomalie", () => {
    const r = controlerIdcc(
      entree({ idccSaisi: "1596", listeIdcc: ["1486"], preuve: preuve("1596") }),
    );
    expect(r).toMatchObject({ statut: "confirme", cas: "confirme_par_preuve" });
  });

  it("une preuve pour un AUTRE IDCC tombe : la saisie a changé, le contrôle reprend", () => {
    const r = controlerIdcc(
      entree({ idccSaisi: "8822", opcoSaisi: "akto", listeIdcc: ["8822"], preuve: preuve("1596") }),
    );
    expect(r.statut).toBe("probable");
  });

  it("aucun chemin ne CALCULE confirme sans preuve", () => {
    const sans = controlerIdcc(
      entree({ idccSaisi: "1596", opcoSaisi: "constructys", listeIdcc: ["1596"] }),
    );
    expect(sans.statut).toBe("concordant");
  });

  it("les types de preuve sont ceux du schéma, et le bulletin de paie n'en est pas", () => {
    const schema = lire("prisma/schema.prisma");
    expect(valeursEnum(schema, "PreuveIdccDeclarative")).toEqual([...PREUVES_IDCC_DECLARATIVES]);
    for (const v of PREUVES_IDCC_DECLARATIVES) expect(v).not.toMatch(/bulletin|paie|salaire/);
    expect(
      preuveDeclarativeSchema.safeParse({
        type: "bulletin_de_paie",
        idcc: "1596",
        auteurId: AUTEUR,
      }).success,
    ).toBe(false);
  });

  it("les cinq statuts sont ceux de l'énumération fermée du schéma", () => {
    expect(valeursEnum(lire("prisma/schema.prisma"), "StatutIdcc")).toEqual([...STATUTS_IDCC]);
  });
});

// ─── Témoins de sécurité : aucun téléversement, journal sans contenu ───────

/** Les valeurs d'un `enum` du schéma Prisma. */
function valeursEnum(schema: string, nom: string): string[] {
  const m = schema.match(new RegExp(`\\nenum ${nom} \\{([^}]*)\\}`));
  if (!m) throw new Error(`enum ${nom} introuvable`);
  return (m[1] as string)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
}

/** Les champs `[nom, type, attributs]` d'un modèle du schéma Prisma. */
function champsModele(schema: string, nom: string): Array<[string, string, string]> {
  const m = schema.match(new RegExp(`\\nmodel ${nom} \\{([^}]*)\\}`));
  if (!m) throw new Error(`model ${nom} introuvable`);
  return (m[1] as string)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("@@"))
    .map((l) => {
      const [champ, type, ...reste] = l.split(/\s+/);
      return [champ as string, type as string, reste.join(" ")];
    });
}

describe("TÉMOIN : aucun téléversement possible", () => {
  const schema = lire("prisma/schema.prisma");
  const NOM_DE_PIECE =
    /fichier|file|url|chemin|path|stockage|storage|piece|document|contenu|blob|scan/i;

  it("les deux tables n'ont aucune colonne de fichier, d'adresse ni de texte libre", () => {
    for (const modele of ["ClientIdccControle", "ClientIdccControleJournal"]) {
      for (const [champ, type, attributs] of champsModele(schema, modele)) {
        expect(champ, `${modele}.${champ}`).not.toMatch(NOM_DE_PIECE);
        expect(type, `${modele}.${champ}`).not.toMatch(/^Bytes|^Json/);
        if (/^String\??$/.test(type))
          expect(attributs, `${modele}.${champ}`).toMatch(/@db\.(Uuid|Char\(4\))/);
      }
    }
  });

  it("la preuve reçue est un schéma STRICT : une pièce jointe est refusée", () => {
    const base = { type: "declaration_opco", idcc: "1596", auteurId: AUTEUR };
    expect(preuveDeclarativeSchema.safeParse(base).success).toBe(true);
    for (const cle of ["fichier", "file", "url", "contenu", "piece", "le"]) {
      expect(preuveDeclarativeSchema.safeParse({ ...base, [cle]: "x" }).success, cle).toBe(false);
    }
  });

  it("le module ne manipule ni formulaire, ni fichier, ni stockage", () => {
    const src = lire("src/server/qualiopi/financements/idcc-controle.ts")
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join("\n");
    expect(src).not.toMatch(
      /FormData|\bBlob\b|\bFile\b|arrayBuffer|multipart|writeFile|putObject|upload/i,
    );
  });

  it("aucune route ne touche au contrôle IDCC (donc aucune route de téléversement)", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const fautes: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/^route\.tsx?$/.test(nom)) {
          const texte = readFileSync(chemin, "utf8");
          if (/idcc-controle|idccControle|client_idcc_controle|PreuveIdccDeclarative/.test(texte))
            fautes.push(chemin);
        }
      }
    };
    parcourir(join(RACINE, "src", "app"));
    expect(fautes).toEqual([]);
  });

  it("la migration pose les CHECK de la preuve, et aucune colonne de pièce", () => {
    const sql = lire("prisma/migrations/20261004231500_idcc_controle/migration.sql");
    expect(sql).toContain('"client_idcc_controles_confirme_preuve"');
    expect(sql).toContain('"client_idcc_controles_preuve_entiere"');
    expect(sql).toContain('"client_idcc_controle_journal_confirme_preuve"');
    const colonnes = [...sql.matchAll(/^\s+"([a-z_]+)" /gm)].map((m) => m[1] as string);
    for (const c of colonnes) expect(c).not.toMatch(NOM_DE_PIECE);
    expect(sql).not.toMatch(/\bBYTEA\b|\bJSONB?\b/i);
    expect(sql).not.toMatch(/\bDROP\b|ALTER TABLE "clients"/);
  });
});

/** Fausse base : une ligne de contrôle par client, un journal. */
function fausseBase() {
  const lignes = new Map<string, LigneControleIdcc & { clientId: string }>();
  const journal: EntreeJournalIdcc[] = [];
  const tx: TxControleIdcc = {
    clientIdccControle: {
      findUnique: async ({ where }) => {
        const l = lignes.get(where.clientId);
        return l ? { statut: l.statut, idcc: l.idcc } : null;
      },
      upsert: async ({ where, create, update }) => {
        const avant = lignes.get(where.clientId);
        const l = avant ? { ...avant, ...update } : { ...create };
        // Miroir des CHECK de la migration.
        const preuve = [l.preuveType, l.preuveAuteurId, l.preuveLe].filter(
          (v) => v !== null,
        ).length;
        if (preuve !== 0 && preuve !== 3) throw new Error("CHECK preuve_entiere");
        if ((l.statut === "confirme") !== (l.preuveType !== null && l.idcc !== null)) {
          throw new Error("CHECK confirme_preuve");
        }
        lignes.set(where.clientId, l);
        return l;
      },
    },
    clientIdccControleJournal: {
      create: async ({ data }) => {
        if (data.de === data.vers) throw new Error("CHECK journal_change");
        if (data.vers === "confirme" && (data.preuveType === null || data.auteurId === null)) {
          throw new Error("CHECK journal_confirme_preuve");
        }
        journal.push(data);
        return data;
      },
    },
  };
  const db: BaseControleIdcc = { $transaction: (fn) => fn(tx) };
  return { db, lignes, journal };
}

describe("TÉMOIN : le journal ne porte aucun contenu", () => {
  it("le modèle du journal n'a que des statuts, un type, un auteur, une date", () => {
    const champs = champsModele(lire("prisma/schema.prisma"), "ClientIdccControleJournal").map(
      (c) => c[0],
    );
    expect(champs).toEqual([
      "id",
      "clientId",
      "client",
      "de",
      "vers",
      "preuveType",
      "auteurId",
      "creeAt",
    ]);
  });

  it("une confirmation écrit une entrée sans IDCC, sans OPCO, sans texte", async () => {
    const { db, lignes, journal } = fausseBase();
    await confirmerIdccParPreuve(db, {
      clientId: CLIENT,
      idccSaisi: "1596",
      preuve: { type: "attestation_entreprise", idcc: "1596", auteurId: AUTEUR },
      maintenant: new Date("2026-10-04T12:00:00Z"),
    });
    expect(journal).toEqual([
      {
        clientId: CLIENT,
        de: null,
        vers: "confirme",
        preuveType: "attestation_entreprise",
        auteurId: AUTEUR,
      },
    ]);
    expect(JSON.stringify(journal)).not.toContain("1596");
    expect(lignes.get(CLIENT)).toMatchObject({
      statut: "confirme",
      idcc: "1596",
      preuveType: "attestation_entreprise",
      preuveAuteurId: AUTEUR,
      preuveLe: new Date("2026-10-04T12:00:00Z"),
    });
  });
});

describe("écritures du statut", () => {
  it("enregistrer un contrôle calculé journalise le changement, et rien s'il ne change pas", async () => {
    const { db, journal } = fausseBase();
    const r = controlerIdcc(entree({ idccSaisi: "8822", opcoSaisi: "akto", listeIdcc: ["8822"] }));
    expect(await enregistrerControleIdcc(db, { clientId: CLIENT, resultat: r })).toEqual({
      change: true,
    });
    expect(await enregistrerControleIdcc(db, { clientId: CLIENT, resultat: r })).toEqual({
      change: false,
    });
    expect(journal.map((j) => [j.de, j.vers])).toEqual([[null, "probable"]]);
  });

  it("« confirme » ne s'enregistre jamais comme un résultat calculé", async () => {
    const { db } = fausseBase();
    const r = controlerIdcc(
      entree({
        idccSaisi: "1596",
        preuve: { type: "declaration_opco", idcc: "1596", auteurId: AUTEUR, le: new Date() },
      }),
    );
    await expect(
      enregistrerControleIdcc(db, { clientId: CLIENT, resultat: r }),
    ).rejects.toBeInstanceOf(ConfirmationIdccRefusee);
  });

  it("l'IDCC saisi change : la confirmation tombe, ses champs sont effacés", async () => {
    const { db, lignes, journal } = fausseBase();
    await confirmerIdccParPreuve(db, {
      clientId: CLIENT,
      idccSaisi: "1596",
      preuve: { type: "attestation_entreprise", idcc: "1596", auteurId: AUTEUR },
    });
    const r = controlerIdcc(entree({ idccSaisi: "8822", opcoSaisi: "akto", listeIdcc: ["8822"] }));
    await enregistrerControleIdcc(db, { clientId: CLIENT, resultat: r });
    expect(lignes.get(CLIENT)).toMatchObject({
      statut: "probable",
      idcc: "8822",
      preuveType: null,
      preuveAuteurId: null,
      preuveLe: null,
    });
    expect(journal.map((j) => j.vers)).toEqual(["confirme", "probable"]);
  });

  it("une preuve qui ne porte pas sur l'IDCC de la fiche est refusée", async () => {
    const { db, lignes } = fausseBase();
    await expect(
      confirmerIdccParPreuve(db, {
        clientId: CLIENT,
        idccSaisi: "8822",
        preuve: { type: "attestation_entreprise", idcc: "1596", auteurId: AUTEUR },
      }),
    ).rejects.toBeInstanceOf(ConfirmationIdccRefusee);
    expect(lignes.size).toBe(0);
  });

  it("une preuve accompagnée d'un fichier est refusée avant toute écriture", async () => {
    const { db, lignes, journal } = fausseBase();
    await expect(
      confirmerIdccParPreuve(db, {
        clientId: CLIENT,
        idccSaisi: "1596",
        preuve: {
          type: "attestation_entreprise",
          idcc: "1596",
          auteurId: AUTEUR,
          fichier: "attestation.pdf",
        },
      }),
    ).rejects.toBeInstanceOf(ConfirmationIdccRefusee);
    expect(lignes.size + journal.length).toBe(0);
  });
});

describe("lecture de la table", () => {
  it("lit les couples de l'IDCC normalisé, et rien pour une saisie illisible", async () => {
    const appels: string[] = [];
    const db = {
      idccOpco: {
        findMany: async ({ where }: { where: { idcc: string } }) => {
          appels.push(where.idcc);
          return couples(where.idcc).map((c) => ({ ...c, opco: c.opco as OpcoId }));
        },
      },
    };
    expect(await lireCouplesIdcc(db, "01596")).toHaveLength(2);
    expect(await lireCouplesIdcc(db, "123456")).toEqual([]);
    expect(appels).toEqual(["1596"]);
  });
});
