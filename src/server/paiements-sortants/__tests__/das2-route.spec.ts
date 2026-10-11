// @vitest-environment node

/**
 * L12h — la route d'export DAS 2 commun : session, rôle, interrupteur.
 * Interrupteur absent : 404, l'export n'est même pas calculé.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  interrupteurAllume: vi.fn(),
  exportDas2Commune: vi.fn(),
  journaliser: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("@/server/paiements-sortants/das2", () => ({ exportDas2Commune: m.exportDas2Commune }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: m.interrupteurAllume,
}));

import { GET } from "../../../app/[locale]/(admin)/[adminPrefix]/paiements-sortants/das2/export/route";

const req = (q: string) =>
  new NextRequest(`https://axion-ia.com/fr/x/paiements-sortants/das2/export${q}`);

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  m.interrupteurAllume.mockResolvedValue(true);
  m.exportDas2Commune.mockResolvedValue("﻿entete\r\n");
});

describe("GET /paiements-sortants/das2/export", () => {
  it("interrupteur absent : 404, rien n'est calculé ni journalisé", async () => {
    m.interrupteurAllume.mockResolvedValue(false);
    const r = await GET(req("?annee=2027"));
    expect(r.status).toBe(404);
    expect(m.interrupteurAllume).toHaveBeenCalledWith("das2_commun");
    expect(m.exportDas2Commune).not.toHaveBeenCalled();
    expect(m.journaliser).not.toHaveBeenCalled();
  });

  it("sans session : 401 ; rôle de lecture ou d'édition : 403", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect((await GET(req("?annee=2027"))).status).toBe(401);
    for (const role of ["reader", "editor"]) {
      m.auth.mockResolvedValueOnce({ user: { id: "u1", role } });
      expect((await GET(req("?annee=2027"))).status).toBe(403);
    }
    expect(m.exportDas2Commune).not.toHaveBeenCalled();
  });

  it("année absente ou hors bornes : 400", async () => {
    expect((await GET(req(""))).status).toBe(400);
    expect((await GET(req("?annee=1999"))).status).toBe(400);
  });

  it("par défaut les seuls bénéficiaires à déclarer ; `tous=1` liste tout le monde ; journal sans cible", async () => {
    const r = await GET(req("?annee=2027"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="das2-2027.csv"');
    expect(m.exportDas2Commune).toHaveBeenLastCalledWith(2027, { seulementADeclarer: true });
    expect(m.journaliser.mock.calls[0]![1]).toMatchObject({
      action: "paiements_sortants.das2_exporte",
      targetId: null,
      session: { userId: "u1" },
    });
    await GET(req("?annee=2027&tous=1"));
    expect(m.exportDas2Commune).toHaveBeenLastCalledWith(2027, { seulementADeclarer: false });
  });
});
