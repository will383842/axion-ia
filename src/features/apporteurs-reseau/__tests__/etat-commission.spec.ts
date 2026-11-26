import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  etatPrincipal,
  facettesCommission,
  PREFIXE_MOTIF_SOLDE_NEGATIF,
  type LigneEtat,
} from "../etat-commission";

const base: LigneEtat = {
  statut: "due",
  montantCents: 50_000,
  releveMois: null,
  autofactureNumero: null,
  autofactureAttenteMotif: null,
  litigeDepuis: null,
  activite: "implementation",
};
const etat = (o: Partial<LigneEtat>) => {
  const l = { ...base, ...o };
  return etatPrincipal(facettesCommission(l), l.montantCents);
};

describe("état d'une commission (lecture seule)", () => {
  it("due, pas encore facturée : « due », sans condition de prestation réalisée", () => {
    expect(etat({})).toBe("due");
  });
  it("facturée", () => expect(etat({ autofactureNumero: "AXI-APP-2026-0001" })).toBe("facturee"));
  it("contestation : avant tout autre état non versé", () => {
    const d = new Date();
    expect(etat({ litigeDepuis: d, autofactureNumero: "AXI-APP-2026-0001" })).toBe("suspendue");
    expect(etat({ litigeDepuis: d, statut: "a_qualifier" })).toBe("suspendue");
  });
  it("versée, et versée à zéro", () => {
    expect(etat({ statut: "versee" })).toBe("versee");
    expect(etat({ statut: "versee", montantCents: 0 })).toBe("sans_commission");
  });
  it("une ligne versée n'est pas « suspendue » même avec une ancienne contestation", () => {
    expect(etat({ statut: "versee", litigeDepuis: new Date() })).toBe("versee");
  });
  it("à qualifier, vigilance", () => {
    expect(etat({ statut: "a_qualifier", montantCents: null })).toBe("a_preciser");
    expect(etat({ statut: "en_attente_vigilance" })).toBe("en_attente_pieces");
  });
  it("attente d'information : solde négatif distingué", () => {
    expect(etat({ autofactureAttenteMotif: `${PREFIXE_MOTIF_SOLDE_NEGATIF} un avoir` })).toBe(
      "en_attente_fiche_solde_negatif",
    );
    expect(etat({ autofactureAttenteMotif: "SIREN de l'apporteur" })).toBe("en_attente_fiche");
  });
  it("reprises, annulée, retenue, neutralisation masquée", () => {
    expect(etat({ statut: "reprise" })).toBe("reprise_a_deduire");
    expect(etat({ statut: "reprise", releveMois: "2026-11" })).toBe("reprise_deduite");
    expect(etat({ statut: "reprise", activite: "neutralisation" })).toBe("masquee");
    expect(etat({ statut: "annulee" })).toBe("annulee");
    expect(etat({ statut: "retenue" })).toBe("retenue");
  });
  it("le préfixe du motif est celui de facturation.ts", () => {
    const src = readFileSync("src/features/apporteurs-reseau/facturation.ts", "utf8");
    expect(src).toContain(
      `PREFIXE_MOTIF_SOLDE_NEGATIF = ${JSON.stringify(PREFIXE_MOTIF_SOLDE_NEGATIF)}`,
    );
  });
  it("ne lit jamais prestationRealiseeAt (aucune condition de réalisation)", () => {
    const src = readFileSync("src/features/apporteurs-reseau/etat-commission.ts", "utf8");
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/prestationRealisee/);
  });
});
