// @vitest-environment node
// Lot S2 — l'interrupteur de la page est dans la liste FERMÉE du workflow de bascule (cible site,
// true|false) et dans la documentation, avec le secret du lien.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string): string => readFileSync(join(process.cwd(), p), "utf8");

describe("PAGE_GUIDE_RESEAU_ENABLED est documenté et basculable", () => {
  const wf = lire(".github/workflows/coolify-drapeau.yml");
  it("liste fermée du workflow : la clé y est, cible « site » seulement", () => {
    expect(wf).toContain('- "PAGE_GUIDE_RESEAU_ENABLED"');
    expect(wf).toMatch(/\^\(GUIDES\|OPPOSITIONS\|PAGE_GUIDE\)_RESEAU_ENABLED\$/);
  });
  it("valeurs : true|false seulement (pas dans les clés à « essai »)", () => {
    expect(wf).not.toMatch(/\^\([^)]*PAGE_GUIDE_RESEAU[^)]*essai/);
  });
  it("la documentation décrit l'interrupteur, son défaut éteint et le secret du lien", () => {
    const doc = lire("docs/guides-reseau-interrupteurs.md");
    expect(doc).toContain("PAGE_GUIDE_RESEAU_ENABLED");
    expect(doc).toContain("GUIDES_RESEAU_LIEN_SECRET");
    expect(doc).toMatch(/Éteinte par défaut/);
  });
});

describe("SYNCHRO_CRM_V3 et _NEWSLETTER_OPTIN sont basculables (les-deux) et documentés", () => {
  const wf = lire(".github/workflows/coolify-drapeau.yml");
  it("liste fermée du workflow, cible « les-deux » imposée", () => {
    expect(wf).toContain('- "SYNCHRO_CRM_V3"');
    expect(wf).toContain('- "SYNCHRO_CRM_V3_NEWSLETTER_OPTIN"');
    expect(wf).toMatch(/\^SYNCHRO_CRM_V3\(_NEWSLETTER_OPTIN\)\?\$/);
  });
  it("la documentation donne l'ordre d'allumage et le secret du lien", () => {
    const doc = lire("docs/guides-reseau-interrupteurs.md");
    expect(doc).toContain("SYNCHRO_CRM_V3_NEWSLETTER_OPTIN");
    expect(doc).toContain("Tout arrêter");
    expect(doc).toContain("GUIDES_RESEAU_LIEN_SECRET");
  });
});
