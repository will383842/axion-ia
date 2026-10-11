/**
 * Lot L13 — pièces à renouveler (S6 bis) : états affichés, blocage, F57,
 * calendrier J-30 / J-15 / J0 lu par le moteur commun des campagnes.
 */

import { describe, expect, it } from "vitest";

import { decisionCampagne } from "@/lib/relances/campagne";

import {
  REGLE_PIECE_A_RENOUVELER,
  REGLE_PIECE_REFUSEE,
  blocageLeve,
  clePiece,
  demandeUnGeste,
  dossierBloque,
  etatCampagnePiece,
  etatPiece,
  libelleEtatPiece,
  type FaitsPersonne,
  type PieceLue,
} from "../pieces-a-renouveler";

const J = 24 * 60 * 60 * 1000;
const MAINTENANT = new Date("2026-10-12T08:00:00Z"); // lundi, 10 h à Paris

let n = 0;
const piece = (o: Partial<PieceLue>): PieceLue => ({
  id: `p${++n}`,
  type: "attestation_vigilance_urssaf",
  statutValidation: "valide",
  fichierUrl: "r2://x",
  dateEmission: null,
  dateExpiration: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  archiveAt: null,
  rejetMotif: null,
  valideAt: null,
  ...o,
});
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * J);
const dans = (jours: number) => new Date(MAINTENANT.getTime() + jours * J);

const FAITS: FaitsPersonne = {
  efface: false,
  opposition: false,
  adresseMorte: false,
  close: false,
  derniereReponseHumaine: null,
  derniereRelancePersonne: null,
};

