/**
 * Lot D (M11) — « Écrire l'indemnité d'annulation » : un geste d'administrateur.
 * Interrupteur `missions_console` coupé : refus. Confirmation exigée. L'instant
 * saisi est une heure de PARIS, jamais dans le futur. Journal sur l'UUID de la mission.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const allume = vi.fn();
const ecrire = vi.fn();
const log = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => log(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: (...a: unknown[]) => allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-base", () => ({
  ecrireIndemniteDecidee: (...a: unknown[]) => ecrire(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { ecrireIndemniteAnnulationFormAction } from "./indemnite-annulation";

const M = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RETOUR = "/fr/adm/qualiopi/formateurs/missions";

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
async function url(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return decodeURIComponent(String(redirect.mock.calls.at(-1)![0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  allume.mockResolvedValue(true);
  ecrire.mockResolvedValue({ issue: "ecrite", montantHtCents: 45_000, totalTtcCents: 54_000 });
});

const ok = {
  retour: RETOUR,
  missionId: M,
  annuleeA: "2026-10-10T09:00",
  parAxion: "oui",
  confirmer: "oui",
};

describe("ecrireIndemniteAnnulationFormAction", () => {
  it("écrit, avec l'instant saisi lu à Paris, et journalise sur la mission", async () => {
    const u = await url(ecrireIndemniteAnnulationFormAction(fd(ok)));
    expect(ecrire).toHaveBeenCalledWith({
      missionId: M,
      // Heure d'été : 09 h 00 à Paris = 07 h 00 UTC.
      annuleeA: new Date("2026-10-10T07:00:00Z"),
      parAxion: true,
    });
    expect(log.mock.calls[0]![0]).toMatchObject({
      targetType: "MissionFormateur",
      targetId: M,
      changes: { issue: "ecrite", montantHtCents: 45_000, parAxion: true },
    });
    expect(u).toMatch(/^\/fr\/adm\/qualiopi\/formateurs\/missions\?ok=.*450,00/);
  });

  it("sans confirmation, interrupteur coupé, date future ou mission forgée : rien n'est écrit", async () => {
    await url(ecrireIndemniteAnnulationFormAction(fd({ ...ok, confirmer: "" })));
    await url(ecrireIndemniteAnnulationFormAction(fd({ ...ok, annuleeA: "2999-01-01T09:00" })));
    await url(ecrireIndemniteAnnulationFormAction(fd({ ...ok, missionId: "x" })));
    allume.mockResolvedValue(false);
    await url(ecrireIndemniteAnnulationFormAction(fd(ok)));
    expect(ecrire).not.toHaveBeenCalled();
  });

  it("case « par Axion » décochée : transmis tel quel (rien ne sera dû)", async () => {
    ecrire.mockResolvedValue({ issue: "non_due" });
    const u = await url(ecrireIndemniteAnnulationFormAction(fd({ ...ok, parAxion: "" })));
    expect(ecrire.mock.calls[0]![0].parAxion).toBe(false);
    expect(u).toMatch(/erreur=/);
  });

  it("retour forgé : on revient à la racine, jamais ailleurs", async () => {
    const u = await url(ecrireIndemniteAnnulationFormAction(fd({ ...ok, retour: "//evil.tld" })));
    expect(u.startsWith("/?")).toBe(true);
  });
});
