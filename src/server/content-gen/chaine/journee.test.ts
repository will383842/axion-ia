import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  lancerJournee,
  lireReglageChaine,
  sujetsAutorises,
  type EtatJournee,
  type PortsJournee,
} from "./journee";
import type { Besoin, IssueContenu } from "./orchestrateur";

const etat = (o: Partial<EtatJournee> = {}): EtatJournee => ({
  reglage: { actif: true, sujetsParJour: 3 },
  lancesAujourdhui: 0,
  enAttenteRelecture: 0,
  budgetJourRestantUsd: 20,
  ...o,
});

describe("réglage console", () => {
  it("éteint par défaut, et pour toute valeur illisible", () => {
    expect(lireReglageChaine(undefined).actif).toBe(false);
    expect(lireReglageChaine({}).actif).toBe(false);
    expect(lireReglageChaine("oui").actif).toBe(false);
    expect(lireReglageChaine({ actif: "true" }).actif).toBe(false);
    expect(lireReglageChaine({ actif: true, sujetsParJour: 50 }).actif).toBe(false);
    expect(lireReglageChaine({ actif: true, extra: 1 }).actif).toBe(false);
    expect(lireReglageChaine({ actif: true })).toEqual({ actif: true, sujetsParJour: 3 });
  });
});

describe("sujetsAutorises", () => {
  it("éteint : zéro", () =>
    expect(sujetsAutorises(etat({ reglage: { actif: false, sujetsParJour: 3 } }))).toBe(0));
  it("3 au plus par jour", () => {
    expect(sujetsAutorises(etat())).toBe(3);
    expect(sujetsAutorises(etat({ lancesAujourdhui: 2 }))).toBe(1);
    expect(sujetsAutorises(etat({ lancesAujourdhui: 3 }))).toBe(0);
  });
  it("file de relecture à 10 : arrêt ; à 9 : un seul", () => {
    expect(sujetsAutorises(etat({ enAttenteRelecture: 10 }))).toBe(0);
    expect(sujetsAutorises(etat({ enAttenteRelecture: 9 }))).toBe(1);
  });
  it("plafond jour de 10 $ : 2 contenus (3 $ chacun + 2 $ de pilotage)", () => {
    expect(sujetsAutorises(etat({ budgetJourRestantUsd: 10 }))).toBe(2);
    expect(sujetsAutorises(etat({ budgetJourRestantUsd: 4.9 }))).toBe(0);
  });
  it("compteurs corrompus : zéro", () => {
    expect(sujetsAutorises(etat({ budgetJourRestantUsd: NaN }))).toBe(0);
    expect(sujetsAutorises(etat({ lancesAujourdhui: -1 }))).toBe(0);
  });
});

describe("lancerJournee", () => {
  beforeEach(() => vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "true"));
  afterEach(() => vi.unstubAllEnvs());

  const issue: IssueContenu = { issue: "reporte", coutUsd: 0 };
  function ports(reglage: unknown, lances = { n: 0 }) {
    const lancer = vi.fn(async () => {
      lances.n++;
      return issue;
    });
    const p: PortsJournee = {
      lireReglage: async () => reglage,
      compterLancesAujourdhui: async () => lances.n,
      compterEnAttenteRelecture: async () => 0,
      budgetJourRestantUsd: async () => 50,
      prendreBesoins: async () => [{ contenuId: "x" } as unknown as Besoin],
      lancer,
    };
    return { p, lancer };
  }

  it("interrupteur d'environnement éteint : rien", async () => {
    vi.stubEnv("CONTENT_CHAINE_EDITORIALE", "");
    const { p, lancer } = ports({ actif: true });
    expect((await lancerJournee(p)).raisonArret).toBe("interrupteur");
    expect(lancer).not.toHaveBeenCalled();
  });
  it("réglage éteint : rien", async () => {
    const { p, lancer } = ports(undefined);
    expect((await lancerJournee(p)).raisonArret).toBe("eteint");
    expect(lancer).not.toHaveBeenCalled();
  });
  it("allumé : 3 sujets au plus", async () => {
    const { p, lancer } = ports({ actif: true });
    const b = await lancerJournee(p);
    expect(b.lances).toBe(3);
    expect(lancer).toHaveBeenCalledTimes(3);
  });
  it("déjà 2 lancés aujourd'hui : un seul de plus", async () => {
    const { p, lancer } = ports({ actif: true }, { n: 2 });
    await lancerJournee(p);
    expect(lancer).toHaveBeenCalledTimes(1);
  });
});
