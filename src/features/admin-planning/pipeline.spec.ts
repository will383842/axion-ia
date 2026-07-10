// Tests — pipeline.ts (entonnoir commercial).
//
// Ce qui compte : l'étage « réalisé, à facturer » (dérivé, et invisible partout
// ailleurs), le fait qu'une demande n'ait PAS de montant (`null` ≠ 0 €), les
// fuites comptées et non masquées, et un taux d'acceptation qui ne punit pas
// l'activité commerciale.

import { describe, it, expect } from "vitest";
import {
  ageEnJours,
  construirePipeline,
  tauxAcceptation,
  type DevisRow,
  type FactureRow,
  type PipelineEntrees,
  type SessionRow,
} from "./pipeline";

const MAINTENANT = new Date("2026-06-10T12:00:00Z");

function jours(n: number): Date {
  return new Date(MAINTENANT.getTime() - n * 86_400_000);
}

function devis(over: Partial<DevisRow> = {}): DevisRow {
  return {
    statut: "envoye",
    montantTotalHtCents: 100_000,
    sentAt: jours(5),
    createdAt: jours(6),
    ...over,
  };
}

function session(over: Partial<SessionRow> = {}): SessionRow {
  return { id: "s1", statut: "realisee", montantHtCents: 200_000, dateFin: jours(10), ...over };
}

function facture(over: Partial<FactureRow> = {}): FactureRow {
  return { sessionId: "s1", statut: "emise", montantHtCents: 200_000, emiseAt: jours(3), ...over };
}

function entrees(over: Partial<PipelineEntrees> = {}): PipelineEntrees {
  return { demandes: [], devis: [], sessions: [], factures: [], ...over };
}

const p = (e: Partial<PipelineEntrees>) => construirePipeline(entrees(e), MAINTENANT);
const etage = (e: Partial<PipelineEntrees>, code: string) =>
  p(e).etages.find((x) => x.code === code);

/* ────────────────────────────────────────────────────────────────────────────── */

describe("ageEnJours", () => {
  it("compte des jours pleins", () => {
    expect(ageEnJours(jours(40), MAINTENANT)).toBe(40);
  });

  it("une date future donne 0, jamais un négatif", () => {
    expect(ageEnJours(new Date(MAINTENANT.getTime() + 86_400_000), MAINTENANT)).toBe(0);
  });

  it("moins de 24 h → 0 jour", () => {
    expect(ageEnJours(new Date(MAINTENANT.getTime() - 3_600_000), MAINTENANT)).toBe(0);
  });
});

describe("étage « demande » — compté, jamais suivi", () => {
  it("INVARIANT : une demande n'a PAS de montant (`null`, pas 0 €)", () => {
    // `0` laisserait croire à des affaires à 0 €. `null` dit qu'on ne sait pas.
    const e = etage({ demandes: [{ status: "new", createdAt: jours(2) }] }, "demande");
    expect(e?.montantHtCents).toBeNull();
  });

  it("INVARIANT : l'étage est marqué NON chaîné", () => {
    // `Submission` ne pointe vers aucun devis : tracer la flèche serait un mensonge.
    expect(etage({}, "demande")?.chaine).toBe(false);
  });

  it("tous les autres étages sont chaînés", () => {
    const autres = p({}).etages.filter((x) => x.code !== "demande");
    expect(autres.every((x) => x.chaine)).toBe(true);
  });

  it("ne compte que les demandes encore en jeu", () => {
    const e = etage(
      {
        demandes: [
          { status: "new", createdAt: jours(1) },
          { status: "qualifying", createdAt: jours(2) },
          { status: "negotiating", createdAt: jours(3) },
          { status: "converted", createdAt: jours(4) }, // gagnée
          { status: "lost", createdAt: jours(5) }, // perdue
          { status: "archived", createdAt: jours(6) }, // classée
        ],
      },
      "demande",
    );
    expect(e?.nb).toBe(3);
    expect(e?.ageMaxJours).toBe(3);
  });
});

