import { describe, expect, it } from "vitest";

import { LIBELLE_PARRAINAGE } from "../../autofacture-donnees";
import { arrondiAuCentime, calculerReleve, totauxDenormalises } from "../calcul";
import { empreinteContenu, empreinteControle } from "../empreinte";
import type { CommissionLue, PieceLue } from "../types";
import { commission, piece } from "./fixtures";

const PREPARATION = new Date("2026-11-02T08:00:00Z");

function calcul(
  commissions: CommissionLue[],
  pieces: PieceLue[],
  periode = "2026-10",
  preparationAt: Date = PREPARATION,
) {
  return calculerReleve({ periode, preparationAt, commissions, pieces });
}

describe("période non close : refusée", () => {
  it("le mois en cours ne se calcule pas", () => {
    expect(() => calcul([], [], "2026-11", new Date("2026-11-20T10:00:00Z"))).toThrow(/pas close/i);
  });
});

describe("mois vide", () => {
  it("aucune ligne : version courte, tout à zéro", () => {
    const { contenu, anomalies } = calcul([], []);
    expect(contenu.aucunMouvement).toBe(true);
    expect(contenu.facturees).toEqual({ lignes: [], pieces: [] });
    expect(contenu.avoirs).toEqual({ lignes: [], pieces: [] });
    expect(contenu.virements).toEqual([]);
    expect(contenu.totaux).toEqual({
      factureHtCents: 0,
      avoirHtCents: 0,
      netHtCents: 0,
      tvaCents: 0,
      ttcCents: 0,
      vireTtcCents: 0,
    });
    expect(contenu.cumulAnnee.netHtCents).toBe(0);
    expect(contenu.coupureAt).toBe("2026-10-31T23:00:00.000Z");
    expect(contenu.formatVersion).toBe(1);
    expect(anomalies).toEqual([]);
  });

  it("un mois sans mouvement mais avec un report n'est pas « sans mouvement » en D, mais l'est en A, B, C", () => {
    const { contenu } = calcul(
      [
        commission({
          autofactureNumero: null,
          autofactureEmiseAt: null,
          autofactureAttenteDepuis: new Date("2026-10-05T10:00:00Z"),
          autofactureAttenteMotif: "adresse de l'apporteur",
        }),
      ],
      [],
    );
    expect(contenu.aucunMouvement).toBe(true);
    expect(contenu.report.enAttenteAutofacture).toHaveLength(1);
  });
});

