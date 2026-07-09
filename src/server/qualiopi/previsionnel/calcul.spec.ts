/**
 * Tests — calcul.ts (prévisionnel financier).
 *
 * On couvre chaque règle métier isolément puis en combinaison :
 *   - CA planifié (planifiee + en_cours) ; annulée/reportée = 0 ;
 *   - CA réalisé ;
 *   - encaissements attendus par mois d'échéance ; facture payée exclue ; facture
 *     sans échéance ignorée ;
 *   - reste à facturer (réalisée sans facture émise/payée ; brouillon ne compte pas) ;
 *   - impayés (échéance passée vs now) ; payée jamais impayée ;
 *   - bornes de mois (Europe/Paris) et tri chronologique ;
 *   - totaux.
 */

import { describe, it, expect } from "vitest";
import {
  agregerParMois,
  totaux,
  moisDe,
  ligneVide,
  type SessionPrevisionnel,
  type FacturePrevisionnel,
  type SessionStatutPrev,
  type FactureStatutPrev,
} from "./calcul";

/** Référence temporelle stable pour tous les tests (mi-juillet 2026). */
const NOW = new Date("2026-07-15T12:00:00Z");

function sess(
  id: string,
  dateDebut: string,
  statut: SessionStatutPrev,
  montantHtCents: number,
): SessionPrevisionnel {
  return { id, dateDebut: new Date(dateDebut), statut, montantHtCents };
}

function fact(
  sessionId: string | null,
  statut: FactureStatutPrev,
  montantHtCents: number,
  echeanceAt: string | null,
): FacturePrevisionnel {
  return {
    sessionId,
    statut,
    montantHtCents,
    echeanceAt: echeanceAt !== null ? new Date(echeanceAt) : null,
  };
}

/** Récupère une ligne par mois (ou undefined). */
function ligne(lignes: ReturnType<typeof agregerParMois>, mois: string) {
  return lignes.find((l) => l.mois === mois);
}

describe("moisDe", () => {
  it("extrait le mois « YYYY-MM » en Europe/Paris", () => {
    expect(moisDe(new Date("2026-07-09T10:00:00Z"))).toBe("2026-07");
  });

  it("rattache au mois PARISIEN, pas au mois UTC (bord de mois)", () => {
    // 31 juillet 23h30 UTC = 1er août 01h30 Paris (heure d'été +2) → août.
    expect(moisDe(new Date("2026-07-31T23:30:00Z"))).toBe("2026-08");
  });
});

describe("ligneVide", () => {
  it("initialise tous les montants à 0", () => {
    expect(ligneVide("2026-07")).toEqual({
      mois: "2026-07",
      caPlanifieCents: 0,
      caRealiseCents: 0,
      encaissementsAttendusCents: 0,
      resteAFacturerCents: 0,
      impayesCents: 0,
    });
  });
});

describe("agregerParMois — CA planifié", () => {
  it("additionne planifiee + en_cours sur le mois de dateDebut", () => {
    const lignes = agregerParMois(
      [
        sess("s1", "2026-07-10T08:00:00Z", "planifiee", 100_000),
        sess("s2", "2026-07-20T08:00:00Z", "en_cours", 50_000),
      ],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-07")?.caPlanifieCents).toBe(150_000);
  });

  it("une session ANNULÉE compte 0 (ni planifié ni réalisé)", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-07-10T08:00:00Z", "annulee", 100_000)],
      [],
      NOW,
    );
    // Aucune ligne créée, ou une ligne à 0.
    expect(ligne(lignes, "2026-07")?.caPlanifieCents ?? 0).toBe(0);
  });

  it("une session REPORTÉE compte 0", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-07-10T08:00:00Z", "reportee", 100_000)],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-07")?.caPlanifieCents ?? 0).toBe(0);
  });
});

describe("agregerParMois — CA réalisé", () => {
  it("additionne les sessions réalisées sur le mois de dateDebut", () => {
    const lignes = agregerParMois(
      [
        sess("s1", "2026-06-10T08:00:00Z", "realisee", 80_000),
        sess("s2", "2026-06-25T08:00:00Z", "realisee", 20_000),
      ],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.caRealiseCents).toBe(100_000);
  });

  it("une session réalisée n'alimente PAS le CA planifié", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-06-10T08:00:00Z", "realisee", 80_000)],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.caPlanifieCents).toBe(0);
  });
});

