import { describe, expect, it } from "vitest";

import {
  assemblerEspaceCommissions,
  type CommissionLue,
  type PresentationLue,
} from "../espace-commissions-assemblage";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const NOW = new Date("2026-11-25T10:00:00Z");

const pres = (id: string, nom: string): PresentationLue => ({
  id,
  denomination: nom,
  recueAt: new Date("2026-10-03T08:00:00Z"),
  statut: "reservee",
  contactEnvoyeAt: new Date("2026-10-04T08:00:00Z"),
  protegeeJusquAt: new Date("2027-04-03T08:00:00Z"),
});
const lig = (o: Partial<CommissionLue>): CommissionLue => ({
  id: "l1",
  presentationId: "p1",
  presentationApporteurId: A,
  parrainage: false,
  activite: "implementation",
  palier: "formation-generale-1j",
  montantCents: 50_000,
  statut: "due",
  releveMois: null,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  autofactureAttenteMotif: "SECRET-MOTIF",
  litigeDepuis: null,
  verseeAt: null,
  majAt: new Date("2026-11-18T09:00:00Z"),
  ...o,
});
const vue = (commissions: CommissionLue[], extra: object = {}) =>
  assemblerEspaceCommissions({
    apporteurId: A,
    regimeTva: "assujetti",
    maintenant: NOW,
    presentations: [pres("p1", "MENUISERIE DURAND")],
    reservations: [],
    commissions,
    tronque: false,
    ...extra,
  });

describe("assemblage de « Mes commissions »", () => {
  it("rattache la commission à son entreprise, montant tel quel, palier en clair", () => {
    const v = vue([lig({})]);
    const c = v.entreprises[0]!.commissions[0]!;
    expect(c.montantCents).toBe(50_000);
    expect(c.nature).toBe("Formation générale, 1 jour");
    expect(c.etat).toBe("en_attente_fiche");
  });

  it("aucune date de réservation sans PresentationReservation (jamais les 6 mois)", () => {
    expect(vue([]).entreprises[0]!.reserveeJusquAu).toBeNull();
    const v = vue([], {
      reservations: [
        {
          presentationId: "p1",
          reserveeJusquAt: new Date("2026-12-01T22:00:00Z"),
          valideeAt: new Date("2026-10-12T08:00:00Z"),
        },
      ],
    });
    expect(v.entreprises[0]!.reserveeJusquAu).toEqual(new Date("2026-12-01T22:00:00Z"));
    expect(v.entreprises[0]!.valideeLe).toEqual(new Date("2026-10-12T08:00:00Z"));
    expect(v.entreprises[0]!.reserveeJusquAu).not.toEqual(pres("p1", "x").protegeeJusquAt);
  });

  it("IDOR : une ligne rattachée à la présentation d'un autre apporteur est écartée", () => {
    const v = vue([lig({ id: "x", presentationId: "pB", presentationApporteurId: B })]);
    expect(JSON.stringify(v)).not.toContain("pB");
    expect(v.entreprises[0]!.commissions).toHaveLength(0);
  });

  it("parrainage : regroupé par autofacture, sans entreprise ni date de commande ; absent avant facture", () => {
    const faits = [
      lig({
        id: "s1",
        presentationId: "pFilleul",
        presentationApporteurId: B,
        parrainage: true,
        montantCents: 3_000,
        statut: "due",
        autofactureNumero: "AXI-APP-2026-0014",
        autofactureEmiseAt: new Date("2026-11-18T09:00:00Z"),
      }),
      lig({
        id: "s2",
        presentationId: "pFilleul2",
        presentationApporteurId: B,
        parrainage: true,
        montantCents: 2_000,
        statut: "due",
        autofactureNumero: "AXI-APP-2026-0014",
        autofactureEmiseAt: new Date("2026-11-18T09:00:00Z"),
      }),
      lig({
        id: "s3",
        presentationId: "pF3",
        presentationApporteurId: B,
        parrainage: true,
        montantCents: 900,
      }),
    ];
    // Le parrainage porte la présentation du filleul : le garde ne doit PAS l'écarter à tort.
    const v = vue(faits);
    expect(v.horsEntreprise).toHaveLength(1);
    expect(v.horsEntreprise[0]!.montantCents).toBe(5_000);
    expect(JSON.stringify(v)).not.toMatch(/pFilleul|pF3|"s1"|"s2"/);
    expect(v.entreprises[0]!.commissions).toHaveLength(0);
  });

  it("ne rend jamais un champ interdit (motif d'attente, litige, palier brut, identifiants)", () => {
    const v = vue([
      lig({ litigeDepuis: new Date(), litigeMotif: "SECRET-LITIGE" } as Partial<CommissionLue>),
    ]);
    const s = JSON.stringify(v);
    expect(s).not.toMatch(/SECRET|formation-generale-1j|"l1"/);
  });

  it("virement à venir : TVA selon le régime ; régime inconnu → aucun chiffre", () => {
    const l = lig({
      autofactureNumero: "AXI-APP-2026-0014",
      autofactureAttenteMotif: null,
      autofactureEmiseAt: new Date("2026-11-18T09:00:00Z"),
    });
    const a = vue([l]).virements[0]!;
    expect(a.montants).toEqual({ htCents: 50_000, tvaCents: 10_000, ttcCents: 60_000 });
    expect(a.echeanceLe).toEqual(new Date(Date.UTC(2026, 11, 18, 12)));
    const f = vue([l], { regimeTva: "franchise_293b" }).virements[0]!;
    expect(f.montants).toEqual({ htCents: 50_000, tvaCents: null, ttcCents: 50_000 });
    expect(vue([l], { regimeTva: null }).virements[0]!.montants).toBeNull();
  });

  it("une ligne suspendue n'est pas dans le virement ; une reprise y est déduite", () => {
    const e = new Date("2026-11-18T09:00:00Z");
    const num = "AXI-APP-2026-0014";
    const ok = lig({
      id: "a",
      autofactureNumero: num,
      autofactureAttenteMotif: null,
      autofactureEmiseAt: e,
    });
    const susp = lig({
      id: "b",
      autofactureNumero: num,
      autofactureAttenteMotif: null,
      autofactureEmiseAt: e,
      montantCents: 20_000,
      litigeDepuis: e,
    });
    const v = vue([ok, susp]).virements[0]!;
    expect(v.montants!.htCents).toBe(50_000);
  });

  it("pièces : factures et avoirs, une fois chacun", () => {
    const v = vue([
      lig({
        id: "a",
        autofactureNumero: "AXI-APP-2026-0014",
        autofactureEmiseAt: new Date("2026-11-18"),
      }),
      lig({
        id: "b",
        autofactureNumero: "AXI-APP-2026-0014",
        autofactureEmiseAt: new Date("2026-11-18"),
      }),
      lig({ id: "c", statut: "reprise", montantCents: -1000, avoirNumero: "AXI-APP-2026-0011" }),
    ]);
    expect(v.pieces.map((p) => `${p.genre}:${p.numero}`).sort()).toEqual([
      "avoir:AXI-APP-2026-0011",
      "facture:AXI-APP-2026-0014",
    ]);
  });

  it("aucun total, compteur ni classement dans la vue", () => {
    const cles = Object.keys(vue([lig({})]));
    expect(cles.sort()).toEqual([
      "entreprises",
      "horsEntreprise",
      "pieces",
      "tronque",
      "virements",
    ]);
  });
});
