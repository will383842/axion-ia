// @vitest-environment node
/**
 * Complément de relecture : (3) journaux du serveur sans adresse pour un envoi retenu d'une
 * personne écartée, (4) masquage de l'adresse dans les alertes par le geste humain,
 * (UUID) la cible des alertes est un UUID dérivé de l'empreinte, jamais l'adresse.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const bd = vi.hoisted(() => ({
  alertes: [] as Array<{ id: string; message: string; titre: string }>,
  creees: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findMany: async ({ where }: { where: { message: { contains: string } } }) =>
        bd.alertes.filter((a) =>
          a.message.toLowerCase().includes(where.message.contains.toLowerCase()),
        ),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { message: string; titre: string };
      }) => {
        Object.assign(
          bd.alertes.find((a) => a.id === where.id)!,
          data,
        );
        return { id: where.id };
      },
    },
  },
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: async (a: Record<string, unknown>) => {
    bd.creees.push(a);
    return null;
  },
}));

import { masquerAdresseDansAlertes } from "@/lib/rgpd-erase";
import { signalerRetenue } from "@/server/email/suppression";
import { cibleIdAlerteDepuisEmpreinte } from "@/server/rgpd/constantes";

const ADRESSE = "stagiaire@exemple.test";

beforeEach(() => {
  bd.alertes.length = 0;
  bd.creees.length = 0;
});

describe("cibleIdAlerteDepuisEmpreinte", () => {
  it("rend un UUID déterministe, sans rien en clair", () => {
    const h = "a".repeat(64);
    const u = cibleIdAlerteDepuisEmpreinte(h);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(cibleIdAlerteDepuisEmpreinte(h)).toBe(u);
  });
});

describe("envoi retenu pour une personne écartée", () => {
  it("aucune adresse en clair dans les journaux du serveur ni dans la cible de l'alerte", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await signalerRetenue(ADRESSE, "qualiopi-convocation", {
      retenu: true,
      motif: "ecarte_effacement",
      depuis: new Date("2026-11-11T10:00:00Z"),
    });
    expect(JSON.stringify(err.mock.calls)).not.toContain(ADRESSE);
    expect(bd.creees).toHaveLength(1);
    expect(bd.creees[0]!["cibleId"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(bd.creees[0]!["cibleId"]).not.toContain("@");
    expect(bd.creees[0]!["niveau"]).toBe("info");
    err.mockRestore();
  });
});

describe("masquerAdresseDansAlertes (geste humain, mise à jour sans suppression)", () => {
  it("masque l'adresse dans le message et le titre, laisse les autres alertes", async () => {
    bd.alertes.push(
      { id: "1", titre: "Demande", message: `Adresse : ${ADRESSE.toUpperCase()}. À traiter.` },
      { id: "2", titre: "Autre", message: "Adresse : autre@exemple.test." },
    );
    const r = await masquerAdresseDansAlertes(ADRESSE);
    expect(r.alertesMasquees).toBe(1);
    expect(bd.alertes).toHaveLength(2);
    expect(bd.alertes[0]!.message).toBe("Adresse : [adresse masquée]. À traiter.");
    expect(bd.alertes[1]!.message).toContain("autre@exemple.test");
  });

  it("adresse vide : rien", async () => {
    expect((await masquerAdresseDansAlertes("  ")).alertesMasquees).toBe(0);
  });
});
