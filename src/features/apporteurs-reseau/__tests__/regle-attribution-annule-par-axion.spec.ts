/**
 * Lot L4b (plan du 25/11/2026, point B4) : Axion ne peut pas empêcher la validation par son
 * inaction ou son annulation.
 *
 * Règle du dirigeant : rendez-vous annulé par Axion IA = réputé tenu ; annulé, manqué ou reporté
 * par l'ENTREPRISE = ne valide pas. Le silence d'Axion ne valide JAMAIS (la validation vient d'un
 * rendez-vous tenu ou d'un devis signé) : la « validation réputée à 30 jours » du plan est écartée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as regle from "../regle-attribution";
import { rendezVousRecevable } from "../regle-attribution";

const SAISIE = new Date("2026-12-01T10:00:00Z");
const FIN = regle.finReservation(SAISIE);
const j = (n: number) => new Date(SAISIE.getTime() + n * 86_400_000);
const base = { recueAt: SAISIE, reserveeJusquAt: FIN, maintenant: j(100) };

describe("rendez-vous annulé par Axion : réputé tenu", () => {
  it("pris pendant la réservation, annulé par Axion : validé", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: null, annuleParAxionAt: j(50) }),
    ).toEqual({ ok: true });
  });

  it("annulé par Axion après la fin des 60 jours : validé aussi (il était pris à temps)", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(59), tenuAt: null, annuleParAxionAt: j(75) }),
    ).toEqual({ ok: true });
  });

  it("pris avant la saisie : ne compte pas, même annulé par Axion", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(-1), tenuAt: null, annuleParAxionAt: j(5) }),
    ).toEqual({ ok: false, motif: "pris_avant_saisie" });
  });

  it("pris après la réservation : ne compte pas, même annulé par Axion", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(61), tenuAt: null, annuleParAxionAt: j(70) }),
    ).toEqual({ ok: false, motif: "pris_apres_reservation" });
  });

  it("annulation d'Axion datée dans le futur : pas encore réputé tenu", () => {
    expect(
      rendezVousRecevable({
        ...base,
        maintenant: j(40),
        prisAt: j(10),
        tenuAt: null,
        annuleParAxionAt: j(50),
      }),
    ).toEqual({ ok: false, motif: "pas_encore_tenu" });
  });

  it("annulation antérieure à la prise : refusée (date incohérente)", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: null, annuleParAxionAt: j(5) }),
    ).toEqual({ ok: false, motif: "tenu_avant_prise" });
  });

  it("date d'annulation illisible : refus (échec fermé)", () => {
    expect(
      rendezVousRecevable({
        ...base,
        prisAt: j(10),
        tenuAt: null,
        annuleParAxionAt: new Date(NaN),
      }),
    ).toEqual({ ok: false, motif: "pas_encore_tenu" });
  });
});

describe("rendez-vous annulé, manqué ou reporté par l'entreprise : ne valide pas", () => {
  it("sans annulation d'Axion ni tenue : jamais validé", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: null })).toEqual({
      ok: false,
      motif: "pas_encore_tenu",
    });
    expect(
      rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: null, annuleParAxionAt: null }),
    ).toEqual({ ok: false, motif: "pas_encore_tenu" });
  });
});

describe("le silence d'Axion ne valide jamais", () => {
  it("aucune fonction de validation « réputée » par inaction n'existe", () => {
    expect(Object.keys(regle).filter((n) => /reput/i.test(n))).toEqual([]);
  });

  it("le module ne porte ni « reputee » ni « premiereDemarcheSociete »", () => {
    const src = readFileSync(join(__dirname, "..", "regle-attribution.ts"), "utf8");
    expect(src).not.toMatch(/validationSource\s*=\s*["']reputee["']/);
    expect(src).not.toMatch(/premiereDemarcheSociete/);
  });
});
