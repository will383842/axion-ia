/** Chantier QNC, L03 — le rattachement session → projet est du même client, et ne se réécrit pas. */
import { describe, expect, it } from "vitest";

import { rattacherSessionAuProjet } from "../rattachement";

const S = "22222222-2222-4222-8222-222222222222";
const P = "66666666-6666-4666-8666-666666666666";
const ADMIN = "44444444-4444-4444-8444-444444444444";

function db(o: {
  interrupteur?: string;
  session?: Record<string, unknown>;
  projet?: Record<string, unknown> | null;
}) {
  const ecrit: unknown[] = [];
  const session = { id: S, clientId: "c1", projetId: null, estTestInterne: false, ...o.session };
  return {
    ecrit,
    d: {
      setting: {
        findUnique: async () =>
          o.interrupteur === undefined ? null : { value: { etat: o.interrupteur } },
      },
      trainingSession: {
        findUnique: async () => session,
        updateMany: async ({ data }: { data: unknown }) => {
          ecrit.push(data);
          return { count: session.projetId === null ? 1 : 0 };
        },
      },
      projet: {
        findUnique: async () =>
          o.projet === undefined ? { clientId: "c1", fusionneDansId: null } : o.projet,
      },
      activityLog: { create: async ({ data }: { data: unknown }) => void ecrit.push(data) },
    } as never,
  };
}

describe("rattacherSessionAuProjet", () => {
  it("éteint : rien", async () => {
    const x = db({ interrupteur: "eteint" });
    expect(
      (await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN })).ok,
    ).toBe(false);
    expect(x.ecrit).toHaveLength(0);
  });
  it("rattache un projet du même client et journalise", async () => {
    const x = db({ interrupteur: "actif" });
    const r = await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN });
    expect(r).toEqual({ ok: true, dejaRattachee: false });
    expect(x.ecrit).toHaveLength(2);
  });
  it("refuse le projet d'un AUTRE client", async () => {
    const x = db({ interrupteur: "actif", projet: { clientId: "autre", fusionneDansId: null } });
    expect(
      (await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN })).ok,
    ).toBe(false);
    expect(x.ecrit).toHaveLength(0);
  });
  it("refuse un projet fusionné", async () => {
    const x = db({ interrupteur: "actif", projet: { clientId: "c1", fusionneDansId: "z" } });
    expect(
      (await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN })).ok,
    ).toBe(false);
  });
  it("ne réécrit pas un lien posé", async () => {
    const x = db({ interrupteur: "actif", session: { projetId: "autre-projet" } });
    const r = await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN });
    expect(r.ok).toBe(false);
    expect(x.ecrit).toHaveLength(0);
  });
  it("même projet : idempotent, rien d'écrit", async () => {
    const x = db({ interrupteur: "actif", session: { projetId: P } });
    expect(
      await rattacherSessionAuProjet(x.d, { sessionId: S, projetId: P, auteurId: ADMIN }),
    ).toEqual({ ok: true, dejaRattachee: true });
    expect(x.ecrit).toHaveLength(0);
  });
});
