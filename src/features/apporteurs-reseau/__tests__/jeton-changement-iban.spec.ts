import { describe, expect, it } from "vitest";

import {
  lienBloquerDemande,
  lienConfirmerDemande,
  signatureBloquerValide,
  signatureConfirmerValide,
} from "../jeton-changement-iban";
import { jetonDossier } from "../jeton";

const DEMANDE = "11111111-1111-4111-8111-111111111111";
const AUTRE_DEMANDE = "22222222-2222-4222-8222-222222222222";
const APPORTEUR = "33333333-3333-4333-8333-333333333333";
const AUTRE_APPORTEUR = "44444444-4444-4444-8444-444444444444";
const T0 = new Date("2026-11-27T10:00:00Z");

function signatureDe(lien: string | null): string {
  return (lien ?? "").split("/").pop() ?? "";
}

describe("liens signés du changement d'IBAN (domaine apporteur-compte)", () => {
  it("le lien vit hors du chemin à jeton et ne contient pas le lien personnel", () => {
    const l = lienConfirmerDemande(DEMANDE, APPORTEUR, T0)!;
    expect(l).toContain(`/apporteur/dossier/compte/${DEMANDE}/`);
    expect(l).not.toContain(APPORTEUR);
    const perso = jetonDossier(APPORTEUR, 1)!;
    expect(l).not.toContain(perso);
    expect(lienBloquerDemande(DEMANDE, APPORTEUR)!).not.toContain(perso);
  });

  it("confirmer : valable avant 24 h, expiré après", () => {
    const sig = signatureDe(lienConfirmerDemande(DEMANDE, APPORTEUR, T0));
    const avant = Math.floor((T0.getTime() + 24 * 3600_000 - 1000) / 1000);
    const apres = Math.floor((T0.getTime() + 24 * 3600_000 + 1000) / 1000);
    expect(signatureConfirmerValide(DEMANDE, APPORTEUR, sig, avant)).toBe(true);
    expect(signatureConfirmerValide(DEMANDE, APPORTEUR, sig, apres)).toBe(false);
  });

  it("une signature d'une autre demande, d'un autre apporteur ou d'une autre action est refusée", () => {
    const conf = signatureDe(lienConfirmerDemande(DEMANDE, APPORTEUR, T0));
    const bloc = signatureDe(lienBloquerDemande(DEMANDE, APPORTEUR));
    const maintenant = Math.floor(T0.getTime() / 1000);
    expect(signatureConfirmerValide(AUTRE_DEMANDE, APPORTEUR, conf, maintenant)).toBe(false);
    expect(signatureConfirmerValide(DEMANDE, AUTRE_APPORTEUR, conf, maintenant)).toBe(false);
    expect(signatureConfirmerValide(DEMANDE, APPORTEUR, bloc, maintenant)).toBe(false);
    expect(signatureBloquerValide(DEMANDE, APPORTEUR, conf)).toBe(false);
  });

  it("bloquer : sans échéance, valable longtemps après", () => {
    const sig = signatureDe(lienBloquerDemande(DEMANDE, APPORTEUR));
    expect(signatureBloquerValide(DEMANDE, APPORTEUR, sig)).toBe(true);
  });

  it("une signature mal formée ou vide est refusée", () => {
    expect(signatureBloquerValide(DEMANDE, APPORTEUR, "")).toBe(false);
    expect(signatureConfirmerValide(DEMANDE, APPORTEUR, "x.y", 0)).toBe(false);
  });
});