describe("A : commissions facturées dans le mois", () => {
  it("une ligne, TVA lue sur la pièce", () => {
    const { contenu } = calcul([commission()], [piece()]);
    expect(contenu.aucunMouvement).toBe(false);
    expect(contenu.facturees.lignes).toHaveLength(1);
    const l = contenu.facturees.lignes[0]!;
    expect(l.dateEmission).toBe("2026-10-15");
    expect(l.entreprise).toBe("Société fictive");
    expect(l.montantHtCents).toBe(10_000);
    expect(l.pieceNumero).toBe("AXI-APP-2026-0001");
    expect(l.factureClient).toEqual({ numero: "F-2026-0001", date: "2026-09-20" });
    expect(l.encaissementIntegralLe).toBe("2026-10-14");
    expect(l.statut).toEqual({ code: "facturee", echeanceLe: "2026-11-13" });
    expect(contenu.facturees.pieces).toEqual([
      {
        numero: "AXI-APP-2026-0001",
        emiseLe: "2026-10-15",
        regimeTva: "assujetti",
        mention293b: false,
        htCents: 10_000,
        tvaCents: 2_000,
        ttcCents: 12_000,
        renvoiFacture: null,
      },
    ]);
    expect(contenu.totaux.factureHtCents).toBe(10_000);
    expect(contenu.totaux.tvaCents).toBe(2_000);
    expect(contenu.totaux.ttcCents).toBe(12_000);
  });

  it("la TVA est LUE sur la pièce, jamais recalculée au taux courant", () => {
    const { contenu } = calcul(
      [commission()],
      [piece({ totalTvaCents: 1_234, totalTtcCents: 11_234 })],
    );
    expect(contenu.facturees.pieces[0]!.tvaCents).toBe(1_234);
    expect(contenu.totaux.ttcCents).toBe(11_234);
  });

  it("franchise 293 B : mention reprise de la pièce, TVA nulle", () => {
    const { contenu } = calcul(
      [commission()],
      [piece({ regimeTva: "franchise_293b", totalTvaCents: 0, totalTtcCents: 10_000 })],
    );
    expect(contenu.facturees.pieces[0]!.mention293b).toBe(true);
    expect(contenu.totaux.tvaCents).toBe(0);
    expect(contenu.totaux.ttcCents).toBe(10_000);
  });

  it("23 h 30 Paris le dernier jour : dans le mois ; 00 h 30 Paris le lendemain : hors du mois", () => {
    const dedans = commission({
      id: "dedans",
      autofactureEmiseAt: new Date("2026-10-31T22:30:00Z"),
    });
    const dehors = commission({
      id: "dehors",
      autofactureNumero: "AXI-APP-2026-0002",
      autofactureEmiseAt: new Date("2026-10-31T23:30:00Z"),
    });
    const pieces = [
      piece({ emiseAt: new Date("2026-10-31T22:30:00Z") }),
      piece({ numero: "AXI-APP-2026-0002", emiseAt: new Date("2026-10-31T23:30:00Z") }),
    ];
    const oct = calcul([dedans, dehors], pieces, "2026-10").contenu;
    expect(oct.facturees.lignes.map((l) => l.pieceNumero)).toEqual(["AXI-APP-2026-0001"]);
    const nov = calcul(
      [dedans, dehors],
      pieces,
      "2026-11",
      new Date("2026-12-02T08:00:00Z"),
    ).contenu;
    expect(nov.facturees.lignes.map((l) => l.pieceNumero)).toEqual(["AXI-APP-2026-0002"]);
    expect(nov.facturees.lignes[0]!.dateEmission).toBe("2026-11-01");
  });

  it("changement d'année : 23 h 59 Paris le 31 décembre est en décembre, 00 h 00 est en janvier", () => {
    const dec = commission({
      id: "dec",
      autofactureEmiseAt: new Date("2026-12-31T22:59:00Z"),
    });
    const jan = commission({
      id: "jan",
      autofactureNumero: "AXI-APP-2027-0001",
      autofactureEmiseAt: new Date("2026-12-31T23:00:00Z"),
    });
    const pieces = [
      piece({ emiseAt: new Date("2026-12-31T22:59:00Z") }),
      piece({ numero: "AXI-APP-2027-0001", emiseAt: new Date("2026-12-31T23:00:00Z") }),
    ];
    const d = calcul([dec, jan], pieces, "2026-12", new Date("2027-01-05T08:00:00Z")).contenu;
    expect(d.facturees.lignes.map((l) => l.pieceNumero)).toEqual(["AXI-APP-2026-0001"]);
    const j = calcul([dec, jan], pieces, "2027-01", new Date("2027-02-03T08:00:00Z")).contenu;
    expect(j.facturees.lignes.map((l) => l.pieceNumero)).toEqual(["AXI-APP-2027-0001"]);
  });

  it("jamais deux fois : une ligne en double dans l'entrée ne compte qu'une fois", () => {
    const c = commission();
    const { contenu } = calcul([c, c], [piece()]);
    expect(contenu.facturees.lignes).toHaveLength(1);
    expect(contenu.totaux.factureHtCents).toBe(10_000);
  });

  it("encaissée en M, facturée en M+1 : en D2 de M, puis en A de M+1, jamais les deux", () => {
    const c = commission({
      autofactureNumero: null,
      autofactureEmiseAt: new Date("2026-11-03T10:00:00Z"),
      autofactureAttenteDepuis: new Date("2026-10-20T10:00:00Z"),
      autofactureAttenteMotif: "SIREN de l'apporteur",
    });
    // La commission porte son numéro une fois émise : on le simule par la pièce de novembre.
    const emise = { ...c, autofactureNumero: "AXI-APP-2026-0007" };
    const p = piece({ numero: "AXI-APP-2026-0007", emiseAt: new Date("2026-11-03T10:00:00Z") });
    const oct = calcul([emise], [p], "2026-10").contenu;
    expect(oct.facturees.lignes).toHaveLength(0);
    expect(oct.report.enAttenteAutofacture).toHaveLength(1);
    expect(oct.report.enAttenteAutofacture[0]!.motif).toBe("SIREN de l'apporteur");
    const nov = calcul([emise], [p], "2026-11", new Date("2026-12-02T08:00:00Z")).contenu;
    expect(nov.facturees.lignes).toHaveLength(1);
    expect(nov.report.enAttenteAutofacture).toHaveLength(0);
  });

  it("exclut l'annulée et la ligne qui porte un avoir", () => {
    const { contenu } = calcul(
      [
        commission({ id: "a", statut: "annulee" }),
        commission({ id: "b", avoirNumero: "AXI-APP-2026-0009", statut: "reprise" }),
      ],
      [piece()],
    );
    expect(contenu.facturees.lignes).toHaveLength(0);
  });

  it("parrainage : libellé fixe, aucune trace de la commande du filleul", () => {
    const { contenu } = calcul(
      [commission({ parrainage: true, regleAppliquee: "parrainage_10" })],
      [piece()],
    );
    const l = contenu.facturees.lignes[0]!;
    expect(l.prestation).toBe(LIBELLE_PARRAINAGE);
    expect(l.entreprise).toBeNull();
    expect(l.factureClient).toBeNull();
    expect(l.baseHtCents).toBeNull();
    expect(l.prixPublicHtCents).toBeNull();
    expect(l.regle?.code).toBe("parrainage_10");
  });

  it("sans pièce : anomalie, pas d'invention de TVA", () => {
    const { contenu, anomalies } = calcul([commission()], []);
    expect(anomalies.map((a) => a.code)).toContain("piece_manquante");
    expect(contenu.totaux.tvaCents).toBe(0);
  });

  it("pièce reprise à la migration (totaux inconnus) : anomalie", () => {
    const { anomalies } = calcul(
      [commission()],
      [piece({ totalHtCents: null, totalTvaCents: null, totalTtcCents: null })],
    );
    expect(anomalies.map((a) => a.code)).toContain("piece_sans_totaux");
  });

  it("sort de façon déterministe : l'ordre de l'entrée n'y change rien", () => {
    const cs = [
      commission({
        id: "1",
        entreprise: "B",
        autofactureEmiseAt: new Date("2026-10-20T10:00:00Z"),
      }),
      commission({
        id: "2",
        entreprise: "A",
        autofactureEmiseAt: new Date("2026-10-20T10:00:00Z"),
      }),
      commission({
        id: "3",
        entreprise: "C",
        autofactureEmiseAt: new Date("2026-10-02T10:00:00Z"),
      }),
    ];
    const ps = [piece()];
    const a = calcul(cs, ps).contenu;
    const b = calcul([...cs].reverse(), ps).contenu;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.facturees.lignes[0]!.dateEmission).toBe("2026-10-02");
  });
});

