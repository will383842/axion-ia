// @vitest-environment node
/**
 * Garde structurelle du lot 3 : l'aperçu et l'envoi (et le renvoi) lisent les MÊMES
 * données, aucun point d'envoi n'a été ajouté, et rien de ce qui part au client ne
 * contient « token » / « jeton ».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), "utf8");
const SANS_COMMENTAIRES = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("lot 3 — une seule source de données", () => {
  const route = SANS_COMMENTAIRES(lire("src/app/api/qualiopi/devis/[id]/apercu/route.ts"));
  const envoi = SANS_COMMENTAIRES(lire("src/server/actions/qualiopi/devis.ts"));
  const renvoi = SANS_COMMENTAIRES(lire("src/server/actions/qualiopi/facturation-emails.ts"));

  it("l'aperçu et l'envoi construisent le PDF par donneesPdfDevis + lireContextePdfDevis", () => {
    for (const src of [route, envoi]) {
      expect(src).toContain("donneesPdfDevis(");
      expect(src).toContain("lireContextePdfDevis()");
    }
    // ni l'un ni l'autre ne fabrique un DevisData à la main
    expect(route).not.toMatch(/regimeTva\s*:/);
  });

  it("l'envoi et le renvoi construisent l'e-mail par payloadDevisEnvoi (même contenu)", () => {
    expect(envoi).toContain("payloadDevisEnvoi(");
    expect(renvoi).toContain("payloadDevisEnvoi(");
  });

  it("aucun point d'envoi nouveau : un seul enqueueEmail devis-envoi par action", () => {
    expect(envoi.match(/"devis-envoi"/g)?.length).toBe(1);
    expect(renvoi.match(/"devis-envoi"/g)?.length).toBe(1);
  });

  it("l'interrupteur est lu par le contexte du PDF (inerte s'il est éteint)", () => {
    const ctx = lire("src/server/qualiopi/documents/donnees-pdf-devis.ts");
    expect(ctx).toContain("formulesActives: await formulesActives()");
  });
});

describe("lot 3 — l'aperçu lit l'offre", () => {
  it("🔑 SELECT_DEVIS_POUR_PDF contient offre: true (sinon aperçu vide à 0,00 €)", () => {
    const src = SANS_COMMENTAIRES(lire("src/server/qualiopi/documents/donnees-pdf-devis.ts"));
    const bloc = /SELECT_DEVIS_POUR_PDF\s*=\s*\{([\s\S]*?)\}\s*as const/.exec(src)?.[1] ?? "";
    expect(bloc).toMatch(/\boffre:\s*true\b/);
  });
});

describe("lot 3 — vocabulaire client", () => {
  it("🔑 ni « token » ni « jeton » dans les textes écrits pour le client (vue, e-mail, gabarit)", () => {
    for (const f of [
      "src/server/qualiopi/devis/vue-formules.ts",
      "src/server/qualiopi/devis/email-devis-envoi.ts",
    ]) {
      expect(SANS_COMMENTAIRES(lire(f)), f).not.toMatch(/token|jeton/i);
    }
    // Le gabarit importe des « brand-tokens » (jetons de design, jamais imprimés) : son
    // rendu est contrôlé par devis-formules-pdf.spec.tsx, sur le TEXTE réellement produit.
    const email = SANS_COMMENTAIRES(lire("src/lib/email/templates/devis-envoi.tsx"));
    expect(email).not.toMatch(/token|jeton/i);
  });
});
