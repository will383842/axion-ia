/**
 * Console éditoriale — tests des exports (critères 9 et 10 du lot 1).
 *
 * Le critère 9 dit « un fichier OUVRABLE, avec corps et premier commentaire ».
 * Le mot qui compte est « ouvrable » : un CSV dont une cellule casse la
 * structure s'ouvre quand même, en décalant tout — et l'erreur ne se voit
 * qu'à la quarantième ligne. Ces tests visent donc ce qui CASSE la structure.
 *
 * Le critère 10 dit « se télécharge ET SE RELIT ». La relecture est la moitié
 * qu'on oublie : une sauvegarde qu'on ne sait pas relire est un fichier, pas
 * une sauvegarde.
 */

import { describe, it, expect } from "vitest";
import {
  echapperCellule,
  construireCsv,
  nomFichierCsv,
  assemblerSauvegarde,
  serialiserSauvegarde,
  relireSauvegarde,
  nomFichierSauvegarde,
  COLONNES_CSV,
  VERSION_SAUVEGARDE,
  type PublicationExportable,
  neutraliserFormule,
} from "./exports";

function publication(patch: Partial<PublicationExportable> = {}): PublicationExportable {
  return {
    refImport: "linkedin-2026-q4-04",
    datePrevue: "2026-09-04",
    heurePrevue: "07:45",
    compteLibelle: "LinkedIn — Profil personnel Williams Jullin",
    identite: "perso",
    titreInterne: "Trois signaux qu'un processus vous coûte",
    accroche: "Trois signaux qu'un processus vous coûte",
    corps: "Automatiser une relance client.",
    premierCommentaire: "Le détail est ici.",
    tags: ["IAPourPME", "GainDeTemps"],
    lienUrl: "https://axion-ia.com/fr/appel?utm_source=linkedin",
    statutRedaction: "redige",
    statutAsset: "non_requis",
    statutDiffusion: "non_programme",
    urlPubliee: null,
    cheminsMedias: [],
    ...patch,
  };
}

/** Découpe un CSV `;` en respectant les champs cités — le miroir du test. */
function relireCsv(texte: string): string[][] {
  const sansBom = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
  const lignes: string[][] = [];
  let cellules: string[] = [];
  let courante = "";
  let cite = false;
  for (let i = 0; i < sansBom.length; i += 1) {
    const c = sansBom[i];
    if (cite) {
      if (c === '"') {
        if (sansBom[i + 1] === '"') {
          courante += '"';
          i += 1;
        } else cite = false;
      } else courante += c;
      continue;
    }
    if (c === '"') cite = true;
    else if (c === ";") {
      cellules.push(courante);
      courante = "";
    } else if (c === "\n") {
      cellules.push(courante);
      lignes.push(cellules);
      cellules = [];
      courante = "";
    } else if (c !== "\r") courante += c;
  }
  if (courante || cellules.length) {
    cellules.push(courante);
    lignes.push(cellules);
  }
  return lignes.filter((l) => l.some((c) => c !== ""));
}