describe("règle LUE, jamais recalculée", () => {
  const regle = (code: string | null, over: Partial<CommissionLue> = {}) =>
    calcul([commission({ regleAppliquee: code, ...over })], [piece()]);

  it("affiche le libellé de la liste fermée", () => {
    expect(regle("prorata_remise").contenu.facturees.lignes[0]!.regle).toEqual({
      code: "prorata_remise",
      libelle: "Forfait au prorata du prix facturé (art. 4.1 bis)",
    });
    expect(regle("plafond_base").contenu.facturees.lignes[0]!.regle?.libelle).toBe(
      "Base plafonnée au total HT hors récurrent",
    );
    expect(regle("journee_ia").contenu.facturees.lignes[0]!.regle?.libelle).toBe(
      "Forfait Journée IA",
    );
  });

  it("taux_ht : le pourcentage se lit sur la ligne quand il est exact", () => {
    const r = regle("taux_ht", { montantCents: 15_000, factureHtCents: 100_000 });
    expect(r.contenu.facturees.lignes[0]!.regle?.libelle).toBe("15 % du HT facturé");
  });

  it("forfait_palier : le libellé reprend la prestation", () => {
    const r = regle("forfait_palier", { activite: "audit" });
    expect(r.contenu.facturees.lignes[0]!.regle?.libelle).toBe("Forfait du palier Audit");
  });

  it("règle absente : renvoi au décompte de l'autofacture, rien n'est recalculé", () => {
    const l = regle(null).contenu.facturees.lignes[0]!;
    expect(l.regle).toBeNull();
    expect(l.renvoiDecompte).toBe("AXI-APP-2026-0001");
  });

  it("formation_3j_plus n'est JAMAIS affichée (Q7)", () => {
    const r = regle("formation_3j_plus");
    const l = r.contenu.facturees.lignes[0]!;
    expect(l.regle).toBeNull();
    expect(l.renvoiDecompte).toBe("AXI-APP-2026-0001");
    expect(JSON.stringify(r.contenu)).not.toContain("formation_3j_plus");
    expect(JSON.stringify(r.contenu)).not.toContain("3 jours");
  });

  it("code inconnu : traité comme absent, avec anomalie", () => {
    const r = regle("regle_inventee");
    expect(r.contenu.facturees.lignes[0]!.regle).toBeNull();
    expect(r.anomalies.map((a) => a.code)).toContain("regle_inconnue");
  });

  it("version du contrat : affichée telle que stockée, rien si absente", () => {
    expect(
      regle("forfait_palier", { versionContrat: "2.6" }).contenu.facturees.lignes[0]!
        .versionContrat,
    ).toBe("Contrat v2.6");
    expect(
      regle("forfait_palier", { versionContrat: null }).contenu.facturees.lignes[0]!.versionContrat,
    ).toBeNull();
  });
});