describe("étage « devis en attente »", () => {
  it("l'âge remonte la plus VIEILLE affaire bloquée", () => {
    const e = etage(
      { devis: [devis({ sentAt: jours(3) }), devis({ sentAt: jours(40) })] },
      "devis_envoye",
    );
    expect(e?.nb).toBe(2);
    expect(e?.ageMaxJours).toBe(40); // le devis mort qui s'ignore
  });

  it("retombe sur `createdAt` quand `sentAt` n'a pas été posé", () => {
    const e = etage({ devis: [devis({ sentAt: null, createdAt: jours(12) })] }, "devis_envoye");
    expect(e?.ageMaxJours).toBe(12);
  });

  it("un brouillon jamais envoyé n'est pas dans l'entonnoir", () => {
    expect(etage({ devis: [devis({ statut: "brouillon" })] }, "devis_envoye")?.nb).toBe(0);
  });

  it("somme les montants HT", () => {
    const e = etage(
      { devis: [devis({ montantTotalHtCents: 100_000 }), devis({ montantTotalHtCents: 50_000 })] },
      "devis_envoye",
    );
    expect(e?.montantHtCents).toBe(150_000);
  });
});

describe("étage « devis acceptés »", () => {
  it("compte `accepte` ET `transforme_convention`", () => {
    const e = etage(
      { devis: [devis({ statut: "accepte" }), devis({ statut: "transforme_convention" })] },
      "devis_accepte",
    );
    expect(e?.nb).toBe(2);
  });

  it("un devis refusé n'y est pas", () => {
    expect(etage({ devis: [devis({ statut: "refuse" })] }, "devis_accepte")?.nb).toBe(0);
  });
});

describe("étage « réalisé, à facturer » — dérivé, invisible ailleurs", () => {
  it("INVARIANT : une session réalisée SANS facture y tombe", () => {
    const e = etage({ sessions: [session({ id: "s1" })], factures: [] }, "a_facturer");
    expect(e?.nb).toBe(1);
    expect(e?.montantHtCents).toBe(200_000);
    expect(e?.ageMaxJours).toBe(10); // 10 jours de travail livré non facturé
  });

  it("une session facturée (émise) en sort", () => {
    const e = etage(
      {
        sessions: [session({ id: "s1" })],
        factures: [facture({ sessionId: "s1", statut: "emise" })],
      },
      "a_facturer",
    );
    expect(e?.nb).toBe(0);
  });

  it("une session déjà PAYÉE en sort aussi", () => {
    const e = etage(
      {
        sessions: [session({ id: "s1" })],
        factures: [facture({ sessionId: "s1", statut: "payee" })],
      },
      "a_facturer",
    );
    expect(e?.nb).toBe(0);
  });

  it("une facture ANNULÉE ne fait pas sortir la session (elle reste à facturer)", () => {
    const e = etage(
      {
        sessions: [session({ id: "s1" })],
        factures: [facture({ sessionId: "s1", statut: "annulee" })],
      },
      "a_facturer",
    );
    expect(e?.nb).toBe(1);
  });

  it("un brouillon de facture ne fait pas sortir la session", () => {
    const e = etage(
      {
        sessions: [session({ id: "s1" })],
        factures: [facture({ sessionId: "s1", statut: "brouillon" })],
      },
      "a_facturer",
    );
    expect(e?.nb).toBe(1);
  });

  it("une facture sans `sessionId` ne dédouane aucune session", () => {
    const e = etage(
      { sessions: [session({ id: "s1" })], factures: [facture({ sessionId: null })] },
      "a_facturer",
    );
    expect(e?.nb).toBe(1);
  });

  it("une session planifiée ou annulée n'est pas « à facturer »", () => {
    const e = etage(
      {
        sessions: [
          session({ id: "a", statut: "planifiee" }),
          session({ id: "b", statut: "annulee" }),
        ],
      },
      "a_facturer",
    );
    expect(e?.nb).toBe(0);
  });
});

describe("étages de facturation", () => {
  it("« émises impayées » = statut `emise` seulement", () => {
    const e = etage(
      { factures: [facture({ statut: "emise" }), facture({ statut: "payee" })] },
      "facture_emise",
    );
    expect(e?.nb).toBe(1);
  });

  it("l'âge d'une impayée part de sa date d'émission", () => {
    const e = etage({ factures: [facture({ emiseAt: jours(75) })] }, "facture_emise");
    expect(e?.ageMaxJours).toBe(75);
  });

  it("une impayée sans date d'émission n'invente pas d'âge", () => {
    const e = etage({ factures: [facture({ emiseAt: null })] }, "facture_emise");
    expect(e?.ageMaxJours).toBeNull();
  });

  it("« encaissé » n'a pas d'âge (rien n'y est bloqué)", () => {
    const e = etage({ factures: [facture({ statut: "payee" })] }, "facture_payee");
    expect(e?.nb).toBe(1);
    expect(e?.ageMaxJours).toBeNull();
  });
});