describe("agregerParMois — encaissements attendus", () => {
  it("range les factures émises au mois de leur ÉCHÉANCE (pas d'émission)", () => {
    // Émise en juin, échéance en août → doit tomber en août.
    const lignes = agregerParMois([], [fact("s1", "emise", 120_000, "2026-08-31T00:00:00Z")], NOW);
    expect(ligne(lignes, "2026-08")?.encaissementsAttendusCents).toBe(120_000);
    expect(ligne(lignes, "2026-06")).toBeUndefined();
  });

  it("une facture PAYÉE ne compte NI en attendu NI en impayé", () => {
    const lignes = agregerParMois(
      [],
      [fact("s1", "payee", 120_000, "2026-05-01T00:00:00Z")], // échéance passée
      NOW,
    );
    expect(ligne(lignes, "2026-05")).toBeUndefined();
  });

  it("une facture BROUILLON ou ANNULÉE ne compte pas en attendu", () => {
    const lignes = agregerParMois(
      [],
      [
        fact("s1", "brouillon", 10_000, "2026-08-31T00:00:00Z"),
        fact("s2", "annulee", 20_000, "2026-08-31T00:00:00Z"),
      ],
      NOW,
    );
    expect(ligne(lignes, "2026-08")).toBeUndefined();
  });

  it("une facture émise SANS échéance est ignorée (attendu et impayé)", () => {
    const lignes = agregerParMois([], [fact("s1", "emise", 99_000, null)], NOW);
    expect(lignes).toHaveLength(0);
  });
});

describe("agregerParMois — reste à facturer", () => {
  it("session réalisée SANS facture émise/payée → reste à facturer", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-06-10T08:00:00Z", "realisee", 70_000)],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.resteAFacturerCents).toBe(70_000);
  });

  it("session réalisée DÉJÀ facturée (facture émise) → 0 reste à facturer", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-06-10T08:00:00Z", "realisee", 70_000)],
      [fact("s1", "emise", 70_000, "2026-07-10T00:00:00Z")],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.resteAFacturerCents).toBe(0);
    // Le CA réalisé reste, lui, bien comptabilisé.
    expect(ligne(lignes, "2026-06")?.caRealiseCents).toBe(70_000);
  });

  it("session réalisée facturée PAYÉE → 0 reste à facturer", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-06-10T08:00:00Z", "realisee", 70_000)],
      [fact("s1", "payee", 70_000, "2026-07-10T00:00:00Z")],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.resteAFacturerCents).toBe(0);
  });

  it("une facture BROUILLON ne « facture » pas : la session reste à facturer", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-06-10T08:00:00Z", "realisee", 70_000)],
      [fact("s1", "brouillon", 70_000, "2026-07-10T00:00:00Z")],
      NOW,
    );
    expect(ligne(lignes, "2026-06")?.resteAFacturerCents).toBe(70_000);
  });

  it("une session PLANIFIÉE (non réalisée) n'entre jamais en reste à facturer", () => {
    const lignes = agregerParMois(
      [sess("s1", "2026-08-10T08:00:00Z", "planifiee", 70_000)],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-08")?.resteAFacturerCents).toBe(0);
  });
});

describe("agregerParMois — impayés", () => {
  it("facture émise dont l'échéance est passée → impayé", () => {
    const lignes = agregerParMois(
      [],
      [fact("s1", "emise", 45_000, "2026-06-30T00:00:00Z")], // avant NOW (15 juil.)
      NOW,
    );
    const l = ligne(lignes, "2026-06");
    expect(l?.impayesCents).toBe(45_000);
    // L'impayé est AUSSI compté en encaissement attendu (colonne d'alerte).
    expect(l?.encaissementsAttendusCents).toBe(45_000);
  });

  it("facture émise dont l'échéance est future → attendu mais PAS impayé", () => {
    const lignes = agregerParMois([], [fact("s1", "emise", 45_000, "2026-09-30T00:00:00Z")], NOW);
    const l = ligne(lignes, "2026-09");
    expect(l?.encaissementsAttendusCents).toBe(45_000);
    expect(l?.impayesCents).toBe(0);
  });

  it("échéance exactement égale à now → PAS impayé (comparaison stricte)", () => {
    const lignes = agregerParMois([], [fact("s1", "emise", 45_000, NOW.toISOString())], NOW);
    expect(ligne(lignes, moisDe(NOW))?.impayesCents).toBe(0);
  });

  it("facture PAYÉE échue ne compte jamais en impayé", () => {
    const lignes = agregerParMois([], [fact("s1", "payee", 45_000, "2026-01-01T00:00:00Z")], NOW);
    expect(ligne(lignes, "2026-01")).toBeUndefined();
  });
});

