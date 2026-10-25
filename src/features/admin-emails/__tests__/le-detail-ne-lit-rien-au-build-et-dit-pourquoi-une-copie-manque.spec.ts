// @vitest-environment node
/**
 * Lecture du détail d'un e-mail (2026-09-27).
 *
 *   · `stub.invalid` (build GitHub Actions) : AUCUN appel base — le Prisma
 *     doublé lève à la moindre lecture, donc un appel ferait rougir ;
 *   · un identifiant qui n'est pas un UUID ne part pas en base (la colonne est
 *     `@db.Uuid`, Prisma lèverait → 500 au lieu d'un 404) ;
 *   · sans copie, l'écran dit POURQUOI — jamais un vide.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ lectures: 0 }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        d.lectures += 1;
        throw new Error("lecture base interdite dans ce test");
      },
    },
  ),
}));

import { chargerDetailEmail, datePremiereCopie, raisonSansCopie } from "../detail";

beforeEach(() => {
  d.lectures = 0;
  delete process.env["DATABASE_URL"];
});

describe("stub.invalid — aucun appel base au build", () => {
  it("chargerDetailEmail et datePremiereCopie rendent null sans toucher la base", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await expect(chargerDetailEmail("3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b")).resolves.toBeNull();
    await expect(datePremiereCopie()).resolves.toBeNull();
    expect(d.lectures).toBe(0);
  });

  it("témoin : hors stub, la lecture a bien lieu (et lève ici)", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/axion";
    await expect(chargerDetailEmail("3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b")).rejects.toThrow();
    expect(d.lectures).toBeGreaterThan(0);
  });
});

describe("identifiant invalide", () => {
  it("pas un UUID : null, sans requête", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/axion";
    await expect(chargerDetailEmail("../../etc/passwd")).resolves.toBeNull();
    expect(d.lectures).toBe(0);
  });
});

describe("pourquoi une copie manque", () => {
  const MAINTENANT = new Date("2026-10-15T12:00:00Z");
  const PREMIERE = new Date("2026-09-28T07:00:00Z");

  it("pas parti : échec, annulé, en file", () => {
    expect(
      raisonSansCopie(
        { status: "failed", sentAt: null, createdAt: MAINTENANT },
        PREMIERE,
        MAINTENANT,
      ).kind,
    ).toBe("pas-parti");
    expect(
      raisonSansCopie(
        { status: "cancelled", sentAt: null, createdAt: MAINTENANT },
        PREMIERE,
        MAINTENANT,
      ).phrase,
    ).toMatch(/annulé/);
    expect(
      raisonSansCopie(
        { status: "pending", sentAt: null, createdAt: MAINTENANT },
        PREMIERE,
        MAINTENANT,
      ).phrase,
    ).toMatch(/en file/);
  });

  it("envoi antérieur à la première copie : la date est dite (JJ/MM/AAAA)", () => {
    const r = raisonSansCopie(
      {
        status: "sent",
        sentAt: new Date("2026-09-27T17:40:00Z"),
        createdAt: new Date("2026-09-27T17:40:00Z"),
      },
      PREMIERE,
      MAINTENANT,
    );
    expect(r.kind).toBe("anterieure");
    expect(r.phrase).toBe("Copie non conservée (envoi antérieur au 28/09/2026).");
  });

  it("aucune copie encore en base : la phrase ne ment pas sur une date", () => {
    const r = raisonSansCopie(
      { status: "sent", sentAt: MAINTENANT, createdAt: MAINTENANT },
      null,
      MAINTENANT,
    );
    expect(r.phrase).toBe("Copie non conservée (envoi antérieur à la conservation des copies).");
  });

  it("plus de 12 mois : purgée", () => {
    const vieux = new Date("2025-09-01T00:00:00Z");
    expect(
      raisonSansCopie({ status: "sent", sentAt: vieux, createdAt: vieux }, PREMIERE, MAINTENANT)
        .kind,
    ).toBe("purgee");
  });

  it("parti APRÈS la mise en service, sans copie : l'enregistrement a échoué — c'est dit", () => {
    const r = raisonSansCopie(
      {
        status: "sent",
        sentAt: new Date("2026-10-01T09:00:00Z"),
        createdAt: new Date("2026-10-01T09:00:00Z"),
      },
      PREMIERE,
      MAINTENANT,
    );
    expect(r.kind).toBe("manquante");
  });
});

describe("un e-mail rattaché à une fiche client est gardé 5 ans", () => {
  const il_y_a_2_ans = new Date("2024-10-20T10:00:00Z");
  const ligne = { status: "sent" as const, sentAt: il_y_a_2_ans, createdAt: il_y_a_2_ans };
  const MAINT = new Date("2026-10-25T10:00:00Z");

  it("sans fiche : plus de 12 mois = copie purgée (12 mois dits)", () => {
    const r = raisonSansCopie(ligne, new Date("2020-01-01T00:00:00Z"), MAINT, false);
    expect(r.kind).toBe("purgee");
    expect(r.phrase).toContain("12 mois");
  });

  it("avec fiche : 2 ans n'est pas une purge, et la durée dite est 5 ans", () => {
    const r = raisonSansCopie(ligne, new Date("2020-01-01T00:00:00Z"), MAINT, true);
    expect(r.kind).toBe("manquante");
    const vieux = new Date("2020-01-01T00:00:00Z");
    const p = raisonSansCopie(
      { status: "sent", sentAt: vieux, createdAt: vieux },
      null,
      MAINT,
      true,
    );
    expect(p.kind).toBe("purgee");
    expect(p.phrase).toContain("5 ans");
  });
});
