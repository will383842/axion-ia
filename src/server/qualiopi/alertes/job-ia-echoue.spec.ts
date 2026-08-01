/**
 * Tests — job-ia-echoue.ts (audit UX console du 2026-08-01).
 *
 * Défaut P0 corrigé : l'alerte « job IA en échec » remontait sur
 * /qualiopi/a-traiter (première page de la console) avec un titre technique
 * (« dead letter queue »), l'UUID brut de la formation, et `err.message`
 * (trace JS/BullMQ) interpolés dans le champ affiché à l'écran.
 *
 * Ces tests couvrent les deux fonctions qui portent la garantie :
 *   - `construireAlerteJobIaEchoue` ne reçoit jamais `err` → ne peut PAS fuiter
 *     `err.message`, structurellement.
 *   - `resoudreNomFormationPourAlerte` résout un nom lisible et retombe sur un
 *     libellé générique (jamais l'UUID) si la formation est introuvable ou si
 *     la lecture échoue.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: mockFindUnique },
  },
}));

import { construireAlerteJobIaEchoue, resoudreNomFormationPourAlerte } from "./job-ia-echoue";

describe("construireAlerteJobIaEchoue", () => {
  it("ne référence jamais le jargon technique « dead letter queue »", () => {
    const { titre, message } = construireAlerteJobIaEchoue("« Négociation commerciale »", 3);
    expect(titre).not.toMatch(/dead letter/i);
    expect(message).not.toMatch(/dead letter/i);
  });

  it("produit un titre métier et un message actionnable, nom de formation inclus", () => {
    const { titre, message } = construireAlerteJobIaEchoue("« Négociation commerciale »", 3);
    expect(titre).toBe("Génération IA d'une formation en échec");
    expect(message).toContain("« Négociation commerciale »");
    expect(message).toContain("3 tentative(s)");
    expect(message).toContain("contactez le support");
  });

  it("ne peut structurellement pas contenir une trace d'erreur JS/BullMQ (err absent de la signature)", () => {
    // La fonction ne prend pas `err` en paramètre : quel que soit son contenu
    // réel (stack Node, message BullMQ...), il n'existe aucun chemin pour
    // qu'il atteigne le message affiché à l'écran.
    const { message } = construireAlerteJobIaEchoue("une formation", 5);
    expect(message).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/); // signature de stack trace Node
    expect(message).not.toContain("TypeError");
    expect(message).not.toContain("undefined is not");
  });
});

describe("resoudreNomFormationPourAlerte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("résout le titre réel de la formation, jamais son UUID", async () => {
    const uuid = "3f2a9c10-4b1e-4c8a-9d2e-1a2b3c4d5e6f";
    mockFindUnique.mockResolvedValueOnce({ titre: "Négociation commerciale" });

    const nom = await resoudreNomFormationPourAlerte(uuid);

    expect(nom).toBe("« Négociation commerciale »");
    expect(nom).not.toContain(uuid);
  });

  it("retombe sur un libellé générique si la formation est introuvable (jamais l'UUID)", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    mockFindUnique.mockResolvedValueOnce(null);

    const nom = await resoudreNomFormationPourAlerte(uuid);

    expect(nom).toBe("une formation");
    expect(nom).not.toContain(uuid);
  });

  it("fail-soft : retombe sur un libellé générique si la lecture DB échoue", async () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    mockFindUnique.mockRejectedValueOnce(new Error("connection terminated unexpectedly"));

    const nom = await resoudreNomFormationPourAlerte(uuid);

    expect(nom).toBe("une formation");
    expect(nom).not.toContain(uuid);
    expect(nom).not.toContain("connection terminated");
  });
});
