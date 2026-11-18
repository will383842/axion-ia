// @vitest-environment node
import { describe, expect, it } from "vitest";

import { TEXTES_PAGE_GUIDE } from "../textes";

describe("mention d'origine des demandes de guide", () => {
  it("le texte fourni est publié tel quel, hors de la ligne d'information", () => {
    expect(TEXTES_PAGE_GUIDE.origine).toBe(
      "Nous notons le mot, le réseau et la publication par lesquels vous nous avez contactés, pour savoir d'où viennent les demandes. Ces informations sont gardées aussi longtemps que votre fiche de contact. Vous pouvez vous y opposer à tout moment par le lien « stop » de nos messages.",
    );
    expect(TEXTES_PAGE_GUIDE.information.toLowerCase()).not.toContain("stop");
  });
});
