/**
 * Canal d'émission d'un devis : e-mail, main propre ou inconnu (lot I1).
 */
import { describe, expect, it, vi } from "vitest";
import {
  ACTION_REMIS_MAIN_PROPRE,
  deduireCanalEmission,
  devisRemisEnMainPropre,
  lireCanalEmission,
} from "./canal-emission";

const ID = "11111111-1111-4111-8111-111111111111";
const DOC = "22222222-2222-4222-8222-222222222222";

function fausseBase(opts: { actions?: string[]; jetons?: number } = {}) {
  const trace = vi.fn(async (args: { where: { action: string } }) =>
    (opts.actions ?? []).includes(args.where.action) ? { id: "t1" } : null,
  );
  const jeton = vi.fn(async () => ((opts.jetons ?? 0) > 0 ? { id: "j1" } : null));
  return {
    db: { activityLog: { findFirst: trace }, documentSignatureToken: { findFirst: jeton } },
    trace,
    jeton,
  };
}

describe("deduireCanalEmission", () => {
  it("trace seule → main_propre", () => {
    expect(deduireCanalEmission({ traceMainPropre: true, jetonClientEmis: false })).toBe(
      "main_propre",
    );
  });
  it("trace + jeton → main_propre (la trace prime)", () => {
    expect(deduireCanalEmission({ traceMainPropre: true, jetonClientEmis: true })).toBe(
      "main_propre",
    );
  });
  it("jeton seul → email", () => {
    expect(deduireCanalEmission({ traceMainPropre: false, jetonClientEmis: true })).toBe("email");
  });
  it("rien → inconnu", () => {
    expect(deduireCanalEmission({ traceMainPropre: false, jetonClientEmis: false })).toBe(
      "inconnu",
    );
  });
});

describe("lireCanalEmission", () => {
  it("brouillon → null, aucune requête", async () => {
    const f = fausseBase();
    expect(
      await lireCanalEmission(f.db, { id: ID, statut: "brouillon", documentGenereId: null }),
    ).toBeNull();
    expect(f.trace).not.toHaveBeenCalled();
    expect(f.jeton).not.toHaveBeenCalled();
  });

  it("le where de la trace est exact ; un journal « _refuse » ne compte pas", async () => {
    const f = fausseBase({ actions: [ACTION_REMIS_MAIN_PROPRE + "_refuse"] });
    const r = await lireCanalEmission(f.db, { id: ID, statut: "envoye", documentGenereId: null });
    expect(f.trace).toHaveBeenCalledWith({
      where: { action: "qualiopi.devis.remis_main_propre", targetType: "Devis", targetId: ID },
      select: { id: true },
    });
    expect(r).toBe("inconnu");
  });

  it("documentGenereId null → aucune requête sur les jetons ; avec trace → main_propre", async () => {
    const f = fausseBase({ actions: [ACTION_REMIS_MAIN_PROPRE] });
    const r = await lireCanalEmission(f.db, { id: ID, statut: "envoye", documentGenereId: null });
    expect(f.jeton).not.toHaveBeenCalled();
    expect(r).toBe("main_propre");
  });

  it("le where du jeton est exact ; un jeton (même révoqué) suffit pour email", async () => {
    const f = fausseBase({ jetons: 1 });
    const r = await lireCanalEmission(f.db, { id: ID, statut: "envoye", documentGenereId: DOC });
    expect(f.jeton).toHaveBeenCalledWith({
      where: { documentGenereId: DOC, partie: "client" },
      select: { id: true },
    });
    expect(r).toBe("email");
  });
});

describe("devisRemisEnMainPropre", () => {
  it("vrai avec trace, faux sans", async () => {
    expect(
      await devisRemisEnMainPropre(fausseBase({ actions: [ACTION_REMIS_MAIN_PROPRE] }).db, ID),
    ).toBe(true);
    expect(await devisRemisEnMainPropre(fausseBase().db, ID)).toBe(false);
  });
});
