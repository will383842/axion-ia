import { describe, it, expect } from "vitest";
import {
  classifyEntry,
  resolveSlug,
  slugifyFolder,
  buildKitR2Key,
  FILE_TO_SLOT,
} from "./kit-mapping";

describe("kit-mapping", () => {
  it("classe un livret PDF → slug + slot + pdf", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_PDF/01_Livret_Apprenant.pdf");
    expect(c).toMatchObject({
      slug: "ia-express",
      slot: "livret_apprenant",
      kind: "pdf",
      ext: "pdf",
    });
  });

  it("classe un livret DOCX → source", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_DOCX/01_Livret_Apprenant.docx");
    expect(c).toMatchObject({ slot: "livret_apprenant", kind: "source", ext: "docx" });
  });

  it("le programme est en visibilité commerciale, le reste formateur", () => {
    expect(FILE_TO_SLOT["06"]!.visibilite).toBe("commercial");
    expect(FILE_TO_SLOT["01"]!.visibilite).toBe("formateur");
    expect(FILE_TO_SLOT["04"]!.visibilite).toBe("formateur");
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

  it("ignore les chemins non pertinents", () => {
    expect(classifyEntry("Formation_IA_Express/README.txt")).toBeNull();
    expect(classifyEntry("Formation_IA_Express/Documents_PDF/06_Programme.txt")).toBeNull();
  });
});
