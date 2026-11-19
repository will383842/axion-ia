/** Renvoyer invalide l'ancien lien dès le clic : la fiche le dit. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("avertissement du renvoi", () => {
  it("la fiche et le bouton signalent l'invalidation immédiate de l'ancien lien", () => {
    const boutons = readFileSync(
      join(process.cwd(), "src/components/admin/qualiopi/DevisLifecycleButtons.tsx"),
      "utf8",
    );
    expect(boutons).toContain("avertissement-renvoi-lien");
    expect(boutons).toContain("désactive dès maintenant l");
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("invalide l'ancien IMMÉDIATEMENT");
  });

  it("la fiche lit le choix du client du sceau (choixImprimable), jamais de devis.choixRetenu", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("<ChoixClientSigne");
    expect(page).toContain("choixImprimable(");
    expect(page).not.toContain("devis.choixRetenu");
  });
});