describe("B : avoirs émis dans le mois (avoir négatif)", () => {
  const reprise = (over: Partial<CommissionLue> = {}) =>
    commission({
      id: "r",
      statut: "reprise",
      montantCents: -2_000,
      avoirNumero: "AXI-APP-2026-0002",
      autofactureNumero: "AXI-APP-2026-0001",
      autofactureEmiseAt: null,
      ...over,
    });
  const avoir = (over: Partial<PieceLue> = {}) =>
    piece({
      numero: "AXI-APP-2026-0002",
      genre: "avoir",
      totalHtCents: 2_000,
      totalTvaCents: 400,
      totalTtcCents: 2_400,
      factureRectifiee: "AXI-APP-2026-0001",
      emiseAt: new Date("2026-10-20T10:00:00Z"),
      ...over,
    });

  it("un mois d'avoir seul : net négatif, montants en négatif", () => {
    const { contenu } = calcul([reprise()], [avoir()]);
    expect(contenu.aucunMouvement).toBe(false);
    expect(contenu.avoirs.lignes).toHaveLength(1);
    expect(contenu.avoirs.lignes[0]!.montantHtCents).toBe(-2_000);
    expect(contenu.avoirs.lignes[0]!.renvoiDecompte).toBeNull();
    expect(contenu.avoirs.pieces[0]).toMatchObject({
      numero: "AXI-APP-2026-0002",
      htCents: -2_000,
      tvaCents: -400,
      ttcCents: -2_400,
      renvoiFacture: "AXI-APP-2026-0001",
    });
    expect(contenu.totaux.factureHtCents).toBe(0);
    expect(contenu.totaux.avoirHtCents).toBe(2_000);
    expect(contenu.totaux.netHtCents).toBe(-2_000);
    expect(contenu.totaux.tvaCents).toBe(-400);
    expect(contenu.totaux.ttcCents).toBe(-2_400);
  });

  it("le signe stocké de la pièce n'y change rien (positif ou négatif)", () => {
    const neg = calcul(
      [reprise()],
      [avoir({ totalHtCents: -2_000, totalTvaCents: -400, totalTtcCents: -2_400 })],
    ).contenu;
    const pos = calcul([reprise()], [avoir()]).contenu;
    expect(JSON.stringify(neg)).toBe(JSON.stringify(pos));
  });

  it("avoir émis dans un autre mois : absent de B", () => {
    const { contenu } = calcul([reprise()], [avoir({ emiseAt: new Date("2026-09-20T10:00:00Z") })]);
    expect(contenu.avoirs.lignes).toHaveLength(0);
  });

  it("avoir sans pièce : anomalie, non daté donc non repris", () => {
    const { contenu, anomalies } = calcul([reprise()], []);
    expect(contenu.avoirs.lignes).toHaveLength(0);
    expect(anomalies.map((a) => a.code)).toContain("avoir_sans_piece");
  });

  it("facturé et avoir le même mois : net = facturé moins avoir", () => {
    const { contenu } = calcul([commission(), reprise()], [piece(), avoir()]);
    expect(contenu.totaux.netHtCents).toBe(8_000);
    expect(contenu.totaux.ttcCents).toBe(12_000 - 2_400);
  });
});

