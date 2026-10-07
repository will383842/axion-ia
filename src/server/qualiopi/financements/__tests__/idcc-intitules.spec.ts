/**
 * INT-T80-A — lecture du fichier des conventions collectives du ministère du
 * Travail, d'après la description d'A02 (axion-apporteurs #782, 6036523485).
 *
 * Le fichier réel n'est pas déposé : ces témoins reconstruisent un classeur
 * SYNTHÉTIQUE aux mêmes feuilles et aux mêmes colonnes, dont les quatre lignes
 * citées par A02 (données publiques).
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  CONVENTIONS_MINIMUM,
  FEUILLE_CONVENTIONS,
  FichierConventionsRefuse,
  lireConventions,
} from "../idcc-intitules";
import { normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";

const ENTETE = [
  "IDCC",
  "Libellé",
  "Régime",
  "Champ d'application",
  "IDCCactif",
  "NouvIDCC",
  "CRIS",
  "DateSignature",
  "DateEffet",
  "DateFin",
  "LibelléCourt",
] as const;

type Ligne = Array<string | number>;

/** Les quatre lignes lues dans le fichier réel par A02. */
const LIGNES_REELLES: Ligne[] = [
  [
    "01596",
    "Convention collective nationale concernant les ouvriers employés par les entreprises du bâtiment visées par le décret du 1er mars 1962 (c'est-à-dire occupant jusqu'à 10 salariés)",
    "Général",
    "National",
    1,
    "",
    "B10",
    33154,
    33298,
    "",
    "Bâtiment ouvriers jusqu'à 10 Salariés",
  ],
  [
    "00843",
    "Convention collective nationale de la boulangerie-pâtisserie entreprises artisanales",
    "Général",
    "National",
    1,
    "",
    "I31",
    27838,
    27851,
    "",
    "Boulangeries pâtisseries artisanales",
  ],
  [
    "03248",
    "Convention collective nationale de la métallurgie",
    "Général",
    "National",
    1,
    "",
    "A10",
    44599,
    45292,
    "",
    "Métallurgie",
  ],
  [
    "00001",
    "Convention collective pour le commerce stephanois, autre que…",
    "Général",
    "Local",
    0,
    "01415",
    "L23",
    13327,
    13327,
    31444,
    "Commerces de détail non alimentaire Loire St Étienne",
  ],
];

