/**
 * L'archive .pptx, vérifiée pièce par pièce.
 *
 * PowerPoint ne diagnostique pas : devant une archive incohérente il dit
 * seulement que le fichier est « endommagé ». Ces tests remplacent le message
 * d'erreur qu'on n'aura jamais — ils vérifient ce qui, concrètement, rend une
 * archive OOXML ouvrable :
 *
 *  1. chaque partie XML est bien formée — une seule esperluette non échappée
 *     dans le contenu pédagogique suffit à tout casser ;
 *  2. chaque `Override` de `[Content_Types].xml` désigne une partie qui existe ;
 *  3. chaque relation pointe vers une cible présente dans l'archive ;
 *  4. chaque slide déclarée dans `sldIdLst` a bien sa relation et son fichier.
 */

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { XMLValidator, XMLParser } from "fast-xml-parser";

import { construireDeck, type Deck } from "./deck";
import { rendreDeckEnPptx } from "./render-pptx";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { buildFormationImportData } from "@/server/qualiopi/formations/catalog-import";
import type { ModuleProgramme } from "../types";

let deck: Deck;
let zip: JSZip;
let fichiers: string[];

beforeAll(async () => {
  const f = FORMATIONS_V2.find((x) => x.id === "ia-pour-les-rh")!;
  const data = buildFormationImportData(f, "offre-x");
  deck = construireDeck({
    titreFormation: data.titre,
    modules: data.programmeDetaille as unknown as ModuleProgramme[],
    dureeHeures: data.dureeHeures,
  });
  zip = await JSZip.loadAsync(await rendreDeckEnPptx(deck));
  fichiers = Object.keys(zip.files);
});

/**
 * Résout une cible de relation, relative au dossier qui contient le `.rels`.
 *
 * `new URL` ne convient pas : une base vide (les relations de la racine)
 * produirait un chemin à double barre. La résolution des `..` d'OOXML tient en
 * quatre lignes, autant les écrire.
 */
function resoudre(dossier: string, cible: string): string {
  const segments = dossier === "" ? [] : dossier.split("/");
  for (const partie of cible.split("/")) {
    if (partie === "..") segments.pop();
    else if (partie !== "." && partie !== "") segments.push(partie);
  }
  return segments.join("/");
}

/** Contenu texte d'une partie de l'archive. */
async function lire(chemin: string): Promise<string> {
  const fichier = zip.file(chemin);
  expect(fichier, `partie absente : ${chemin}`).not.toBeNull();
  return fichier!.async("string");
}

describe("l'archive contient les pièces obligatoires", () => {
  it("porte le manifeste, la présentation, le masque et le thème", () => {
    for (const requis of [
      "[Content_Types].xml",
      "_rels/.rels",
      "ppt/presentation.xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/theme/theme1.xml",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/notesMasters/notesMaster1.xml",
    ]) {
      expect(fichiers, requis).toContain(requis);
    }
  });

  it("écrit une slide par slide du deck", () => {
    const slides = fichiers.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(deck.slides.length);
  });

  /**
   * Une page de notes n'existe QUE si la slide en porte. Une page de notes vide
   * déclarée dans le manifeste est précisément le genre d'incohérence qui fait
   * dire à PowerPoint que le fichier est endommagé.
   */
  it("écrit une page de notes exactement pour les slides qui en ont", () => {
    const attendu = deck.slides.filter((s) => s.notes !== undefined).length;
    const notes = fichiers.filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    expect(notes).toHaveLength(attendu);
    expect(attendu).toBeGreaterThan(0);
  });
});

describe("chaque partie XML est bien formée", () => {
  /**
   * 🔴 Le contenu pédagogique est plein de guillemets français, d'apostrophes et
   * d'esperluettes. Une seule « & » non échappée rend l'archive entière
   * illisible — et c'est le genre de défaut qui n'apparaît que sur la formation
   * où quelqu'un a écrit « R&D ».
   */
  it("aucune partie ne casse le parseur", async () => {
    const parties = fichiers.filter((f) => f.endsWith(".xml") || f.endsWith(".rels"));
    expect(parties.length).toBeGreaterThan(10);

    for (const partie of parties) {
      const xml = await lire(partie);
      const verdict = XMLValidator.validate(xml);
      expect(verdict, `${partie} : ${JSON.stringify(verdict)}`).toBe(true);
    }
  });

  it("échappe réellement les caractères qui cassent le XML", async () => {
    const piege = await rendreDeckEnPptx({
      titre: "R&D <urgent> « test »",
      sousTitre: "x",
      slides: [
        {
          layout: "enonce",
          fond: "ivoire",
          titre: 'Comparer R&D & "qualité" <avant/après>',
          corps: ["a & b < c > d"],
          notes: "Notes avec & et < et > et \"guillemets\" et 'apostrophes'",
        },
      ],
    });
    const archive = await JSZip.loadAsync(piege);
    for (const nom of Object.keys(archive.files).filter((f) => f.endsWith(".xml"))) {
      const xml = await archive.file(nom)!.async("string");
      expect(XMLValidator.validate(xml), nom).toBe(true);
    }
  });
});