describe("C : virements du mois", () => {
  it("autofacture réglée en octobre : TTC de la pièce", () => {
    const { contenu } = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-10-20T10:00:00Z") })],
      [piece()],
    );
    expect(contenu.virements).toEqual([
      {
        reference: "AXI-APP-2026-0001",
        verseLe: "2026-10-20",
        montantTtcCents: 12_000,
        compensation: false,
      },
    ]);
    expect(contenu.totaux.vireTtcCents).toBe(12_000);
    expect(contenu.sousTotaux.versees).toEqual({ nb: 1, htCents: 10_000 });
    expect(contenu.facturees.lignes[0]!.statut).toEqual({ code: "versee", verseeLe: "2026-10-20" });
  });

  it("virement d'un autre mois : pas de ligne en C", () => {
    const sep = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-09-30T10:00:00Z") })],
      [piece()],
    ).contenu;
    expect(sep.virements).toEqual([]);
  });

  it("avoir imputé : TTC de l'autofacture moins TTC de l'avoir", () => {
    const { contenu } = calcul(
      [
        commission({ statut: "versee", verseeAt: new Date("2026-10-25T10:00:00Z") }),
        commission({
          id: "r",
          statut: "reprise",
          montantCents: -2_000,
          avoirNumero: "AXI-APP-2026-0002",
          autofactureEmiseAt: null,
        }),
      ],
      [
        piece(),
        piece({
          numero: "AXI-APP-2026-0002",
          genre: "avoir",
          totalHtCents: 2_000,
          totalTvaCents: 400,
          totalTtcCents: 2_400,
          factureRectifiee: "AXI-APP-2026-0001",
          emiseAt: new Date("2026-10-20T10:00:00Z"),
        }),
      ],
    );
    expect(contenu.virements[0]!.montantTtcCents).toBe(9_600);
    expect(contenu.totaux.vireTtcCents).toBe(9_600);
  });

  it("net nul : « réglé par compensation »", () => {
    const { contenu } = calcul(
      [
        commission({ statut: "versee", verseeAt: new Date("2026-10-25T10:00:00Z") }),
        commission({
          id: "r",
          statut: "reprise",
          montantCents: -10_000,
          avoirNumero: "AXI-APP-2026-0002",
          autofactureEmiseAt: null,
        }),
      ],
      [
        piece(),
        piece({
          numero: "AXI-APP-2026-0002",
          genre: "avoir",
          totalHtCents: 10_000,
          totalTvaCents: 2_000,
          totalTtcCents: 12_000,
          factureRectifiee: "AXI-APP-2026-0001",
          emiseAt: new Date("2026-10-20T10:00:00Z"),
        }),
      ],
    );
    expect(contenu.virements[0]).toMatchObject({ montantTtcCents: 0, compensation: true });
  });

  it("versement partiel (ligne suspendue) : la part virée est calculée par complément", () => {
    const { contenu } = calcul(
      [
        commission({
          id: "a",
          montantCents: 10_000,
          statut: "versee",
          verseeAt: new Date("2026-10-25T10:00:00Z"),
        }),
        commission({
          id: "b",
          montantCents: 5_000,
          statut: "due",
          litigeDepuis: new Date("2026-10-18T10:00:00Z"),
        }),
      ],
      [piece({ totalHtCents: 15_000, totalTvaCents: 3_000, totalTtcCents: 18_000 })],
    );
    expect(contenu.virements[0]!.montantTtcCents).toBe(12_000);
  });

  it("un virement daté APRÈS la coupure ne change pas le relevé (reproductible)", () => {
    const avant = calcul([commission({ verseeAt: null })], [piece()]).contenu;
    const apres = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-11-02T10:00:00Z") })],
      [piece()],
    ).contenu;
    expect(JSON.stringify(apres)).toBe(JSON.stringify(avant));
    expect(empreinteContenu(apres)).toBe(empreinteContenu(avant));
    expect(apres.virements).toEqual([]);
    expect(apres.report.facturesNonVirees).toHaveLength(1);
  });

  it("virement à 23 h 30 Paris le dernier jour : dans le mois ; 00 h 30 le lendemain : dans le suivant", () => {
    const dedans = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-10-31T22:30:00Z") })],
      [piece()],
    ).contenu;
    expect(dedans.virements).toHaveLength(1);
    const dehors = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-10-31T23:30:00Z") })],
      [piece()],
    ).contenu;
    expect(dehors.virements).toHaveLength(0);
  });
});

