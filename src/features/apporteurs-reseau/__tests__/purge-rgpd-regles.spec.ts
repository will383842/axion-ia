// PR N (#2464 point 6) : les échéances de la purge RGPD, aux bornes.
import { describe, expect, it } from "vitest";

import {
  DUREE_CONTRAT_TERMINE_ANS,
  DUREE_INACTIF_MOIS,
  DUREE_PIECE_RETRANSMISE_MOIS,
  DUREE_REFUSE_MOIS,
  echeancePiece,
  echeancePurge,
  type DossierPurge,
} from "../purge-rgpd-regles";

const base: DossierPurge = {
  statut: "resilie",
  refuseAt: null,
  resilieAt: new Date("2020-03-31T10:00:00Z"),
  majAt: new Date("2020-03-31T10:00:00Z"),
  signeParSocieteAt: new Date("2019-01-01T00:00:00Z"),
  dernierVirementAt: null,
  dernierePieceAutofactureAt: null,
  argentEnJeu: false,
  litigeOuvert: false,
  changementCompteEnCours: false,
};

describe("durées retenues (à confirmer par Will)", () => {
  it("reprend les durées du plan", () => {
    expect(DUREE_CONTRAT_TERMINE_ANS).toBe(5);
    expect(DUREE_REFUSE_MOIS).toBe(6);
    expect(DUREE_INACTIF_MOIS).toBe(24);
    expect(DUREE_PIECE_RETRANSMISE_MOIS).toBe(6);
  });
});

describe("contrat signé puis terminé : 5 ans après T0", () => {
  it("T0 = la date la plus tardive (résiliation, dernier virement, dernière pièce)", () => {
    const r = echeancePurge({
      ...base,
      dernierVirementAt: new Date("2021-06-10T00:00:00Z"),
      dernierePieceAutofactureAt: new Date("2022-01-15T00:00:00Z"),
    });
    expect(r?.regle).toBe("contrat_termine_5ans");
    expect(r?.echeanceAt.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });
  it("sans virement ni pièce : la prise d'effet de la résiliation", () => {
    expect(echeancePurge(base)?.echeanceAt.toISOString()).toBe("2025-03-31T10:00:00.000Z");
  });
  it("résiliation sans date : jamais (dans le doute, on garde)", () => {
    expect(echeancePurge({ ...base, resilieAt: null })).toBeNull();
  });
  it("argent en jeu → null", () => {
    expect(echeancePurge({ ...base, argentEnJeu: true })).toBeNull();
  });
  it("litige ouvert → null", () => {
    expect(echeancePurge({ ...base, litigeOuvert: true })).toBeNull();
  });
  it("changement de compte en cours → null", () => {
    expect(echeancePurge({ ...base, changementCompteEnCours: true })).toBeNull();
  });
});

describe("dossier refusé : 6 mois après refuseAt", () => {
  const refuse: DossierPurge = {
    ...base,
    statut: "refuse",
    resilieAt: null,
    signeParSocieteAt: null,
    refuseAt: new Date("2026-01-31T00:00:00Z"),
  };
  it("échéance à 6 mois, fin de mois bornée", () => {
    const r = echeancePurge(refuse);
    expect(r?.regle).toBe("refuse_6mois");
    expect(r?.echeanceAt.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });
  it("sans date de refus : null", () => {
    expect(echeancePurge({ ...refuse, refuseAt: null })).toBeNull();
  });
  it("31 août + 6 mois ne déborde pas sur mars", () => {
    const r = echeancePurge({ ...refuse, refuseAt: new Date("2026-08-31T00:00:00Z") });
    expect(r?.echeanceAt.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("dossier jamais signé et inactif : 24 mois après majAt", () => {
  const inactif: DossierPurge = {
    ...base,
    statut: "dossier_en_cours",
    resilieAt: null,
    signeParSocieteAt: null,
    majAt: new Date("2024-11-28T00:00:00Z"),
  };
  it.each(["dossier_en_cours", "a_completer", "a_verifier"] as const)("%s", (statut) => {
    const r = echeancePurge({ ...inactif, statut });
    expect(r?.regle).toBe("inactif_24mois");
    expect(r?.echeanceAt.toISOString()).toBe("2026-11-28T00:00:00.000Z");
  });
  it("un dossier déjà contresigné n'est pas « jamais signé »", () => {
    expect(echeancePurge({ ...inactif, signeParSocieteAt: new Date("2025-01-01") })).toBeNull();
  });
});

describe("apporteur signé (actif) : jamais", () => {
  it("statut signe → null", () => {
    expect(echeancePurge({ ...base, statut: "signe" })).toBeNull();
  });
});

describe("pièce à retransmettre ou remplacée : 6 mois après le dépôt", () => {
  const dep = new Date("2026-01-10T00:00:00Z");
  it("à retransmettre", () => {
    const r = echeancePiece({
      type: "rib",
      statut: "a_retransmettre",
      remplaceeAt: null,
      deposeeAt: dep,
    });
    expect(r?.regle).toBe("piece_6mois");
    expect(r?.echeanceAt.toISOString()).toBe("2026-07-10T00:00:00.000Z");
  });
  it("remplacée : jamais (l'ancien RIB est la preuve du compte payé)", () => {
    expect(
      echeancePiece({
        type: "identite",
        statut: "deposee",
        remplaceeAt: new Date(),
        deposeeAt: dep,
      }),
    ).toBeNull();
    expect(
      echeancePiece({
        type: "rib",
        statut: "a_retransmettre",
        remplaceeAt: new Date(),
        deposeeAt: dep,
      }),
    ).toBeNull();
  });
  it("pièce courante : jamais", () => {
    expect(
      echeancePiece({ type: "rib", statut: "deposee", remplaceeAt: null, deposeeAt: dep }),
    ).toBeNull();
    expect(
      echeancePiece({ type: "rib", statut: "conforme", remplaceeAt: null, deposeeAt: dep }),
    ).toBeNull();
  });
  it("seulement identité et RIB (les pièces de vigilance ne sont pas concernées)", () => {
    expect(
      echeancePiece({
        type: "vigilance",
        statut: "a_retransmettre",
        remplaceeAt: null,
        deposeeAt: dep,
      }),
    ).toBeNull();
  });
});
