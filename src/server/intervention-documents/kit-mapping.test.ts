import { describe, it, expect } from "vitest";
import {
  classifyEntry,
  resolveSlug,
  resolveSlugs,
  slugifyFolder,
  buildKitR2Key,
  FILE_TO_SLOT,
  UN_A_UN_FILE_TO_SLOT,
  UN_A_UN_FOLDER_TO_SLUGS,
  DIAPORAMA_SLOT_KEY,
} from "./kit-mapping";
import { getSlot, getInterventionBySlug } from "@/content/intervention-documents-catalog";

describe("kit-mapping — formation", () => {
  it("classe un livret PDF → slug + slot + pdf", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_PDF/01_Livret_Apprenant.pdf");
    expect(c).toMatchObject({
      slugs: ["ia-express"],
      slot: "livret_apprenant",
      kind: "pdf",
      ext: "pdf",
    });
  });

  it("classe un livret DOCX → source", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_DOCX/01_Livret_Apprenant.docx");
    expect(c).toMatchObject({ slot: "livret_apprenant", kind: "source", ext: "docx" });
  });

  it("mappe les préfixes vers les clés de slot du catalogue", () => {
    expect(FILE_TO_SLOT["01"]).toBe("livret_apprenant");
    expect(FILE_TO_SLOT["06"]).toBe("programme");
    expect(FILE_TO_SLOT["07"]).toBe("scenario_pedagogique");
    // 08/09/10 absents (générés par la plateforme).
    expect(FILE_TO_SLOT["08"]).toBeUndefined();
  });

  it("ignore les slots générés par la plateforme (08/09/10)", () => {
    expect(classifyEntry("IA_Securite/Documents_PDF/08_Test_Positionnement.pdf")).toBeNull();
    expect(classifyEntry("IA_Securite/Documents_PDF/09_Evaluation_Satisfaction.pdf")).toBeNull();
    expect(classifyEntry("IA_Securite/Documents_PDF/10_Attestation_Emargement.pdf")).toBeNull();
  });

  it("classe le diaporama (.pptx source + slides .pdf)", () => {
    expect(classifyEntry("Art_du_Prompt/00_Presentation/Formation.pptx")).toMatchObject({
      slot: "diaporama",
      kind: "source",
      ext: "pptx",
    });
    expect(classifyEntry("Art_du_Prompt/00_Presentation/Formation_SLIDES.pdf")).toMatchObject({
      slot: "diaporama",
      kind: "pdf",
    });
  });

  it("résout les 7 slugs connus", () => {
    expect(resolveSlug("Formation_IA_Express")).toBe("ia-express");
    expect(resolveSlug("IA_Commercial")).toBe("ia-commercial");
    expect(resolveSlug("IA_Bureau_Rapide")).toBe("ia-au-bureau");
  });

  it("slugifie en fallback un dossier inconnu (tolérance d'évolution)", () => {
    expect(slugifyFolder("Formation_Nouvelle_Formation")).toBe("nouvelle-formation");
    expect(resolveSlug("IA_Toute_Nouvelle")).toBe("ia-toute-nouvelle");
  });

  it("construit la clé R2 canonique", () => {
    expect(buildKitR2Key("ia-express", "livret_apprenant", 2, "source", "docx")).toBe(
      "interventions/ia-express/livret_apprenant/v2/source.docx",
    );
  });

  // Verrou de cohérence : chaque slot du kit DOIT exister dans le catalogue
  // (SSOT) et ne pas être generatedOnly — sinon l'import écrirait une visibilité
  // / catégorie incohérente avec l'UI manuelle.
  it("chaque slot importé existe dans le catalogue formation (non généré)", () => {
    const slots = [...Object.values(FILE_TO_SLOT), DIAPORAMA_SLOT_KEY];
    for (const slotKey of slots) {
      const def = getSlot("formation", slotKey);
      expect(def, `slot ${slotKey} absent du catalogue`).toBeDefined();
      expect(def?.generatedOnly ?? false, `slot ${slotKey} est generatedOnly`).toBe(false);
    }
  });

  it("ignore les chemins non pertinents", () => {
    expect(classifyEntry("Formation_IA_Express/README.txt")).toBeNull();
    expect(classifyEntry("Formation_IA_Express/Documents_PDF/06_Programme.txt")).toBeNull();
  });
});