describe("D : report à la coupure", () => {
  it("D1 : facturé non viré, avec l'échéance", () => {
    const { contenu } = calcul([commission()], [piece()]);
    expect(contenu.report.facturesNonVirees).toEqual([
      {
        pieceNumero: "AXI-APP-2026-0001",
        emiseLe: "2026-10-15",
        echeanceLe: "2026-11-13",
        nbLignes: 1,
        htCents: 10_000,
      },
    ]);
  });

  it("D1 : une facture émise un mois plus tôt et non virée est toujours reportée", () => {
    const { contenu } = calcul(
      [
        commission({
          autofactureEmiseAt: new Date("2026-09-10T10:00:00Z"),
          encaissementIntegralAt: null,
        }),
      ],
      [piece({ emiseAt: new Date("2026-09-10T10:00:00Z") })],
    );
    expect(contenu.facturees.lignes).toHaveLength(0);
    expect(contenu.report.facturesNonVirees).toHaveLength(1);
  });

  it("D1 : une facture virée avant la coupure n'est plus reportée", () => {
    const { contenu } = calcul(
      [commission({ statut: "versee", verseeAt: new Date("2026-10-20T10:00:00Z") })],
      [piece()],
    );
    expect(contenu.report.facturesNonVirees).toEqual([]);
  });

  it("D2 : en attente d'autofacture à la coupure (motif et date)", () => {
    const { contenu } = calcul(
      [
        commission({
          autofactureNumero: null,
          autofactureEmiseAt: null,
          autofactureAttenteDepuis: new Date("2026-10-05T10:00:00Z"),
          autofactureAttenteMotif: "adresse de l'apporteur",
        }),
      ],
      [],
    );
    expect(contenu.report.enAttenteAutofacture).toEqual([
      {
        entreprise: "Société fictive",
        prestation: "Formation",
        montantHtCents: 10_000,
        motif: "adresse de l'apporteur",
        depuisLe: "2026-10-05",
      },
    ]);
  });

  it("D2 : une attente détectée après la coupure n'y figure pas", () => {
    const { contenu } = calcul(
      [
        commission({
          autofactureNumero: null,
          autofactureEmiseAt: null,
          autofactureAttenteDepuis: new Date("2026-11-01T10:00:00Z"),
          autofactureAttenteMotif: "SIREN de l'apporteur",
        }),
      ],
      [],
    );
    expect(contenu.report.enAttenteAutofacture).toEqual([]);
  });

  it("D3 indicatif : a_qualifier, vigilance et litige, figé au jour de la préparation", () => {
    const { contenu } = calcul(
      [
        commission({
          id: "q",
          autofactureNumero: null,
          autofactureEmiseAt: null,
          statut: "a_qualifier",
          montantCents: null,
        }),
        commission({
          id: "v",
          autofactureNumero: null,
          autofactureEmiseAt: null,
          statut: "en_attente_vigilance",
        }),
        commission({
          id: "l",
          autofactureNumero: null,
          autofactureEmiseAt: null,
          statut: "due",
          litigeDepuis: new Date("2026-10-10T10:00:00Z"),
        }),
      ],
      [],
    );
    expect(contenu.report.indicatif.auJour).toBe("2026-11-02");
    expect(contenu.report.indicatif.lignes.map((l) => l.statut).sort()).toEqual([
      "a_qualifier",
      "en_attente_vigilance",
      "litige",
    ]);
  });

  it("D3 : une ligne créée après la coupure n'y figure pas", () => {
    const { contenu } = calcul(
      [
        commission({
          autofactureNumero: null,
          autofactureEmiseAt: null,
          statut: "a_qualifier",
          creeAt: new Date("2026-11-01T10:00:00Z"),
        }),
      ],
      [],
    );
    expect(contenu.report.indicatif.lignes).toEqual([]);
  });

  it("D3 est EXCLU de l'empreinte de contrôle", () => {
    const base = commission({
      autofactureNumero: null,
      autofactureEmiseAt: null,
      statut: "a_qualifier",
    });
    const sans = calcul([], []).contenu;
    const avec = calcul([base], []).contenu;
    expect(empreinteControle(avec)).toBe(empreinteControle(sans));
    expect(empreinteContenu(avec)).not.toBe(empreinteContenu(sans));
  });
});

