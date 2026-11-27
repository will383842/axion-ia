import { describe, expect, it } from "vitest";
import {
  DATE_DEBUT_COLLECTE,
  estOuvert,
  limiteEffacement,
  QUESTIONNAIRE_OUVERT,
} from "../constantes";
import * as constantes from "../constantes";

const AVANT = new Date("2026-11-30T23:59:00Z");
const OUVERTURE = new Date("2026-12-01T00:00:00Z");

describe("constantes du questionnaire : collecte sans date de fin", () => {
  it("n'exporte plus DATE_FIN_COLLECTE", () => {
    expect("DATE_FIN_COLLECTE" in constantes).toBe(false);
    expect(DATE_DEBUT_COLLECTE).toBe("2026-12-01");
  });

  it("la mise en ligne reste éteinte tant que l'éditeur ne l'a pas décidé", () => {
    expect(QUESTIONNAIRE_OUVERT).toBe(false);
  });

  it("interrupteur éteint : fermé à toutes les dates", () => {
    for (const d of [
      AVANT,
      OUVERTURE,
      "2027-06-01T00:00:00Z",
      "2030-01-01T00:00:00Z",
      "2040-01-01T00:00:00Z",
    ]) {
      expect(estOuvert(new Date(d), false)).toBe(false);
    }
  });

  it("interrupteur allumé : fermé avant le 1er décembre 2026, ouvert ensuite, sans fin", () => {
    expect(estOuvert(AVANT, true)).toBe(false);
    expect(estOuvert(OUVERTURE, true)).toBe(true);
    expect(estOuvert(new Date("2030-06-01T00:00:00Z"), true)).toBe(true);
    expect(estOuvert(new Date("2040-06-01T00:00:00Z"), true)).toBe(true);
  });

  it("sans second argument, estOuvert suit l'interrupteur réel", () => {
    expect(estOuvert(new Date("2040-06-01T00:00:00Z"))).toBe(QUESTIONNAIRE_OUVERT);
  });
});

describe("limiteEffacement : 24 mois", () => {
  const now = new Date("2028-12-15T10:00:00Z");
  const limite = limiteEffacement(now);
  const vise = (jour: string) => new Date(jour).getTime() <= limite.getTime();

  it("une réponse du jour J − 24 mois est visée", () => {
    expect(vise("2026-12-15T00:00:00Z")).toBe(true);
  });

  it("une réponse du jour J − 24 mois + 1 jour n'est pas visée", () => {
    expect(vise("2026-12-16T00:00:00Z")).toBe(false);
  });

  it("29 février : déborde sur le 1er mars, soit un jour plus tôt (sans conséquence)", () => {
    expect(limiteEffacement(new Date("2032-02-29T10:00:00Z")).toISOString()).toBe(
      "2030-03-01T00:00:00.000Z",
    );
  });
});