/** Du remplissage pour passer le plancher : IDCC 4000 + i, tous actifs. */
function remplissage(n: number): Ligne[] {
  return Array.from({ length: n }, (_, i) => [
    String(4000 + i).padStart(5, "0"),
    `Convention synthétique ${i}`,
    i % 7 === 0 ? "Agricole" : "Général",
    i % 2 === 0 ? "National" : "Local",
    1,
    "",
    "Z99",
    1,
    1,
    "",
    `Synthétique ${i}`,
  ]);
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function lettre(i: number): string {
  return String.fromCharCode(65 + i);
}

/** XML d'une feuille ; les textes en chaînes en ligne, sauf `partagees` (indices). */
function xmlFeuille(lignes: Ligne[], partagees?: string[]): string {
  const rows = lignes.map((l, r) => {
    const cells = l.map((v, c) => {
      const ref = `${lettre(c)}${r + 1}`;
      if (v === "") return `<c r="${ref}"/>`;
      if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
      if (partagees) {
        let idx = partagees.indexOf(v);
        if (idx < 0) idx = partagees.push(v) - 1;
        return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${echapper(v)}</t></is></c>`;
    });
    return `<row r="${r + 1}">${cells.join("")}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

async function classeur(
  options: {
    entete?: readonly string[];
    lignes?: Ligne[];
    nomFeuille?: string;
    chainesPartagees?: boolean;
    /** Colonnes dans un autre ordre : permutation des indices. */
    permutation?: number[];
  } = {},
): Promise<Buffer> {
  const entete = [...(options.entete ?? ENTETE)];
  let lignes = options.lignes ?? [...LIGNES_REELLES, ...remplissage(CONVENTIONS_MINIMUM)];
  let tete: Array<string | number> = entete;
  if (options.permutation) {
    const p = options.permutation;
    tete = p.map((i) => entete[i] ?? "");
    lignes = lignes.map((l) => p.map((i) => l[i] ?? ""));
  }
  const partagees = options.chainesPartagees ? [] : undefined;
  const feuille2 = xmlFeuille([tete, ...lignes], partagees);
  const accords = xmlFeuille([
    ["CODE", "Libellé"],
    ["VRP", "Voyageurs représentants placiers"],
  ]);
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lisez-moi" sheetId="1" r:id="rId1"/><sheet name="Accords et statuts" sheetId="3" r:id="rId3"/><sheet name="${options.nomFeuille ?? FEUILLE_CONVENTIONS}" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="x" Target="worksheets/sheet3.xml"/></Relationships>`,
  );
  zip.file("xl/worksheets/sheet1.xml", xmlFeuille([["Lisez-moi"]]));
  zip.file("xl/worksheets/sheet2.xml", feuille2);
  zip.file("xl/worksheets/sheet3.xml", accords);
  if (partagees) {
    zip.file(
      "xl/sharedStrings.xml",
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${partagees
        .map((s) => `<si><t>${echapper(s)}</t></si>`)
        .join("")}</sst>`,
    );
  }
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

const refus = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("le fichier aurait dû être refusé");
    },
    (e: unknown) => {
      expect(e).toBeInstanceOf(FichierConventionsRefuse);
      return (e as Error).message;
    },
  );

describe("lireConventions", () => {
  it("lit les quatre lignes réelles : IDCC sur 4 chiffres, état, successeur", async () => {
    const { conventions } = await lireConventions(await classeur());
    const par = new Map(conventions.map((c) => [c.idcc, c]));
    expect(par.get("1596")).toMatchObject({
      actif: true,
      successeurIdcc: null,
      regime: "general",
      champ: "national",
      intituleCourt: "Bâtiment ouvriers jusqu'à 10 Salariés",
    });
    expect(par.get("1596")!.intitule).toContain("du bâtiment visées par le décret");
    expect(par.get("0843")).toMatchObject({
      actif: true,
      intituleCourt: "Boulangeries pâtisseries artisanales",
    });
    expect(par.get("3248")).toMatchObject({ actif: true });
    // Une convention INACTIVE est gardée, avec son successeur (lui-même normalisé).
    expect(par.get("0001")).toMatchObject({
      actif: false,
      successeurIdcc: "1415",
      champ: "local",
    });
    expect(conventions).toHaveLength(LIGNES_REELLES.length + CONVENTIONS_MINIMUM);
  });

  it("`01596` et `1596` désignent la MÊME ligne de idcc_opco (témoin des deux formes)", async () => {
    expect(normaliserIdcc("01596")).toBe("1596");
    expect(normaliserIdcc("1596")).toBe("1596");
    const { conventions } = await lireConventions(await classeur());
    expect(conventions.filter((c) => c.idcc === "1596")).toHaveLength(1);
    // Et la même forme, du fichier comme de la SIRO, sur 4 chiffres.
    expect(conventions.every((c) => /^[0-9]{4}$/.test(c.idcc))).toBe(true);
  });

  it("lit la feuille par son NOM, quelle que soit sa place, et ignore « Accords et statuts »", async () => {
    const { conventions } = await lireConventions(await classeur());
    expect(conventions.some((c) => c.intitule.includes("Voyageurs"))).toBe(false);
  });

  it("lit l'en-tête par ses INTITULÉS : les colonnes dans un autre ordre donnent le même résultat", async () => {
    const normal = await lireConventions(await classeur());
    const permute = await lireConventions(
      await classeur({ permutation: [10, 0, 5, 3, 2, 1, 4, 6, 7, 8, 9] }),
    );
    expect(permute.conventions).toEqual(normal.conventions);
  });

  it("lit aussi les chaînes PARTAGÉES (le format habituel d'Excel)", async () => {
    const a = await lireConventions(await classeur());
    const b = await lireConventions(await classeur({ chainesPartagees: true }));
    expect(b.conventions).toEqual(a.conventions);
  });

  it("décode les entités XML des intitulés", async () => {
    const lignes = [
      ["01234", "Convention <&> « test »", "Général", "National", 1, "", "", 1, 1, "", "T & T"],
      ...remplissage(CONVENTIONS_MINIMUM),
    ];
    const { conventions } = await lireConventions(await classeur({ lignes }));
    const c = conventions.find((x) => x.idcc === "1234")!;
    expect(c.intitule).toBe("Convention <&> « test »");
    expect(c.intituleCourt).toBe("T & T");
  });

  it("ne lit PAS les dates (numéros de série Excel) : aucune n'apparaît dans le résultat", async () => {
    const { conventions } = await lireConventions(await classeur());
    expect(JSON.stringify(conventions[0])).not.toMatch(/33154|33298/);
  });

  it("donne le sha256 et la taille du fichier lu", async () => {
    const f = await classeur();
    const l = await lireConventions(f);
    expect(l.sha256).toBe(createHash("sha256").update(f).digest("hex"));
    expect(l.octets).toBe(f.length);
  });
});

describe("lireConventions — les refus, AVANT toute écriture", () => {
  it("fichier vide, ou qui n'est pas un classeur", async () => {
    await refus(lireConventions(Buffer.alloc(0)));
    expect(await refus(lireConventions(Buffer.from("IDCC;Libellé")))).toContain("XLSX");
  });

  it("feuille « Conventions de branche » absente", async () => {
    const m = await refus(lireConventions(await classeur({ nomFeuille: "Autre feuille" })));
    expect(m).toContain("Conventions de branche");
  });

  it("une colonne attendue manque : le fichier est refusé, elle est nommée", async () => {
    for (const manquante of [
      "IDCC",
      "Libellé",
      "Régime",
      "Champ d'application",
      "IDCCactif",
      "NouvIDCC",
      "LibelléCourt",
    ]) {
      const entete = ENTETE.map((t) => (t === manquante ? `${t} renommée` : t));
      const m = await refus(lireConventions(await classeur({ entete })));
      expect(m).toContain(manquante);
    }
  });

  it("un IDCC en double (même sous deux formes) est refusé", async () => {
    const lignes = [
      ...LIGNES_REELLES,
      [...LIGNES_REELLES[0]!.slice(0, 0), "1596", ...LIGNES_REELLES[0]!.slice(1)],
      ...remplissage(CONVENTIONS_MINIMUM),
    ] as Ligne[];
    expect(await refus(lireConventions(await classeur({ lignes })))).toContain("en double");
  });

  it("IDCC illisible, intitulé vide, état ni 0 ni 1, régime ou champ inconnu, successeur illisible", async () => {
    const base = LIGNES_REELLES[1]!;
    const cas: Array<[string, Ligne]> = [
      ["illisible", ["abc", ...base.slice(1)]],
      ["sans intitulé", [base[0]!, "  ", ...base.slice(2)]],
      ["ni 0 ni 1", [base[0]!, base[1]!, base[2]!, base[3]!, 2, ...base.slice(5)]],
      ["régime", [base[0]!, base[1]!, "Mixte", ...base.slice(3)]],
      ["champ d'application", [base[0]!, base[1]!, base[2]!, "Régional", ...base.slice(4)]],
      ["successeur illisible", [base[0]!, base[1]!, base[2]!, base[3]!, 0, "xx", ...base.slice(6)]],
    ];
    for (const [attendu, ligne] of cas) {
      const lignes = [ligne, ...remplissage(CONVENTIONS_MINIMUM)];
      expect(await refus(lireConventions(await classeur({ lignes })))).toContain(attendu);
    }
  });

  it("un fichier tronqué (sous le plancher) est refusé : il n'efface pas la table", async () => {
    const lignes = [...LIGNES_REELLES, ...remplissage(10)];
    expect(await refus(lireConventions(await classeur({ lignes })))).toContain("douteux");
  });
});
