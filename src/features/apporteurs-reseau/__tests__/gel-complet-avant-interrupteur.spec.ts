// Lot 7 : l'interrupteur ne peut s'allumer que si le gel est COMPLET. Garde statique des quatre chemins.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("le gel est complet", () => {
  it("marquerVerse refuse sous gel, avant toute lecture de commission", () => {
    const s = lire("src/features/apporteurs-reseau/facturation.ts");
    expect(s).toContain("demandesQuiGelent");
    expect(s.indexOf("MESSAGE_GEL")).toBeLessThan(s.indexOf("sansPiece"));
  });

  it("« Ouvrir le RIB à virer » refuse sous gel et est journalisé en exigeant la trace", () => {
    const s = lire("src/features/apporteurs-reseau/rib-a-virer.ts");
    expect(s).toContain("demandesQuiGelent");
    expect(s).toContain("exiger: true");
    expect(s).toContain('peutEngager(e.acteur.role, "facturer")');
  });

  it("la console des commissions grise la ligne gelée et n'offre ni RIB ni « Virement fait »", () => {
    const s = lire("src/app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/page.tsx");
    expect(s).toContain("enrichirVirements");
    expect(s).toContain("peutPayer && !gel");
  });

  it("la vue commune porte le gel des lignes apporteur", () => {
    const s = lire("src/server/paiements-sortants/virements.ts");
    expect(s).toContain("enrichirVirements");
  });
});
