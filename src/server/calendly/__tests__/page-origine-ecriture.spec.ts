// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { enregistrerPageOrigine } from "../page-origine-ecriture";

const ON = { CONTENT_CHAINE_SUIVI: "true" };
const fauxPrisma = () => ({ contenuRendezVousOrigine: { upsert: vi.fn().mockResolvedValue({}) } });

describe("enregistrerPageOrigine", () => {
  it("éteint : rien n'est écrit", async () => {
    const p = fauxPrisma();
    expect(
      await enregistrerPageOrigine({ eventUri: "u", po: "/fr/blog/a", choix: "diagnostic" }, p, {}),
    ).toBe("eteint");
    expect(p.contenuRendezVousOrigine.upsert).not.toHaveBeenCalled();
  });
  it("allumé : écrit une fois, sans écraser (update vide)", async () => {
    const p = fauxPrisma();
    expect(
      await enregistrerPageOrigine({ eventUri: "u", po: "/fr/blog/a", choix: "diagnostic" }, p, ON),
    ).toBe("enregistree");
    expect(p.contenuRendezVousOrigine.upsert).toHaveBeenCalledWith({
      where: { eventUri: "u" },
      create: { eventUri: "u", pageOrigine: "/fr/blog/a", choix: "diagnostic" },
      update: {},
    });
  });
  it("sans origine valide : rien", async () => {
    const p = fauxPrisma();
    expect(
      await enregistrerPageOrigine({ eventUri: "u", po: "/fr/appel", choix: null }, p, ON),
    ).toBe("sans_origine");
    expect(p.contenuRendezVousOrigine.upsert).not.toHaveBeenCalled();
  });
  it("une panne de base ne fait jamais échouer la réservation", async () => {
    const p = {
      contenuRendezVousOrigine: { upsert: vi.fn().mockRejectedValue(new Error("P2021")) },
    };
    expect(
      await enregistrerPageOrigine({ eventUri: "u", po: "/fr/blog/a", choix: null }, p, ON),
    ).toBe("echec");
  });
});
