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
    expect(wf).toMatch(/\^SYNCHRO_CRM_V3\(_NEWSLETTER_OPTIN\|_ORIGINES_SUIVANTES\)\?\$/);
  });
  it("la documentation donne l'ordre d'allumage et le secret du lien", () => {
    const doc = lire("docs/guides-reseau-interrupteurs.md");
    expect(doc).toContain("SYNCHRO_CRM_V3_NEWSLETTER_OPTIN");
    expect(doc).toContain("Tout arrêter");
    expect(doc).toContain("GUIDES_RESEAU_LIEN_SECRET");
  });
});

describe("CONFIRMATIONS_PAGE_GUIDE_ENABLED est basculable (site, true|false) et documenté (fiche S4-c)", () => {
  const wf = lire(".github/workflows/coolify-drapeau.yml");
  const doc = lire("docs/guides-reseau-interrupteurs.md");
  it("liste fermée du workflow : la clé y est, une seule fois", () => {
    expect(wf.match(/- "CONFIRMATIONS_PAGE_GUIDE_ENABLED"/g)).toHaveLength(1);
  });
  it("cible « site » seulement", () => {
    expect(wf).toContain(
      '[ "$CLE" = "CONFIRMATIONS_PAGE_GUIDE_ENABLED" ] && [ "$CIBLE" != "site" ]',
    );
  });
  it("valeurs : true|false seulement (jamais « essai », jamais une valeur libre)", () => {
    expect(wf).not.toMatch(/\^\([^)]*CONFIRMATIONS_PAGE_GUIDE[^)]*essai/);
  });
  it("aucun secret dans le workflow : le drapeau n'est pas un secret et rien ne le laisse penser", () => {
    expect(wf).not.toMatch(/GUIDES_RESEAU_(HMAC|LIEN)_SECRET/);
  });
  it("la documentation ne dit plus « hors workflow » pour cette clé et donne la commande", () => {
    expect(doc).toContain("-f cle=CONFIRMATIONS_PAGE_GUIDE_ENABLED -f valeur=true -f cible=site");
    expect(doc).not.toMatch(/CONFIRMATIONS_PAGE_GUIDE_ENABLED`[^\n]*hors workflow/);
  });
});

describe("relecture PR 1958 — ordre d'allumage et texte sans case", () => {
  const doc = lire("docs/guides-reseau-interrupteurs.md");
  it("l'ordre d'allumage exige que le Studio accuse chaque merci avant CONFIRMATIONS_PAGE_GUIDE_ENABLED (jamais deux fois le même merci)", () => {
    const etape = doc.split("\n").find((l) => /^3\.\s+`CONFIRMATIONS_PAGE_GUIDE_ENABLED`/.test(l));
    expect(etape).toBeDefined();
    expect(etape).toMatch(/Studio/);
    expect(etape).toMatch(/envoye/);
    expect(etape).toMatch(/hors_fenetre/);
    expect(etape).toMatch(/echec/);
  });
  it("la documentation ne garde aucune marque de conflit", () => {
    expect(doc).not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m);
  });
  it("textes.ts n'affirme pas que le texte sans case est « validé par Williams » (non vérifiable)", () => {
    expect(lire("src/app/guide-reseau/textes.ts")).not.toMatch(/validé par Williams/);
  });
});
