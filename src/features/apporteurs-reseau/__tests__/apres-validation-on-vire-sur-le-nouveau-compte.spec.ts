// Lot 7 (plan §4.3) : le compte réellement payé. Après validation : le compte attendu est le NOUVEAU ;
// refusée : l'ANCIEN. Contrôle des quatre derniers caractères ; choix du compte pendant 10 jours ;
// aucun IBAN entier dans une valeur de retour.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  historique: [] as Array<Record<string, unknown>>,
  deja: 0,
  absente: false,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurIbanHistorique: {
      findMany: vi.fn(async () => {
        if (etat.absente) throw Object.assign(new Error("absente"), { code: "P2021" });
        return etat.historique;
      }),
    },
    apporteurVirementCompte: { count: vi.fn(async () => etat.deja) },
  },
}));

import { empreinteIban } from "@/lib/iban-empreinte";

import { lireComptesVirement, trancherCompte } from "../virement-compte";

const ANCIEN = "FR7630006000011234567890189"; // IBAN d'exemple public, jamais un vrai compte
const NOUVEAU = "FR1420041010050500013M02606"; // idem
const A = "11111111-1111-4111-8111-111111111111";
const maintenant = new Date("2026-12-10T10:00:00Z");
const J = 86_400_000;

beforeEach(() => {
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-de-test";
  etat.historique = [];
  etat.deja = 0;
  etat.absente = false;
});

const ligne = (iban: string, de: Date | null, jusqua: Date | null, origine: string) => ({
  ibanEmpreinte: empreinteIban(iban),
  ibanFin4: iban.slice(-4),
  enVigueurDe: de,
  enVigueurJusqua: jusqua,
  origine,
});

describe("quel compte virer", () => {
  it("sans historique : le compte de la fiche, pas de choix", async () => {
    const c = await lireComptesVirement(A, ANCIEN, maintenant);
    expect(c.actuel?.fin4).toBe("0189");
    expect(c.precedent).toBeNull();
    expect(c.choixExige).toBe(false);
  });

  it("validée il y a 2 jours : la fiche porte le NOUVEAU compte, l'ancien est proposé, le choix est exigé", async () => {
    const validee = new Date(maintenant.getTime() - 2 * J);
    etat.historique = [
      ligne(NOUVEAU, validee, null, "changement"),
      ligne(ANCIEN, null, validee, "dossier_initial"),
    ];
    const c = await lireComptesVirement(A, NOUVEAU, maintenant);
    expect(c.actuel?.fin4).toBe("2606");
    expect(c.precedent?.fin4).toBe("0189");
    expect(c.choixExige).toBe(true);
  });

  it("validée il y a 11 jours : plus de choix, seul le nouveau compte compte", async () => {
    const validee = new Date(maintenant.getTime() - 11 * J);
    etat.historique = [
      ligne(NOUVEAU, validee, null, "changement"),
      ligne(ANCIEN, null, validee, "dossier_initial"),
    ];
    const c = await lireComptesVirement(A, NOUVEAU, maintenant);
    expect(c.choixExige).toBe(false);
  });

  it("demande refusée : la fiche garde l'ancien compte, c'est lui qui est attendu", async () => {
    const c = await lireComptesVirement(A, ANCIEN, maintenant);
    expect(c.actuel?.fin4).toBe("0189");
  });

  it("table absente : comportement d'aujourd'hui (compte de la fiche, pas de choix)", async () => {
    etat.absente = true;
    const c = await lireComptesVirement(A, ANCIEN, maintenant);
    expect(c.actuel?.fin4).toBe("0189");
    expect(c.choixExige).toBe(false);
  });

  it("la valeur rendue ne contient jamais l'IBAN entier", async () => {
    const c = await lireComptesVirement(A, ANCIEN, maintenant);
    expect(JSON.stringify(c)).not.toContain(ANCIEN);
  });
});

describe("contrôle des quatre derniers caractères", () => {
  const comptes = {
    actuel: { fin4: "2606", empreinte: "a".repeat(64) },
    precedent: { fin4: "0189", empreinte: "b".repeat(64) },
    choixExige: true,
  };

  it("bon accepté, mauvais refusé", () => {
    const bon = trancherCompte(comptes, { fin4Lue: "2606", compte: "actuel" }, true);
    expect(bon).toMatchObject({ ok: true, compte: { fin4: "2606" } });
    const mauvais = trancherCompte(comptes, { fin4Lue: "0189", compte: "actuel" }, true);
    expect(mauvais).toEqual({
      ok: false,
      message: "Le RIB ouvert ne correspond pas au compte attendu.",
    });
  });

  it("insensible à la casse et aux espaces", () => {
    expect(trancherCompte({ ...comptes, choixExige: false }, { fin4Lue: " 26o6 " }, true).ok).toBe(
      false,
    );
    const c = {
      actuel: { fin4: "13M0", empreinte: "a".repeat(64) },
      precedent: null,
      choixExige: false,
    };
    expect(trancherCompte(c, { fin4Lue: " 13m0 " }, true).ok).toBe(true);
  });

  it("dans les 10 jours après validation : le choix du compte est exigé", () => {
    const r = trancherCompte(comptes, { fin4Lue: "2606" }, true);
    expect(r).toEqual({ ok: false, message: "Indiquez sur quel compte le virement est parti." });
  });

  it("virement parti sur l'ancien compte avant la validation : accepté avec le choix « précédent »", () => {
    const r = trancherCompte(comptes, { fin4Lue: "0189", compte: "precedent" }, true);
    expect(r).toMatchObject({ ok: true, compte: { fin4: "0189", empreinte: "b".repeat(64) } });
  });

  it("contrôle exigé et saisie absente ou mal formée : refus", () => {
    expect(trancherCompte({ ...comptes, choixExige: false }, {}, true).ok).toBe(false);
    expect(trancherCompte({ ...comptes, choixExige: false }, { fin4Lue: "26" }, true).ok).toBe(
      false,
    );
  });

  it("interrupteur éteint et aucune validation récente : comportement d'aujourd'hui, saisie facultative", () => {
    const c = {
      actuel: { fin4: "2606", empreinte: "a".repeat(64) },
      precedent: null,
      choixExige: false,
    };
    expect(trancherCompte(c, {}, false)).toMatchObject({ ok: true, compte: { fin4: "2606" } });
    // mais une saisie fournie et fausse est refusée
    expect(trancherCompte(c, { fin4Lue: "9999" }, false).ok).toBe(false);
  });

  it("fiche sans compte lisible, contrôle exigé : refus ; sinon pas de preuve mais pas de blocage", () => {
    const vide = { actuel: null, precedent: null, choixExige: false };
    expect(trancherCompte(vide, { fin4Lue: "2606" }, true).ok).toBe(false);
    expect(trancherCompte(vide, {}, false)).toEqual({ ok: true, compte: null });
  });
});