describe("etatPiece — attestation de vigilance (6 mois, règle de conformité)", () => {
  it("émise il y a 2 mois : valable jusqu'à l'émission + 6 mois", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(60) })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("valable");
    expect(libelleEtatPiece(e)).toMatch(/^Valable jusqu'au /);
  });

  it("à moins de 30 jours de l'échéance : à renouveler", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(170) })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("a_renouveler");
    expect(libelleEtatPiece(e)).toMatch(/^À renouveler avant le /);
  });

  it("au-delà de 6 mois : échue", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(200) })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("echue");
    expect(demandeUnGeste(e)).toBe(true);
  });

  it("une pièce déposée en attente SUSPEND : « Reçue, en vérification »", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(200) }), piece({ statutValidation: "en_attente" })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(libelleEtatPiece(e)).toBe("Reçue, en vérification");
    expect(demandeUnGeste(e)).toBe(false);
  });

  it("refusée sans autre pièce valable : à renvoyer avec le motif", () => {
    const e = etatPiece(
      [piece({ statutValidation: "rejete", rejetMotif: "illisible" })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(libelleEtatPiece(e)).toBe("À renvoyer : illisible");
  });

  it("une date saisie plus lointaine ne prolonge jamais l'attestation (garde S1)", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(200), dateExpiration: dans(365) })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("echue");
  });

  it("une pièce archivée par la marque du lot S1 n'est pas « à renvoyer »", () => {
    const e = etatPiece(
      [piece({ statutValidation: "rejete", rejetMotif: "[archivée] remplacée" })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("absente");
  });

  it("une pièce archivée (remplacée) est ignorée", () => {
    const e = etatPiece(
      [piece({ dateEmission: ilYa(10), archiveAt: ilYa(1) })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e.etat).toBe("absente");
    expect(libelleEtatPiece(e)).toBe("À fournir");
  });
});

describe("etatPiece — autres pièces", () => {
  it("RC pro : lue sur sa date d'expiration", () => {
    expect(
      etatPiece(
        [piece({ type: "assurance_rc_pro", dateExpiration: dans(10) })],
        "assurance_rc_pro",
        MAINTENANT,
      ).etat,
    ).toBe("a_renouveler");
  });
  it("une pièce sans échéance reste valable", () => {
    expect(
      etatPiece([piece({ type: "assurance_rc_pro" })], "assurance_rc_pro", MAINTENANT),
    ).toEqual({
      etat: "valable",
      echeance: null,
      depotEnAttente: false,
    });
  });
});

describe("dossierBloque et F57", () => {
  it("seule la vigilance bloque ; la RC pro échue ne bloque jamais", () => {
    const ok = piece({ dateEmission: ilYa(10) });
    const rcEchue = piece({ type: "assurance_rc_pro", dateExpiration: ilYa(1) });
    expect(dossierBloque([ok, rcEchue], MAINTENANT)).toBe(false);
    expect(dossierBloque([piece({ dateEmission: ilYa(200) })], MAINTENANT)).toBe(true);
  });
  it("le blocage se lève une seule fois par épisode", () => {
    expect(blocageLeve(true, false)).toBe(true);
    expect(blocageLeve(false, false)).toBe(false);
    expect(blocageLeve(true, true)).toBe(false);
  });
});

describe("séquence S6 bis par le moteur commun", () => {
  const docs = [piece({ dateEmission: ilYa(170) })]; // échéance dans ~12 jours
  const e = etatPiece(docs, "attestation_vigilance_urssaf", MAINTENANT);

  it("première relance (J-30) due ; la suivante attend J-15", () => {
    const c = etatCampagnePiece(e, FAITS, [], MAINTENANT)!;
    expect(c.regle).toBe("a_renouveler");
    const d1 = decisionCampagne({
      etat: c.etat,
      maintenant: MAINTENANT,
      regle: REGLE_PIECE_A_RENOUVELER,
    });
    expect(d1).toMatchObject({ envoyer: true, etape: "j30" });
    const c2 = etatCampagnePiece(e, FAITS, [MAINTENANT], MAINTENANT)!;
    const d2 = decisionCampagne({
      etat: c2.etat,
      maintenant: MAINTENANT,
      regle: REGLE_PIECE_A_RENOUVELER,
    });
    expect(d2).toMatchObject({ envoyer: false, motif: "pas-encore" });
  });

  it("au plus 3 rappels, puis plus rien", () => {
    const c = etatCampagnePiece(e, FAITS, [ilYa(20), ilYa(10), ilYa(2)], MAINTENANT)!;
    expect(
      decisionCampagne({ etat: c.etat, maintenant: MAINTENANT, regle: REGLE_PIECE_A_RENOUVELER }),
    ).toMatchObject({
      envoyer: false,
      motif: "plafond",
    });
  });

  it("réponse humaine il y a moins de 72 h : pause ; fin de collaboration : arrêt", () => {
    const pause = etatCampagnePiece(
      e,
      { ...FAITS, derniereReponseHumaine: ilYa(1) },
      [],
      MAINTENANT,
    )!;
    expect(
      decisionCampagne({
        etat: pause.etat,
        maintenant: MAINTENANT,
        regle: REGLE_PIECE_A_RENOUVELER,
      }).envoyer,
    ).toBe(false);
    const reprise = etatCampagnePiece(
      e,
      { ...FAITS, derniereReponseHumaine: ilYa(4) },
      [],
      MAINTENANT,
    )!;
    expect(
      decisionCampagne({
        etat: reprise.etat,
        maintenant: MAINTENANT,
        regle: REGLE_PIECE_A_RENOUVELER,
      }).envoyer,
    ).toBe(true);
    const fin = etatCampagnePiece(e, { ...FAITS, close: true }, [], MAINTENANT)!;
    expect(
      decisionCampagne({ etat: fin.etat, maintenant: MAINTENANT, regle: REGLE_PIECE_A_RENOUVELER }),
    ).toMatchObject({
      motif: "close",
    });
  });

  it("pièce en vérification ou valable loin de l'échéance : aucune campagne", () => {
    expect(etatCampagnePiece({ etat: "en_verification" }, FAITS, [], MAINTENANT)).toBeNull();
    expect(
      etatCampagnePiece(
        { etat: "valable", echeance: dans(90), depotEnAttente: false },
        FAITS,
        [],
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("refusée : un seul rappel, à J+7 du refus", () => {
    const refus = [
      piece({ statutValidation: "rejete", valideAt: ilYa(8), rejetMotif: "illisible" }),
    ];
    const er = etatPiece(refus, "attestation_vigilance_urssaf", MAINTENANT);
    const c = etatCampagnePiece(er, FAITS, [], MAINTENANT)!;
    expect(c.regle).toBe("refusee");
    expect(
      decisionCampagne({ etat: c.etat, maintenant: MAINTENANT, regle: REGLE_PIECE_REFUSEE }),
    ).toMatchObject({
      envoyer: true,
      etape: "j7",
    });
  });

  it("la clé d'envoi ne porte ni adresse ni « : »", () => {
    expect(clePiece("t", "cv", "piece-1", "j7")).toBe("fi-piece-j7-t-cv-piece-1");
    const k = clePiece(
      "00000000-0000-4000-8000-000000000001",
      "assurance_rc_pro",
      new Date("2026-11-01T00:00:00Z"),
      "j15",
    );
    expect(k).toBe("fi-piece-j15-00000000-0000-4000-8000-000000000001-assurance_rc_pro-20261101");
    expect(k).not.toMatch(/[:@]/);
  });
});

describe("cas relevés en relecture", () => {
  it("valide + nouvelle pièce déposée par anticipation : pas de blocage, rappels suspendus", () => {
    const docs = [piece({ dateEmission: ilYa(170) }), piece({ statutValidation: "en_attente" })];
    const e = etatPiece(docs, "attestation_vigilance_urssaf", MAINTENANT);
    expect(e).toMatchObject({ etat: "a_renouveler", depotEnAttente: true });
    expect(demandeUnGeste(e)).toBe(false);
    expect(dossierBloque(docs, MAINTENANT)).toBe(false);
    const c = etatCampagnePiece(e, FAITS, [], MAINTENANT)!;
    expect(
      decisionCampagne({ etat: c.etat, maintenant: MAINTENANT, regle: REGLE_PIECE_A_RENOUVELER }),
    ).toMatchObject({
      envoyer: false,
      motif: "action-faite",
    });
  });

  it("échue + nouvelle pièce en attente : « reçue, en vérification », toujours bloquant", () => {
    const docs = [piece({ dateEmission: ilYa(200) }), piece({ statutValidation: "en_attente" })];
    expect(etatPiece(docs, "attestation_vigilance_urssaf", MAINTENANT).etat).toBe(
      "en_verification",
    );
    expect(dossierBloque(docs, MAINTENANT)).toBe(true);
  });

  it("émission dans le futur : jamais retenue (même règle que la garde S1)", () => {
    const docs = [piece({ dateEmission: dans(200) }), piece({ dateEmission: ilYa(200) })];
    expect(etatPiece(docs, "attestation_vigilance_urssaf", MAINTENANT).etat).toBe("echue");
    expect(
      etatPiece([piece({ dateEmission: dans(200) })], "attestation_vigilance_urssaf", MAINTENANT)
        .etat,
    ).toBe("absente");
  });

  it("plusieurs pièces valides : la plus récente fixe l'échéance", () => {
    const docs = [piece({ dateEmission: ilYa(200) }), piece({ dateEmission: ilYa(20) })];
    expect(etatPiece(docs, "attestation_vigilance_urssaf", MAINTENANT).etat).toBe("valable");
  });

  it("date d'émission absente : à renvoyer avec le motif, jamais « échue en 1970 »", () => {
    const e = etatPiece(
      [piece({ dateEmission: null })],
      "attestation_vigilance_urssaf",
      MAINTENANT,
    );
    expect(e).toMatchObject({ etat: "a_renvoyer", motif: "la date d'émission manque" });
    expect(libelleEtatPiece(e)).not.toMatch(/1970/);
  });

  it("un CV validé sans fichier n'est pas « valable » (I21-02)", () => {
    const e = etatPiece(
      [piece({ type: "cv", fichierUrl: null, dateEmission: ilYa(10) })],
      "cv",
      MAINTENANT,
    );
    expect(e.etat).toBe("absente");
  });

  it("deux refus successifs : deux rappels distincts (clés différentes)", () => {
    const r1 = piece({
      type: "cv",
      statutValidation: "rejete",
      valideAt: ilYa(30),
      createdAt: ilYa(31),
      rejetMotif: "a",
    });
    const r2 = piece({
      type: "cv",
      statutValidation: "rejete",
      valideAt: ilYa(8),
      createdAt: ilYa(9),
      rejetMotif: "b",
    });
    const e1 = etatPiece([r1], "cv", MAINTENANT);
    const e2 = etatPiece([r1, r2], "cv", MAINTENANT);
    const k1 = clePiece("t", "cv", etatCampagnePiece(e1, FAITS, [], MAINTENANT)!.repere, "j7");
    const k2 = clePiece("t", "cv", etatCampagnePiece(e2, FAITS, [], MAINTENANT)!.repere, "j7");
    expect(k1).not.toBe(k2);
    expect(libelleEtatPiece(e2)).toBe("À renvoyer : b");
  });
});