describe("l'archive est cohérente avec elle-même", () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });

  it("chaque Override du manifeste désigne une partie présente", async () => {
    const manifeste = parser.parse(await lire("[Content_Types].xml")) as {
      Types: { Override: Array<{ "@PartName": string }> };
    };
    for (const o of manifeste.Types.Override) {
      const chemin = o["@PartName"].replace(/^\//, "");
      expect(fichiers, `déclarée au manifeste mais absente : ${chemin}`).toContain(chemin);
    }
  });

  /**
   * L'erreur la plus facile à commettre et la plus opaque à diagnostiquer : une
   * relation qui pointe vers un fichier qu'on a oublié d'écrire.
   */
  it("chaque relation pointe vers une cible réellement présente", async () => {
    const relsFiles = fichiers.filter((f) => f.endsWith(".rels"));
    for (const rels of relsFiles) {
      const parsed = parser.parse(await lire(rels)) as {
        Relationships: { Relationship: unknown };
      };
      const brut = parsed.Relationships.Relationship;
      const liste = (Array.isArray(brut) ? brut : [brut]) as Array<{ "@Target": string }>;

      // « ppt/slides/_rels/slide1.xml.rels » → « ppt/slides »
      // « _rels/.rels » → racine de l'archive, donc chaîne vide.
      const dossier = rels.includes("/") ? rels.replace(/\/?_rels\/[^/]+$/, "") : "";
      for (const r of liste) {
        expect(fichiers, `${rels} → cible absente : ${r["@Target"]}`).toContain(
          resoudre(dossier, r["@Target"]),
        );
      }
    }
  });

  it("chaque slide de sldIdLst a sa relation et son fichier", async () => {
    const presentation = parser.parse(await lire("ppt/presentation.xml")) as {
      "p:presentation": { "p:sldIdLst": { "p:sldId": Array<{ "@r:id": string }> } };
    };
    const sldIds = presentation["p:presentation"]["p:sldIdLst"]["p:sldId"];
    expect(sldIds).toHaveLength(deck.slides.length);

    const rels = parser.parse(await lire("ppt/_rels/presentation.xml.rels")) as {
      Relationships: { Relationship: Array<{ "@Id": string; "@Target": string }> };
    };
    const parId = new Map<string, string>(
      rels.Relationships.Relationship.map((r) => [r["@Id"], r["@Target"]]),
    );

    for (const s of sldIds) {
      const cible = parId.get(s["@r:id"]);
      expect(cible, `sldId sans relation : ${s["@r:id"]}`).toBeDefined();
      expect(fichiers).toContain(`ppt/${cible}`);
    }
  });
});

describe("le contenu arrive bien dans le fichier", () => {
  it("le prompt de démonstration est écrit EN ENTIER dans la slide", async () => {
    const indexPrompt = deck.slides.findIndex((s) => s.layout === "prompt");
    expect(indexPrompt).toBeGreaterThanOrEqual(0);
    const attendu = deck.slides[indexPrompt]!.corps![0]!;
    const xml = await lire(`ppt/slides/slide${indexPrompt + 1}.xml`);

    // Le prompt est découpé en paragraphes sur les retours à la ligne : on
    // vérifie que chaque ligne y est, échappée.
    for (const ligne of attendu.split("\n").filter((l) => l.trim().length > 0)) {
      const echappee = ligne
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      expect(xml, `ligne de prompt absente : ${ligne.slice(0, 40)}`).toContain(echappee);
    }
  });

  /**
   * La raison d'être du diaporama généré : le formateur voit son aide en mode
   * présentateur, la salle ne la voit pas. Si les notes n'atterrissaient pas
   * dans `notesSlide`, le document n'aurait aucun intérêt sur un .pptx déposé.
   */
  it("les notes du formateur atterrissent dans la page de notes, pas dans la slide", async () => {
    const index = deck.slides.findIndex((s) => s.notes?.includes("PLAN B") === true);
    expect(index).toBeGreaterThanOrEqual(0);

    const notes = await lire(`ppt/notesSlides/notesSlide${index + 1}.xml`);
    expect(notes).toContain("PLAN B");

    const slide = await lire(`ppt/slides/slide${index + 1}.xml`);
    expect(slide).not.toContain("PLAN B");
  });
});

describe("l'archive est reproductible", () => {
  /**
   * 🔴 Le défaut le plus coûteux du générateur, et le plus discret. JSZip
   * horodate chaque entrée — fichiers ET dossiers intermédiaires — à l'instant
   * présent. Deux rendus d'un contenu IDENTIQUE produisaient donc des octets
   * différents, et l'action de génération, qui dédoublonne sur l'empreinte
   * SHA-256, aurait créé une version à CHAQUE clic.
   *
   * Il a échappé à un premier test parce que l'horodatage ZIP a une granularité
   * de DEUX SECONDES : deux rendus consécutifs tombent dans le même intervalle
   * et paraissent identiques. Ce test force l'écart.
   */
  it("deux rendus du même deck, espacés dans le temps, donnent les mêmes octets", async () => {
    const contenu = {
      titre: "Reproductibilité",
      sousTitre: "x",
      slides: [
        { layout: "enonce" as const, fond: "ivoire" as const, titre: "Un énoncé de test" },
        { layout: "points" as const, fond: "mocha" as const, titre: "Acquis", corps: ["A", "B"] },
      ],
    };
    const premier = await rendreDeckEnPptx(contenu);
    await new Promise((r) => setTimeout(r, 2500));
    const second = await rendreDeckEnPptx(contenu);

    expect(second.equals(premier)).toBe(true);
  }, 15000);

  it("un contenu différent donne bien des octets différents", async () => {
    const base = { titre: "T", sousTitre: "x" };
    const a = await rendreDeckEnPptx({
      ...base,
      slides: [{ layout: "enonce", fond: "ivoire", titre: "Premier énoncé" }],
    });
    const b = await rendreDeckEnPptx({
      ...base,
      slides: [{ layout: "enonce", fond: "ivoire", titre: "Second énoncé" }],
    });
    expect(b.equals(a)).toBe(false);
  });
});