describe("fuites — comptées, jamais masquées", () => {
  it("n'affiche que les fuites non nulles", () => {
    expect(p({}).fuites).toEqual([]);
  });

  it("remonte chaque sortie nommée avec son montant", () => {
    const r = p({
      demandes: [{ status: "lost", createdAt: jours(1) }],
      devis: [
        devis({ statut: "refuse", montantTotalHtCents: 70_000 }),
        devis({ statut: "expire", montantTotalHtCents: 30_000 }),
      ],
      sessions: [session({ statut: "annulee", montantHtCents: 500_000 })],
      factures: [facture({ statut: "annulee", montantHtCents: 10_000 })],
    });
    const parCode = Object.fromEntries(r.fuites.map((f) => [f.code, f]));
    expect(parCode["demande_perdue"]?.nb).toBe(1);
    expect(parCode["demande_perdue"]?.montantHtCents).toBeNull(); // pas de prix sur une demande
    expect(parCode["devis_refuse"]?.montantHtCents).toBe(70_000);
    expect(parCode["devis_expire"]?.montantHtCents).toBe(30_000);
    expect(parCode["session_annulee"]?.montantHtCents).toBe(500_000);
    expect(parCode["facture_annulee"]?.montantHtCents).toBe(10_000);
  });
});

describe("tauxAcceptation — ne punit pas l'activité commerciale", () => {
  it("INVARIANT : un devis EN ATTENTE n'entre pas au dénominateur", () => {
    // Sinon chaque devis envoyé ferait baisser le taux.
    const avecAttente = tauxAcceptation([
      devis({ statut: "accepte" }),
      devis({ statut: "refuse" }),
      devis({ statut: "envoye" }),
      devis({ statut: "envoye" }),
    ]);
    expect(avecAttente).toBe(50); // 1 accepté / 2 tranchés
  });

  it("compte les expirés comme des échecs", () => {
    expect(tauxAcceptation([devis({ statut: "accepte" }), devis({ statut: "expire" })])).toBe(50);
  });

  it("`transforme_convention` compte comme accepté", () => {
    expect(tauxAcceptation([devis({ statut: "transforme_convention" })])).toBe(100);
  });

  it("aucun devis tranché → `null`, pas « 0 % »", () => {
    // « 0 % » ferait croire à un échec plutôt qu'à une absence de donnée.
    expect(tauxAcceptation([devis({ statut: "envoye" })])).toBeNull();
    expect(tauxAcceptation([])).toBeNull();
  });

  it("arrondit à l'entier", () => {
    expect(
      tauxAcceptation([
        devis({ statut: "accepte" }),
        devis({ statut: "refuse" }),
        devis({ statut: "refuse" }),
      ]),
    ).toBe(33);
  });
});

describe("scénario intégré", () => {
  it("un cycle complet remplit chaque étage une fois", () => {
    const r = p({
      demandes: [{ status: "qualifying", createdAt: jours(2) }],
      devis: [devis({ statut: "envoye" }), devis({ statut: "accepte" })],
      sessions: [session({ id: "livree-non-facturee" }), session({ id: "livree-facturee" })],
      factures: [
        facture({ sessionId: "livree-facturee", statut: "emise" }),
        facture({ sessionId: null, statut: "payee", montantHtCents: 90_000 }),
      ],
    });
    const n = Object.fromEntries(r.etages.map((e) => [e.code, e.nb]));
    expect(n).toEqual({
      demande: 1,
      devis_envoye: 1,
      devis_accepte: 1,
      a_facturer: 1,
      facture_emise: 1,
      facture_payee: 1,
    });
    expect(r.tauxAcceptationDevisPct).toBe(100); // 1 accepté, 0 tranché contre
  });
});