describe("E : cumul de l'année civile", () => {
  const janvier = commission({
    id: "jan",
    autofactureNumero: "AXI-APP-2026-0100",
    autofactureEmiseAt: new Date("2026-01-12T10:00:00Z"),
    montantCents: 50_000,
  });
  const pJanvier = piece({
    numero: "AXI-APP-2026-0100",
    totalHtCents: 50_000,
    totalTvaCents: 10_000,
    totalTtcCents: 60_000,
    emiseAt: new Date("2026-01-12T10:00:00Z"),
  });
  const septAvoir = commission({
    id: "sep",
    statut: "reprise",
    montantCents: -2_000,
    avoirNumero: "AXI-APP-2026-0050",
    autofactureNumero: "AXI-APP-2026-0100",
    autofactureEmiseAt: null,
  });
  const pAvoir = piece({
    numero: "AXI-APP-2026-0050",
    genre: "avoir",
    totalHtCents: 2_000,
    totalTvaCents: 400,
    totalTtcCents: 2_400,
    factureRectifiee: "AXI-APP-2026-0100",
    emiseAt: new Date("2026-09-15T10:00:00Z"),
  });

  it("somme des mois de l'année jusqu'à la coupure, calculée directement", () => {
    const { contenu } = calcul([janvier, commission(), septAvoir], [pJanvier, piece(), pAvoir]);
    expect(contenu.cumulAnnee).toMatchObject({
      annee: 2026,
      factureHtCents: 60_000,
      avoirHtCents: 2_000,
      netHtCents: 58_000,
      netTtcCents: 60_000 + 12_000 - 2_400,
    });
  });

  it("un virement de l'année entre dans le cumul viré", () => {
    const { contenu } = calcul(
      [{ ...janvier, statut: "versee", verseeAt: new Date("2026-02-03T10:00:00Z") }, commission()],
      [pJanvier, piece()],
    );
    expect(contenu.cumulAnnee.vireTtcCents).toBe(60_000);
  });

  it("changement d'année : le cumul de janvier N+1 repart de zéro", () => {
    const decembre = commission({
      id: "dec",
      autofactureNumero: "AXI-APP-2026-0200",
      autofactureEmiseAt: new Date("2026-12-10T10:00:00Z"),
    });
    const pDec = piece({ numero: "AXI-APP-2026-0200", emiseAt: new Date("2026-12-10T10:00:00Z") });
    const janN1 = commission({
      id: "jan27",
      autofactureNumero: "AXI-APP-2027-0001",
      autofactureEmiseAt: new Date("2027-01-12T10:00:00Z"),
      montantCents: 7_000,
    });
    const pJanN1 = piece({
      numero: "AXI-APP-2027-0001",
      totalHtCents: 7_000,
      totalTvaCents: 1_400,
      totalTtcCents: 8_400,
      emiseAt: new Date("2027-01-12T10:00:00Z"),
    });
    const dec = calcul(
      [decembre, janN1],
      [pDec, pJanN1],
      "2026-12",
      new Date("2027-01-05T08:00:00Z"),
    ).contenu;
    expect(dec.cumulAnnee).toMatchObject({ annee: 2026, netHtCents: 10_000 });
    const jan = calcul(
      [decembre, janN1],
      [pDec, pJanN1],
      "2027-01",
      new Date("2027-02-03T08:00:00Z"),
    ).contenu;
    expect(jan.cumulAnnee).toMatchObject({ annee: 2027, netHtCents: 7_000, factureHtCents: 7_000 });
  });

  it("les événements postérieurs à la coupure n'entrent pas dans le cumul", () => {
    const { contenu } = calcul(
      [{ ...janvier, statut: "versee", verseeAt: new Date("2026-11-10T10:00:00Z") }],
      [pJanvier],
    );
    expect(contenu.cumulAnnee.vireTtcCents).toBe(0);
  });
});

