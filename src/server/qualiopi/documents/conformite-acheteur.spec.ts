/**
 * Garde-fou de conformité ACHETEUR (art. L.441-9 C. com.).
 *
 * Le contrôle d'identité n'existait que d'un côté : l'organisme était protégé
 * contre sa propre identité incomplète, l'acheteur ne l'était pas. Or l'article
 * impose « le nom des parties ainsi que **leur** adresse ».
 *
 * Le cas qui compte vraiment ici est le DERNIER : la garde ne doit surtout pas
 * bloquer les destinataires dont l'identité vient d'un référentiel externe.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  champsAcheteurManquants,
  adresseAcheteurStructuree,
  assertAcheteurComplet,
  AcheteurIncompletError,
  type AcheteurFacture,
} from "./conformite";

/** Le seul client de production au 2026-08-04 : adresse libre, pas structurée. */
const INVEST_SUN: AcheteurFacture = {
  nom: "INVEST SUN",
  adresse: "12 rue de la Paix, 75002 Paris",
  adresseRue: null,
  adresseCodePostal: null,
  adresseVille: null,
};

describe("champsAcheteurManquants", () => {
  it("ne reproche rien à un client portant une adresse libre", () => {
    expect(champsAcheteurManquants(INVEST_SUN)).toEqual([]);
  });

  it("accepte l'adresse structurée à la place de l'adresse libre", () => {
    expect(
      champsAcheteurManquants({
        nom: "ACME",
        adresse: null,
        adresseRue: "1 avenue des Tests",
        adresseCodePostal: "38000",
        adresseVille: "Grenoble",
      }),
    ).toEqual([]);
  });

  it("nomme l'adresse manquante plutôt que de rendre un booléen", () => {
    const m = champsAcheteurManquants({ nom: "ACME", adresse: null });
    expect(m).toHaveLength(1);
    expect(m[0]).toContain("adresse");
  });

  it("nomme les deux champs quand la fiche est vide", () => {
    expect(champsAcheteurManquants({ nom: "  ", adresse: "" })).toHaveLength(2);
  });

  it("ne se laisse pas berner par des espaces", () => {
    expect(champsAcheteurManquants({ nom: "ACME", adresse: "   " })).toHaveLength(1);
  });
});

describe("adresseAcheteurStructuree — signalement e-invoicing, non bloquant", () => {
  it("est fausse pour le client de production (adresse libre uniquement)", () => {
    // C'est ce constat qui interdit de rendre la structuration bloquante
    // aujourd'hui : personne ne la porte encore.
    expect(adresseAcheteurStructuree(INVEST_SUN)).toBe(false);
    // …mais sa facture reste émissible.
    expect(champsAcheteurManquants(INVEST_SUN)).toEqual([]);
  });

  it("exige les trois composants (BG-8 EN 16931)", () => {
    const base = { nom: "ACME", adresse: null, adresseRue: "1 rue X", adresseVille: "Lyon" };
    expect(adresseAcheteurStructuree(base)).toBe(false);
    expect(adresseAcheteurStructuree({ ...base, adresseCodePostal: "69000" })).toBe(true);
  });
});

describe("assertAcheteurComplet", () => {
  it("laisse passer un acheteur complet", () => {
    expect(() => assertAcheteurComplet(INVEST_SUN, "entreprise")).not.toThrow();
  });

  it("refuse une entreprise sans adresse, en nommant le champ", () => {
    expect(() => assertAcheteurComplet({ nom: "ACME", adresse: null }, "entreprise")).toThrow(
      AcheteurIncompletError,
    );
    try {
      assertAcheteurComplet({ nom: "ACME", adresse: null }, "entreprise");
    } catch (e) {
      expect((e as Error).message).toContain("adresse du client");
      expect((e as Error).message).toContain("L.441-9");
    }
  });

  /**
   * 🔴 LE CAS QUI AURAIT TOUT CASSÉ.
   *
   * `resoudreDestinataireFacture` renvoie délibérément `adresse: null` pour
   * l'OPCO, France Travail et le bénéficiaire : leur identité vient d'un
   * référentiel externe et n'est « jamais inventée ». Une garde aveugle sur la
   * présence de l'adresse aurait donc coupé les circuits de financement —
   * exactement ceux qui font vivre un organisme de formation.
   */
  it("ne bloque JAMAIS les destinataires à identité externe", () => {
    const sansAdresse: AcheteurFacture = { nom: "Atlas", adresse: null };
    for (const destinataire of ["opco", "france_travail", "stagiaire"]) {
      expect(
        () => assertAcheteurComplet(sansAdresse, destinataire),
        `le destinataire « ${destinataire} » ne doit pas être bloqué : son adresse ` +
          `vient d'un référentiel externe, pas de la fiche client`,
      ).not.toThrow();
    }
  });
});

/**
 * 🔴 UNE GARDE NON APPELÉE NE GARDE RIEN.
 *
 * Tout ce qui précède teste une fonction PURE. Rien n'y prouve qu'un émetteur
 * de facture l'invoque — et ce dépôt a vu SEPT fois en deux jours le motif
 * « le code existe, il est testé, personne ne l'appelle au bon endroit » : le
 * mécanisme `rectifie` avec un seul appelant sur vingt-quatre, la procédure de
 * sous-traitance jamais comptée par sa propre règle, le bouton « régénérer »
 * qui ne passait ni `force` ni motif — et qui a fabriqué `AXI-ATT-2026-004`.
 *
 * D'où ce contrôle statique : il lit la source de l'émetteur et impose que la
 * garde y soit câblée. Le test unitaire vérifie qu'elle SAIT refuser ; celui-ci
 * vérifie qu'on la LUI DEMANDE.
 */
describe("la garde est réellement câblée dans l'émetteur", () => {
  const EMETTEUR = join(process.cwd(), "src/server/qualiopi/financements/facturation-service.ts");

  it("`facturation-service` appelle `assertAcheteurComplet`", () => {
    const source = readFileSync(EMETTEUR, "utf8");
    expect(
      source.includes("assertAcheteurComplet("),
      "facturation-service.ts n'appelle pas `assertAcheteurComplet` : une facture " +
        "peut donc naître sans adresse client, en violation de L.441-9.",
    ).toBe(true);
  });

  it("l'appel précède la création de la FactureFormation", () => {
    const source = readFileSync(EMETTEUR, "utf8");
    const garde = source.indexOf("assertAcheteurComplet(");
    const creation = source.indexOf("factureFormation.create");
    expect(garde).toBeGreaterThan(-1);
    // Si la création n'est pas dans ce fichier, la borne ne s'applique pas —
    // mais on ne veut pas d'un vert par vacuité : on l'affirme explicitement.
    if (creation > -1) {
      expect(
        garde,
        "la garde doit s'exécuter AVANT la création, sinon un enregistrement non " +
          "conforme existe déjà quand elle lève.",
      ).toBeLessThan(creation);
    }
  });
});
