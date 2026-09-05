/**
 * REQ-INT-005 + REQ-DM-018 — la dérivation du HT encaissé.
 *
 * Les deux exigences se lisent ensemble, et elles ne disent pas tout à fait la même
 * chose : REQ-INT-005 écrit « Partners dérive le HT encaissé », REQ-DM-018 écrit « Le
 * HT encaissé est FOURNI PAR AXIONIA dans le webhook » et « Partners n'infère jamais
 * un taux de TVA ». La lecture qui les honore toutes les deux est celle-ci : axionia
 * émet À LA FOIS les ingrédients que REQ-INT-005 énumère (les deux totaux de la
 * facture, le cumul encaissé, le régime) ET le `amountHtCents` déjà dérivé que
 * REQ-DM-018 exige. Partners peut alors recalculer sans jamais inférer un taux — le
 * rapport HT/TTC lui est donné, il n'a rien à deviner.
 */
import { describe, expect, it } from "vitest";

import { derivationHt, ttcDeLaFacture } from "../ht";

describe("REQ-DM-018 — le TTC de la facture, et son repli", () => {
  it("prend `montantTtcCents` quand il est renseigné", () => {
    expect(
      ttcDeLaFacture({
        montantHtCents: 100_000,
        montantTvaCents: 20_000,
        montantTtcCents: 120_000,
      }),
    ).toBe(120_000);
  });

  it("REPLI : `montantHtCents + montantTvaCents` quand `montantTtcCents` est null", () => {
    // Le champ est nullable en base (« Null pour les anciennes factures »,
    // schema.prisma). Le repli est écrit dans REQ-DM-018, il n'est pas inventé.
    expect(
      ttcDeLaFacture({ montantHtCents: 100_000, montantTvaCents: 20_000, montantTtcCents: null }),
    ).toBe(120_000);
  });

  it("le repli n'est PAS un taux inféré : à TVA nulle, TTC = HT", () => {
    expect(
      ttcDeLaFacture({ montantHtCents: 100_000, montantTvaCents: 0, montantTtcCents: null }),
    ).toBe(100_000);
  });
});

describe("REQ-INT-005 — le HT encaissé, arrondi vers le bas", () => {
  const facture = { montantHtCents: 100_000, montantTvaCents: 20_000, montantTtcCents: 120_000 };

  it("un encaissement partiel est proratisé et ARRONDI VERS LE BAS", () => {
    // 40 000 TTC sur 120 000 → 40 000 × 100 000 / 120 000 = 33 333,33… → 33 333.
    const r = derivationHt({
      facture,
      montantEncaisseTtcCents: 40_000,
      totalEncaisseTtcCents: 40_000,
    });
    expect(r.amountHtCents).toBe(33_333);
    expect(r.soldeLaFacture).toBe(false);
  });

  it("le DERNIER encaissement absorbe le reliquat : Σ des HT dérivés = HT de la facture", () => {
    // Trois tiers de 40 000. Chacun proratisé rendrait 33 333, soit 99 999 : il
    // MANQUERAIT un centime. C'est ce centime que l'exigence fait absorber.
    const un = derivationHt({
      facture,
      montantEncaisseTtcCents: 40_000,
      totalEncaisseTtcCents: 40_000,
    });
    const deux = derivationHt({
      facture,
      montantEncaisseTtcCents: 40_000,
      totalEncaisseTtcCents: 80_000,
    });
    const trois = derivationHt({
      facture,
      montantEncaisseTtcCents: 40_000,
      totalEncaisseTtcCents: 120_000,
    });

    expect(trois.soldeLaFacture).toBe(true);
    expect(trois.amountHtCents).toBe(33_334);
    expect(un.amountHtCents + deux.amountHtCents + trois.amountHtCents).toBe(
      facture.montantHtCents,
    );
  });

  it("un encaissement unique qui solde rend EXACTEMENT le HT de la facture", () => {
    const r = derivationHt({
      facture,
      montantEncaisseTtcCents: 120_000,
      totalEncaisseTtcCents: 120_000,
    });
    expect(r.amountHtCents).toBe(100_000);
    expect(r.soldeLaFacture).toBe(true);
  });

  it("un TROP-PERÇU solde aussi, et ne dépasse jamais le HT de la facture", () => {
    // Le client paie 130 000 sur 120 000 dus. La commission ne porte pas sur le
    // trop-perçu : Σ HT reste borné au HT facturé.
    const r = derivationHt({
      facture,
      montantEncaisseTtcCents: 130_000,
      totalEncaisseTtcCents: 130_000,
    });
    expect(r.amountHtCents).toBe(100_000);
  });

  it("une facture EXONÉRÉE (TVA 0) rend HT = TTC, sans taux inféré", () => {
    const exoneree = { montantHtCents: 90_000, montantTvaCents: 0, montantTtcCents: 90_000 };
    const r = derivationHt({
      facture: exoneree,
      montantEncaisseTtcCents: 30_000,
      totalEncaisseTtcCents: 30_000,
    });
    expect(r.amountHtCents).toBe(30_000);
  });

  it("ÉCHOUE BRUYAMMENT sur un TTC nul avec un encaissement non nul — jamais un 0 silencieux", () => {
    // 🔑 C'est le point de RM-03 appliqué au calcul : un `?? 0` ici produirait une
    // commission de zéro euro sur une facture réellement encaissée, et personne ne
    // le verrait jamais. Une donnée incohérente doit s'arrêter, pas se compléter.
    const impossible = { montantHtCents: 0, montantTvaCents: 0, montantTtcCents: 0 };
    expect(() =>
      derivationHt({
        facture: impossible,
        montantEncaisseTtcCents: 5_000,
        totalEncaisseTtcCents: 5_000,
      }),
    ).toThrow(/TTC/i);
  });

  it("ÉCHOUE BRUYAMMENT si le cumul est inférieur à l'encaissement courant", () => {
    // `totalEncaisseTtcCents` INCLUT l'encaissement courant. S'il ne l'inclut pas,
    // le reliquat serait calculé sur un antérieur négatif — autant s'arrêter.
    expect(() =>
      derivationHt({ facture, montantEncaisseTtcCents: 40_000, totalEncaisseTtcCents: 10_000 }),
    ).toThrow(/cumul/i);
  });

  it("une facture à zéro encaissée à zéro rend zéro, sans lever", () => {
    const zero = { montantHtCents: 0, montantTvaCents: 0, montantTtcCents: 0 };
    expect(
      derivationHt({ facture: zero, montantEncaisseTtcCents: 0, totalEncaisseTtcCents: 0 })
        .amountHtCents,
    ).toBe(0);
  });
});
