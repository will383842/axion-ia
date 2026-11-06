import { describe, expect, it } from "vitest";

import {
  construireCommandeSignee,
  eventIdCommandeSignee,
  TYPE_COMMANDE_SIGNEE,
  type EntreeCommandeSignee,
} from "./commande-signee";
import { choixCanonique, prixMensuelNet, sha256Choix, sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";

const NUMERO = "AXI-DEV-2026-001";

function entree(over: Partial<EntreeCommandeSignee> = {}): EntreeCommandeSignee {
  const offre = offreFictive();
  offre.abonnement!.periodes = [
    { mois: 1, remiseBps: 0 },
    { mois: 6, remiseBps: 500 },
  ];
  offre.abonnement!.phases = [
    { rang: 1, libelle: "Acompte", pourcentage: 30, declencheur: "signature" },
    { rang: 2, libelle: "Solde", pourcentage: 70, declencheur: "livraison" },
  ];
  const offreSha256 = sha256Offre(offre);
  const choix = choixCanonique({
    devisNumero: NUMERO,
    offreSha256,
    formule: "abonnement",
    automatisationsRetenues: ["auto1"],
    maintenanceRetenue: false,
    periodiciteMois: 6,
  });
  return {
    numeroDevis: NUMERO,
    revision: null,
    offre,
    offreSha256,
    choix,
    choixOffreSha256: sha256Choix(choix),
    cgvVersion: "2026-10-04",
    versionSceau: 4,
    client: {
      numero: "AXI-CLI-000123",
      raisonSociale: "Boulangerie Martin",
      siren: "123456782",
      siret: null,
      adresse: "1 rue de la Paix, 38000 Ville",
    },
    signataire: { nom: "C. Martin", qualite: "gérante", signeAt: new Date("2026-11-20T10:12:00Z") },
    contresigneAt: new Date("2026-11-20T14:03:00Z"),
    ...over,
  };
}

describe("eventIdCommandeSignee", () => {
  it("est déterministe : même devis, même choix → même identifiant (idempotence)", () => {
    const a = eventIdCommandeSignee(NUMERO, "a".repeat(64));
    expect(a).toBe(eventIdCommandeSignee(NUMERO, "a".repeat(64)));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("change avec le choix et avec le devis", () => {
    const base = eventIdCommandeSignee(NUMERO, "a".repeat(64));
    expect(eventIdCommandeSignee(NUMERO, "b".repeat(64))).not.toBe(base);
    expect(eventIdCommandeSignee("AXI-DEV-2026-002", "a".repeat(64))).not.toBe(base);
  });
});

describe("construireCommandeSignee", () => {
  it("porte le type, l'identifiant, la formule retenue et les empreintes", () => {
    const e = entree();
    const { eventId, payload } = construireCommandeSignee(e);
    expect(eventId).toBe(eventIdCommandeSignee(NUMERO, e.choixOffreSha256));
    expect(payload["type"]).toBe(TYPE_COMMANDE_SIGNEE);
    expect(payload["formule"]).toBe("abonnement");
    expect(payload["numeroDevis"]).toBe(NUMERO);
    expect(payload["choixOffreSha256"]).toBe(e.choixOffreSha256);
    expect(payload["offreSha256"]).toBe(e.offreSha256);
    expect(payload["versionSceau"]).toBe(4);
    expect(payload["cgvVersion"]).toBe("2026-10-04");
  });

  it("prix mensuel net = arrondi(mensuel × (1 − remise)) pour la durée retenue", () => {
    const { payload } = construireCommandeSignee(entree());
    const abo = payload["abonnement"] as Record<string, unknown>;
    expect(abo["periodeMois"]).toBe(6);
    expect(abo["remiseBps"]).toBe(500);
    expect(abo["prixMensuelNetHtCentimes"]).toBe(prixMensuelNet(9000, 500));
    expect(abo["prixMensuelCatalogueHtCentimes"]).toBe(9000);
  });

  it("échéancier : la somme des phases vaut le total ponctuel au centime", () => {
    const { payload } = construireCommandeSignee(entree());
    const phases = payload["phases"] as { montantHtCentimes: number }[];
    const total = payload["totalPonctuelHtCentimes"] as number;
    expect(phases.reduce((s, p) => s + p.montantHtCentimes, 0)).toBe(total);
    // 30 000 (mise en service) + 5 000 (automatisation retenue).
    expect(total).toBe(35000);
  });

  it("n'inclut que les automatisations retenues comme retenues", () => {
    const offre = offreFictive();
    offre.automatisations.push({
      code: "auto2",
      libelle: "Deux",
      facultative: true,
      dependDe: [],
      prixHtCents: 100,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    });
    const offreSha256 = sha256Offre(offre);
    const choix = choixCanonique({
      devisNumero: NUMERO,
      offreSha256,
      formule: "abonnement",
      automatisationsRetenues: ["auto1"],
      maintenanceRetenue: false,
      periodiciteMois: 1,
    });
    const { payload } = construireCommandeSignee(
      entree({ offre, offreSha256, choix, choixOffreSha256: sha256Choix(choix) }),
    );
    const autos = payload["automatisations"] as { codeAutomatisation: string; retenue: boolean }[];
    expect(autos.map((a) => [a.codeAutomatisation, a.retenue])).toEqual([
      ["auto1", true],
      ["auto2", false],
    ]);
  });

  it("formule A : maintenance retenue, hébergement ; pas de bloc abonnement", () => {
    const offre = offreFictive();
    const offreSha256 = sha256Offre(offre);
    const choix = choixCanonique({
      devisNumero: NUMERO,
      offreSha256,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: 12,
    });
    const { payload } = construireCommandeSignee(
      entree({ offre, offreSha256, choix, choixOffreSha256: sha256Choix(choix) }),
    );
    expect(payload["formule"]).toBe("achat");
    expect(payload["abonnement"]).toBeNull();
    expect(payload["hebergement"]).toBe("client");
    expect(payload["maintenance"]).toMatchObject({
      regle: "facultative",
      retenue: true,
      periodeMois: 12,
      prixMensuelHtCentimes: 4000,
    });
  });

  it("🔴 ne contient ni jeton, ni adresse IP, ni empreinte de navigateur, ni mot « token »", () => {
    const { payload } = construireCommandeSignee(entree());
    const texte = JSON.stringify(payload);
    expect(texte).not.toMatch(/token|jeton|ipHash|userAgent|capital/i);
  });

  it("aucune clé indéfinie (le fait est canonicalisable)", () => {
    const { payload } = construireCommandeSignee(entree());
    expect(JSON.stringify(payload)).not.toContain("undefined");
    expect(Object.values(payload).includes(undefined as never)).toBe(false);
  });

  it("un choix qui ne correspond pas à l'offre est refusé (formule absente)", () => {
    const offre = offreFictive();
    delete offre.abonnement;
    offre.formulesProposees = ["achat"];
    const e = entree({ offre });
    expect(() => construireCommandeSignee(e)).toThrow();
  });
});