describe("centimes entiers, arrondi au plus proche", () => {
  it("arrondiAuCentime : au plus proche, la moitié s'éloigne de zéro", () => {
    expect(arrondiAuCentime(1_000.4)).toBe(1_000);
    expect(arrondiAuCentime(1_000.5)).toBe(1_001);
    expect(arrondiAuCentime(-1_000.5)).toBe(-1_001);
    expect(arrondiAuCentime(-1_000.4)).toBe(-1_000);
    expect(arrondiAuCentime(7)).toBe(7);
    expect(Object.is(arrondiAuCentime(-0.2), 0)).toBe(true);
  });

  it("un montant non entier en entrée est arrondi et signalé, le contenu reste entier", () => {
    const { contenu, anomalies } = calcul([commission({ montantCents: 1_000.5 })], [piece()]);
    expect(contenu.facturees.lignes[0]!.montantHtCents).toBe(1_001);
    expect(anomalies.map((a) => a.code)).toContain("montant_non_entier");
    expect(() => empreinteContenu(contenu)).not.toThrow();
  });
});

describe("totauxDenormalises", () => {
  it("recopie les totaux du contenu pour les statistiques", () => {
    const { contenu } = calcul(
      [
        commission({ statut: "versee", verseeAt: new Date("2026-10-20T10:00:00Z") }),
        commission({
          id: "2",
          autofactureNumero: null,
          autofactureEmiseAt: null,
          autofactureAttenteDepuis: new Date("2026-10-02T10:00:00Z"),
          montantCents: 3_000,
        }),
      ],
      [piece()],
    );
    expect(totauxDenormalises(contenu)).toEqual({
      nbLignes: 1,
      facturesHtCents: 10_000,
      avoirsHtCents: 0,
      viresTtcCents: 12_000,
      enAttenteHtCents: 3_000,
      cumulAnneeHtCents: 10_000,
    });
  });
});
