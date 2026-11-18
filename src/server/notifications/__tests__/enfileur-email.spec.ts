/**
 * Le registre du chargeur d'`enqueueEmail` (`enfileur-email.ts`) : feuille sans import d'exécution,
 * état sur `globalThis`, première pose gagnante.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __reinitialiserPourTests,
  chargerEnfileurEmail,
  poserChargeurEnfileurEmail,
} from "../enfileur-email";

afterEach(() => __reinitialiserPourTests());

describe("enfileur-email", () => {
  it("sans pose : null", async () => {
    expect(await chargerEnfileurEmail()).toBeNull();
  });

  it("après la pose : l'enfileur du chargeur", async () => {
    const faux = vi.fn();
    poserChargeurEnfileurEmail(async () => faux as never);
    expect(await chargerEnfileurEmail()).toBe(faux);
  });

  it("la 2e pose n'écrase pas la 1re", async () => {
    const premier = vi.fn();
    const second = vi.fn();
    poserChargeurEnfileurEmail(async () => premier as never);
    poserChargeurEnfileurEmail(async () => second as never);
    expect(await chargerEnfileurEmail()).toBe(premier);
  });

  it("survit à vi.resetModules (état sur globalThis)", async () => {
    const faux = vi.fn();
    poserChargeurEnfileurEmail(async () => faux as never);
    vi.resetModules();
    const neuf = await import("../enfileur-email");
    expect(await neuf.chargerEnfileurEmail()).toBe(faux);
  });

  it("un chargeur qui lève fait lever le chargement (l'appelant l'attrape)", async () => {
    poserChargeurEnfileurEmail(async () => {
      throw new Error("boum");
    });
    await expect(chargerEnfileurEmail()).rejects.toThrow("boum");
  });
});