describe("kit-mapping — 1-to-1 (un_a_un)", () => {
  it("classe un document Dirigeant → les deux slugs dirigeant (1j + 2j)", () => {
    const c = classifyEntry(
      "Dirigeant/Documents_DOCX/04_Guide_Coach_Deroule_AFEST.docx",
      "un_a_un",
    );
    expect(c).toMatchObject({
      slugs: ["dirigeant-vision-strategique", "dirigeant-vision-strategique-2j"],
      slot: "guide_coach",
      kind: "source",
      ext: "docx",
    });
  });

  it("classe un document Collaborateur → les deux slugs collaborateur (1j + 2j)", () => {
    const c = classifyEntry(
      "Collaborateur/Documents_DOCX/01_Cadrage_Convention_AFEST.docx",
      "un_a_un",
    );
    expect(c).toMatchObject({
      slugs: ["coaching-decouverte", "coaching-optimisation-2j"],
      slot: "cadrage_objectifs",
      kind: "source",
    });
  });

  it("résout les dossiers public → slugs", () => {
    expect(resolveSlugs("Dirigeant", "un_a_un")).toEqual([
      "dirigeant-vision-strategique",
      "dirigeant-vision-strategique-2j",
    ]);
    expect(resolveSlugs("Collaborateur", "un_a_un")).toEqual([
      "coaching-decouverte",
      "coaching-optimisation-2j",
    ]);
    expect(resolveSlugs("Formation_IA_Express", "formation")).toEqual(["ia-express"]);
    expect(resolveSlugs("Quoi", "audit")).toEqual([]);
  });

  it("mappe les 14 préfixes vers les slots un_a_un (sans diaporama, sans 00_Presentation)", () => {
    expect(UN_A_UN_FILE_TO_SLOT["01"]).toBe("cadrage_objectifs");
    expect(UN_A_UN_FILE_TO_SLOT["08"]).toBe("plan_optimisation");
    expect(UN_A_UN_FILE_TO_SLOT["14"]).toBe("satisfaction_1to1");
  });

  it("ignore les placeholders PDF en .html (Documents_PDF non-.pdf)", () => {
    expect(
      classifyEntry("Dirigeant/Documents_PDF/04_Guide_Coach_Deroule_AFEST.html", "un_a_un"),
    ).toBeNull();
  });

  it("ignore les dossiers annexes du kit (_apercu_html, _build…)", () => {
    expect(classifyEntry("Autre/Documents_DOCX/01_Cadrage.docx", "un_a_un")).toBeNull();
    // un dossier de FORMATION passé en un_a_un n'est pas mal classé
    expect(
      classifyEntry("Formation_IA_Express/Documents_DOCX/01_Livret.docx", "un_a_un"),
    ).toBeNull();
  });

  it("ne traite pas 00_Presentation en un_a_un (diaporama = formation seulement)", () => {
    expect(classifyEntry("Dirigeant/00_Presentation/Slides.pptx", "un_a_un")).toBeNull();
  });

  // Verrou de cohérence SSOT pour la famille 1-to-1.
  it("chaque slot importé existe dans le catalogue un_a_un (non généré)", () => {
    for (const slotKey of Object.values(UN_A_UN_FILE_TO_SLOT)) {
      const def = getSlot("un_a_un", slotKey);
      expect(def, `slot ${slotKey} absent du catalogue un_a_un`).toBeDefined();
      expect(def?.generatedOnly ?? false, `slot ${slotKey} est generatedOnly`).toBe(false);
    }
  });

  // Verrou anti-fantôme : un slug de destination erroné rangerait les documents
  // sur une prestation inexistante (invisible en console). On vérifie que CHAQUE
  // slug ciblé est une vraie intervention de la famille un_a_un.
  it("les slugs destinataires sont de vraies interventions de la famille un_a_un", () => {
    const slugs = Object.values(UN_A_UN_FOLDER_TO_SLUGS).flatMap((s) => [...s]);
    expect(slugs.length).toBe(4);
    for (const slug of slugs) {
      const intervention = getInterventionBySlug(slug);
      expect(intervention, `slug ${slug} introuvable au catalogue`).toBeDefined();
      expect(intervention?.famille, `slug ${slug} hors famille un_a_un`).toBe("un_a_un");
    }
  });

  // Couverture exhaustive : les 14 documents de CHAQUE public se classent vers le
  // bon slot et les deux prestations (1j + 2j) du public.
  it("les 14 préfixes d'un public se classent tous vers le bon slot + les 2 slugs", () => {
    const dirSlugs = [...UN_A_UN_FOLDER_TO_SLUGS["Dirigeant"]!];
    const colSlugs = [...UN_A_UN_FOLDER_TO_SLUGS["Collaborateur"]!];
    expect(Object.keys(UN_A_UN_FILE_TO_SLOT).length).toBe(14);
    for (const [prefix, slot] of Object.entries(UN_A_UN_FILE_TO_SLOT)) {
      const dir = classifyEntry(`Dirigeant/Documents_DOCX/${prefix}_X.docx`, "un_a_un");
      expect(dir, `Dirigeant ${prefix} non classé`).not.toBeNull();
      expect(dir?.slot, `Dirigeant ${prefix} mauvais slot`).toBe(slot);
      expect([...(dir?.slugs ?? [])]).toEqual(dirSlugs);
      const col = classifyEntry(`Collaborateur/Documents_DOCX/${prefix}_X.docx`, "un_a_un");
      expect(col?.slot, `Collaborateur ${prefix} mauvais slot`).toBe(slot);
      expect([...(col?.slugs ?? [])]).toEqual(colSlugs);
    }
  });
});