describe("agregerParMois — bornes de mois & tri", () => {
  it("trie les lignes par mois croissant", () => {
    const lignes = agregerParMois(
      [
        sess("s3", "2026-09-01T08:00:00Z", "planifiee", 1),
        sess("s1", "2026-05-01T08:00:00Z", "realisee", 1),
        sess("s2", "2026-07-01T08:00:00Z", "planifiee", 1),
      ],
      [],
      NOW,
    );
    expect(lignes.map((l) => l.mois)).toEqual(["2026-05", "2026-07", "2026-09"]);
  });

  it("le 1er du mois à minuit Paris tombe dans le bon mois (pas le précédent)", () => {
    // 30 sept. 22h00 UTC = 1er oct. 00h00 Paris (heure d'été +2).
    const lignes = agregerParMois(
      [sess("s1", "2026-09-30T22:00:00Z", "planifiee", 5_000)],
      [],
      NOW,
    );
    expect(ligne(lignes, "2026-10")?.caPlanifieCents).toBe(5_000);
    expect(ligne(lignes, "2026-09")).toBeUndefined();
  });

  it("aucune donnée → aucune ligne", () => {
    expect(agregerParMois([], [], NOW)).toEqual([]);
  });
});

describe("agregerParMois — scénario combiné", () => {
  it("cumule correctement toutes les colonnes sur des mois multiples", () => {
    const sessions: SessionPrevisionnel[] = [
      sess("s1", "2026-06-10T08:00:00Z", "realisee", 100_000), // réalisé juin, non facturé
      sess("s2", "2026-06-20T08:00:00Z", "realisee", 40_000), // réalisé juin, facturé émis
      sess("s3", "2026-07-05T08:00:00Z", "planifiee", 60_000), // planifié juillet
      sess("s4", "2026-07-15T08:00:00Z", "annulee", 999_000), // ignoré
    ];
    const factures: FacturePrevisionnel[] = [
      fact("s2", "emise", 40_000, "2026-05-31T00:00:00Z"), // impayé (échu) → mai
      fact("s1", "brouillon", 100_000, "2026-08-01T00:00:00Z"), // ne facture pas s1
    ];
    const lignes = agregerParMois(sessions, factures, NOW);

    const mai = ligne(lignes, "2026-05");
    expect(mai?.encaissementsAttendusCents).toBe(40_000);
    expect(mai?.impayesCents).toBe(40_000);

    const juin = ligne(lignes, "2026-06");
    expect(juin?.caRealiseCents).toBe(140_000);
    // s1 non facturé (brouillon ne compte pas) + s2 facturé émis → reste = 100 000.
    expect(juin?.resteAFacturerCents).toBe(100_000);

    const juillet = ligne(lignes, "2026-07");
    expect(juillet?.caPlanifieCents).toBe(60_000);
  });
});

describe("totaux", () => {
  it("somme colonne par colonne", () => {
    const lignes = agregerParMois(
      [
        sess("s1", "2026-06-10T08:00:00Z", "realisee", 100_000),
        sess("s2", "2026-07-05T08:00:00Z", "planifiee", 60_000),
      ],
      [fact("s3", "emise", 30_000, "2026-06-30T00:00:00Z")], // impayé
      NOW,
    );
    expect(totaux(lignes)).toEqual({
      caPlanifieCents: 60_000,
      caRealiseCents: 100_000,
      encaissementsAttendusCents: 30_000,
      resteAFacturerCents: 100_000,
      impayesCents: 30_000,
    });
  });

  it("aucune ligne → tout à 0", () => {
    expect(totaux([])).toEqual({
      caPlanifieCents: 0,
      caRealiseCents: 0,
      encaissementsAttendusCents: 0,
      resteAFacturerCents: 0,
      impayesCents: 0,
    });
  });
});