describe("echapperCellule", () => {
  it("laisse une valeur simple telle quelle", () => {
    expect(echapperCellule("bonjour")).toBe("bonjour");
  });

  it("🔴 cite une valeur contenant le séparateur", () => {
    expect(echapperCellule("gauche ; droite")).toBe('"gauche ; droite"');
  });

  it("🔴 DOUBLE les guillemets à l'intérieur d'un champ cité", () => {
    expect(echapperCellule('il a dit "oui"')).toBe('"il a dit ""oui"""');
  });

  it("🔴 cite un texte à SAUTS DE LIGNE — la forme normale d'un post", () => {
    // Sans cela, une seule publication produirait quinze lignes de CSV.
    expect(echapperCellule("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
  });
});

describe("construireCsv", () => {
  it("commence par le BOM UTF-8, sinon Excel affiche « Ã© »", () => {
    expect(construireCsv([publication()]).charCodeAt(0)).toBe(0xfeff);
  });

  it("sépare les lignes en CRLF, comme un export tableur Windows", () => {
    expect(construireCsv([publication()])).toContain("\r\n");
  });

  it("porte les seize colonnes annoncées", () => {
    const lignes = relireCsv(construireCsv([publication()]));
    expect(lignes[0]).toEqual([...COLONNES_CSV]);
    expect(lignes[0]).toHaveLength(16);
  });

  it("🔴 porte le corps ET le premier commentaire — critère 9", () => {
    const lignes = relireCsv(construireCsv([publication()]));
    const entetes = lignes[0]!;
    const valeurs = lignes[1]!;
    expect(valeurs[entetes.indexOf("corps")]).toBe("Automatiser une relance client.");
    expect(valeurs[entetes.indexOf("premier_commentaire")]).toBe("Le détail est ici.");
  });

  it("🔴 reste OUVRABLE avec un corps qui contient « ; », guillemets et sauts de ligne", () => {
    // Le cas qui décale tout un fichier sans qu'on s'en aperçoive.
    const corps = 'Premier point ; deuxième.\n\nIl a dit "oui".\nEt puis : la suite.';
    const lignes = relireCsv(construireCsv([publication({ corps })]));
    expect(lignes).toHaveLength(2); // en-tête + UNE ligne, pas cinq
    const valeurs = lignes[1]!;
    expect(valeurs).toHaveLength(16);
    expect(valeurs[lignes[0]!.indexOf("corps")]).toBe(corps);
  });

  it("rend « vide » et non « null » pour un champ absent", () => {
    const lignes = relireCsv(construireCsv([publication({ accroche: null, lienUrl: null })]));
    const entetes = lignes[0]!;
    expect(lignes[1]![entetes.indexOf("accroche")]).toBe("");
    expect(lignes[1]![entetes.indexOf("lien")]).toBe("");
  });

  it("joint les tags par un espace, sans croisillon", () => {
    const lignes = relireCsv(construireCsv([publication()]));
    expect(lignes[1]![lignes[0]!.indexOf("tags")]).toBe("IAPourPME GainDeTemps");
  });

  it("rend un fichier à en-tête seule pour une liste vide", () => {
    const lignes = relireCsv(construireCsv([]));
    expect(lignes).toHaveLength(1);
  });

  it("garde une ligne par publication sur un lot", () => {
    const lot = Array.from({ length: 30 }, (_, i) =>
      publication({ titreInterne: `Publication ${i}`, corps: `Corps ; ${i}\nsuite` }),
    );
    expect(relireCsv(construireCsv(lot))).toHaveLength(31);
  });
});

describe("nomFichierCsv", () => {
  it("complète le mois sur deux chiffres, pour que le tri fonctionne", () => {
    expect(nomFichierCsv(2026, 9)).toBe("publications-2026-09.csv");
    expect(nomFichierCsv(2026, 12)).toBe("publications-2026-12.csv");
  });
});

describe("la sauvegarde complète", () => {
  const horodatage = new Date("2026-08-21T05:30:00.000Z");

  it("compte ses lignes table par table", () => {
    const s = assemblerSauvegarde({ publications: [{ a: 1 }, { a: 2 }], comptes: [] }, horodatage);
    expect(s.compte.publications).toBe(2);
    expect(s.compte.comptes).toBe(0);
    expect(s.version).toBe(VERSION_SAUVEGARDE);
    expect(s.genereeA).toBe("2026-08-21T05:30:00.000Z");
  });

  it("🔴 sérialise un BigInt sans lever — `poidsOctets` en est un", () => {
    // Sans le remplaçant, `JSON.stringify` lève « Do not know how to
    // serialize a BigInt » au premier asset pesé.
    const s = assemblerSauvegarde(
      { assets: [{ poidsOctets: 9_007_199_254_740_993n }] },
      horodatage,
    );
    expect(() => serialiserSauvegarde(s)).not.toThrow();
    expect(serialiserSauvegarde(s)).toContain("9007199254740993");
  });

  it("sérialise les dates en ISO", () => {
    const s = assemblerSauvegarde({ x: [{ d: new Date("2026-09-04T00:00:00Z") }] }, horodatage);
    expect(serialiserSauvegarde(s)).toContain("2026-09-04T00:00:00.000Z");
  });

  it("🔴 se RELIT — l'autre moitié du critère 10", () => {
    const s = assemblerSauvegarde(
      { publications: [{ id: "a", corps: "Un ; deux\ntrois" }] },
      horodatage,
    );
    const relu = relireSauvegarde(serialiserSauvegarde(s));
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    expect(relu.sauvegarde.compte.publications).toBe(1);
    expect((relu.sauvegarde.contenu.publications as { corps: string }[])[0]!.corps).toBe(
      "Un ; deux\ntrois",
    );
  });

  it("REFUSE un JSON illisible, en disant pourquoi", () => {
    const r = relireSauvegarde("{ ceci n'est pas du json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toMatch(/illisible/i);
  });

  it("REFUSE un objet sans version", () => {
    const r = relireSauvegarde(JSON.stringify({ contenu: {} }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toMatch(/version/i);
  });

  it("🔴 REFUSE une sauvegarde PLUS RÉCENTE que la console", () => {
    // Relire un format qu'on ne connaît pas, c'est perdre des données en
    // silence. Mieux vaut refuser et le dire.
    const r = relireSauvegarde(
      JSON.stringify({ version: VERSION_SAUVEGARDE + 1, contenu: {}, compte: {} }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toMatch(/mettez la console à jour/i);
  });

  it("REFUSE un contenu absent", () => {
    const r = relireSauvegarde(JSON.stringify({ version: 1 }));
    expect(r.ok).toBe(false);
  });

  it("nomme le fichier par sa date, pour qu'il se range seul", () => {
    expect(nomFichierSauvegarde(horodatage)).toBe("sauvegarde-console-editoriale-2026-08-21.json");
  });
});

describe("neutraliserFormule — l'export Excel n'exécute pas ce qu'on y a écrit", () => {
  it("🔴 neutralise l'injection de formule signalée par la passe 4", () => {
    // L'export porte un BOM UTF-8 et des CRLF : il est FAIT pour Excel, qui
    // interprète une cellule commençant par « = » comme une formule.
    const attaque = "=cmd|' /C calc'!A0";
    expect(neutraliserFormule(attaque)).toBe("'" + attaque);
    // Le texte reste intégral — on préfixe, on ne mutile pas.
    expect(neutraliserFormule(attaque)).toContain(attaque);
  });

  it("neutralise les quatre amorces, plus la tabulation et le retour chariot", () => {
    for (const c of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(neutraliserFormule(c + "SUM(A1)"), c).toBe("'" + c + "SUM(A1)");
    }
  });

  it("🔴 ne touche PAS un texte ordinaire — un export mutilé serait un autre bug", () => {
    for (const v of ["Automatiser une relance", "2026-09-15", "#RGPD", "", "Œuvre"]) {
      expect(neutraliserFormule(v), v).toBe(v);
    }
  });

  it("neutralise AVANT de citer, pour que le tableur ne voie pas l'amorce", () => {
    // Une cellule qui contient un « ; » est citée. Si on citait d'abord, la
    // cellule commencerait par un guillemet et l'amorce passerait inaperçue
    // à l'inspection — mais le tableur, lui, la verrait après décitation.
    const sortie = echapperCellule("=1+1;puis");
    expect(sortie.startsWith("\"'=")).toBe(true);
  });

  it("neutralise dans le CSV COMPLET, pas seulement dans la fonction", () => {
    // 🔴 Le §1 du protocole : « une garde ne vaut que si elle rougit sur
    // l'objet qui casse ». On vérifie donc la sortie réelle de l'export.
    const csv = construireCsv([
      {
        refImport: null,
        datePrevue: "2026-09-15",
        heurePrevue: "09:00",
        compteLibelle: "Profil",
        identite: "perso",
        titreInterne: "=cmd|' /C calc'!A0",
        accroche: null,
        corps: null,
        premierCommentaire: null,
        tags: [],
        lienUrl: null,
        statutRedaction: "idee",
        statutAsset: "aucun",
        statutDiffusion: "non_programme",
        urlPubliee: null,
        cheminsMedias: [],
      },
    ]);
    expect(csv).not.toContain(";=cmd");
    expect(csv).toContain(";'=cmd");
  });
});
