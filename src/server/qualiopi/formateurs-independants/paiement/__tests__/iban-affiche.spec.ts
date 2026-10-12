// @vitest-environment node

/** Lot D (M6) — l'IBAN AFFICHÉ à l'opérateur : 4 derniers caractères et empreinte, jamais plus. */

import { beforeEach, describe, expect, it, vi } from "vitest";

const decryptPii = vi.fn();
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (...a: unknown[]) => decryptPii(...a) }));

import { ibanAffichePourVirement } from "../virement-mission-base";

const T = "22222222-2222-4222-8222-222222222222";
const E = "c".repeat(64);
const db = { trainer: { findUnique: vi.fn() } };

beforeEach(() => {
  vi.clearAllMocks();
  db.trainer.findUnique.mockResolvedValue({ iban: "enc:v2:xxx", ibanEmpreinte: E });
  decryptPii.mockReturnValue("FR76 3000 6000 0112 3456 7890 189");
});

describe("ibanAffichePourVirement", () => {
  it("rend la fin et l'empreinte lue en base, déchiffre avec l'AAD du formateur", async () => {
    expect(await ibanAffichePourVirement(db, T)).toEqual({ fin4: "0189", empreinte: E });
    expect(decryptPii).toHaveBeenCalledWith("enc:v2:xxx", {
      aad: `trainer:${T}:iban`,
      cleExigee: true,
    });
  });

  it("aucun IBAN, aucune empreinte, ou déchiffrement impossible : null", async () => {
    db.trainer.findUnique.mockResolvedValueOnce({ iban: null, ibanEmpreinte: null });
    expect(await ibanAffichePourVirement(db, T)).toBeNull();
    decryptPii.mockImplementationOnce(() => {
      throw new Error("clé");
    });
    expect(await ibanAffichePourVirement(db, T)).toBeNull();
  });
});
