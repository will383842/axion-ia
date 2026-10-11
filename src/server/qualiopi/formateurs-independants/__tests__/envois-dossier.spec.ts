// L6 — F8 et F12 : éteints, et jamais de lien révoqué sans e-mail qui parte.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: vi.fn(),
  textes: vi.fn(),
  transaction: vi.fn(),
  envoyer: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: (...a: unknown[]) => h.settings(...a) },
    $transaction: (...a: unknown[]) => h.transaction(...a),
  },
}));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  texteValide: (...a: unknown[]) => h.textes(...a),
}));

import {
  MOTIFS_COMPLEMENT,
  demanderComplement,
  estMotifComplement,
  renvoyerLienDossier,
} from "../envois-dossier";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const PAR = "0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a4c";
const p = { trainerId: ID, parId: PAR, maintenant: new Date("2026-10-11T10:00:00Z") };

function interrupteur(allume: boolean | undefined) {
  h.settings.mockResolvedValue(
    allume === undefined ? [] : [{ key: "formateurs.dossier_en_ligne", value: { actif: allume } }],
  );
}

beforeEach(() => vi.clearAllMocks());

describe("e-mails du dossier (L6)", () => {
  it("interrupteur absent : rien n'est écrit, rien ne part", async () => {
    interrupteur(undefined);
    h.textes.mockResolvedValue(true);
    expect(await renvoyerLienDossier(p)).toEqual({ ok: false, raison: "eteint" });
    expect(await demanderComplement({ ...p, motif: "rib" })).toEqual({
      ok: false,
      raison: "eteint",
    });
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("texte non validé : les liens envoyés ne sont PAS révoqués", async () => {
    interrupteur(true);
    h.textes.mockResolvedValue(false);
    expect(await renvoyerLienDossier(p)).toEqual({ ok: false, raison: "texte-non-valide" });
    expect(await demanderComplement({ ...p, motif: "rib" })).toEqual({
      ok: false,
      raison: "texte-non-valide",
    });
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("F12 : le motif vient d'une liste fermée", () => {
    expect(estMotifComplement("rib")).toBe(true);
    expect(estMotifComplement("<script>")).toBe(false);
    expect(estMotifComplement("toString")).toBe(false);
    const INTERDITS = /\b(poste|entretien|salaire|rémunération|vous devez|obligatoire)\b/i;
    expect(Object.values(MOTIFS_COMPLEMENT).filter((t) => INTERDITS.test(t))).toEqual([]);
  });
});
