/**
 * Chantier T4a — en inter-entreprises, un dossier porte AUTANT de créances que
 * de payeurs réels.
 *
 * 🔴 Le test qui doit rougir : **six entreprises, six OPCO → une seule créance**.
 * C'est ce que produisait `creerDossierDepuisSession`, qui ne lisait que les
 * champs de la session alors que chaque inscription porte son financeur, son
 * payeur et son prix de siège. Le modèle était déjà multi-payeurs ; le
 * constructeur ne s'en servait pas.
 */

import { describe, expect, it } from "vitest";
import {
  construireLignesPayeurs,
  montantDemandeFinanceurCents,
  typePayeurDe,
  type ContexteSessionPayeurs,
  type InscriptionPayeur,
} from "./dossier-payeurs";

const SESSION: ContexteSessionPayeurs = {
  financementType: "direct",
  clientId: "c-porteur",
  numeroDossierOpco: null,
  edofVerifieAt: null,
  ftDispositif: null,
  montantHtCents: 300000,
  opcoSubrogation: false,
  priseEnChargeMontantCents: null,
  client: { id: "c-porteur", raisonSociale: "Porteur SAS", opcoIdentifie: null },
};

function inscription(patch: Partial<InscriptionPayeur> = {}): InscriptionPayeur {
  return {
    financementType: null,
    clientId: null,
    numeroDossierOpco: null,
    edofVerifieAt: null,
    ftDispositif: null,
    montantHtCents: 50000,
    client: null,
    ...patch,
  };
}

function client(id: string, nom: string, opco: string | null = null) {
  return { id, raisonSociale: nom, opcoIdentifie: opco };
}

describe("typePayeurDe — qui doit vraiment l'argent", () => {
  it("🔴 OPCO SANS subrogation → c'est l'ENTREPRISE qui doit", () => {
    // Sans subrogation, l'OPCO rembourse le client : inscrire l'OPCO comme
    // payeur ferait attendre un virement qui n'arrivera jamais.
    expect(typePayeurDe("opco", false)).toBe("entreprise");
  });

  it("OPCO AVEC subrogation → l'OPCO", () => {
    expect(typePayeurDe("opco", true)).toBe("opco_subroge");
  });

  it("CPF → le bénéficiaire (la part CPF transite par la Caisse des Dépôts)", () => {
    expect(typePayeurDe("cpf", false)).toBe("stagiaire");
  });

  it("France Travail → France Travail", () => {
    expect(typePayeurDe("france_travail", false)).toBe("france_travail");
  });

  it.each(["direct", "mixte", "", null, undefined, "inconnu"])(
    "%s → l'entreprise (repli sûr)",
    (f) => {
      expect(typePayeurDe(f, false)).toBe("entreprise");
    },
  );
});

describe("🔴 inter-entreprises — le défaut T4a", () => {
  it("six entreprises, six OPCO subrogés → SIX créances, pas une", () => {
    const inscriptions = ["akto", "atlas", "opcommerce", "afdas", "uniformation", "ocapiat"].map(
      (opco, i) =>
        inscription({
          financementType: "opco",
          montantHtCents: 50000 + i * 1000,
          client: client(`c-${i}`, `Entreprise ${i}`, opco),
        }),
    );

    const lignes = construireLignesPayeurs(inscriptions, { ...SESSION, opcoSubrogation: true });

    expect(lignes).toHaveLength(6);
    expect(lignes.every((l) => l.payeurType === "opco_subroge")).toBe(true);
    // Le total est conservé : rien ne se perd au regroupement.
    const total = inscriptions.reduce((n, e) => n + (e.montantHtCents ?? 0), 0);
    expect(lignes.reduce((n, l) => n + l.montantAttenduCents, 0)).toBe(total);
  });

  it("🔴 deux inscriptions du MÊME employeur ne font QU'UNE créance", () => {
    // Le défaut symétrique : six factures à la même entreprise parce qu'elle a
    // inscrit six salariés.
    const lignes = construireLignesPayeurs(
      [
        inscription({ montantHtCents: 50000, client: client("c-1", "Acme") }),
        inscription({ montantHtCents: 70000, client: client("c-1", "Acme") }),
      ],
      SESSION,
    );

    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.payeurNom).toBe("Acme");
    expect(lignes[0]?.montantAttenduCents).toBe(120000);
  });

  it("deux entreprises relevant du MÊME OPCO subrogé ne font qu'un débiteur", () => {
    // C'est l'OPCO qui paie, et il paiera une fois.
    const lignes = construireLignesPayeurs(
      [
        inscription({
          financementType: "opco",
          montantHtCents: 40000,
          client: client("c-1", "Acme", "atlas"),
        }),
        inscription({
          financementType: "opco",
          montantHtCents: 60000,
          client: client("c-2", "Beta", "atlas"),
        }),
      ],
      { ...SESSION, opcoSubrogation: true },
    );

    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantAttenduCents).toBe(100000);
  });

  it("mélange de dispositifs → une créance par nature de payeur", () => {
    const lignes = construireLignesPayeurs(
      [
        inscription({
          financementType: "opco",
          montantHtCents: 50000,
          client: client("c-1", "Acme", "atlas"),
        }),
        inscription({
          financementType: "direct",
          montantHtCents: 40000,
          client: client("c-2", "Beta"),
        }),
        inscription({ financementType: "france_travail", montantHtCents: 30000 }),
        inscription({
          financementType: "cpf",
          montantHtCents: 20000,
          client: client("c-3", "Gamma"),
        }),
      ],
      { ...SESSION, opcoSubrogation: true },
    );

    const types = lignes.map((l) => l.payeurType).sort();
    expect(types).toEqual(["entreprise", "france_travail", "opco_subroge", "stagiaire"]);
  });

  it("les créances sont triées par montant décroissant — la plus grosse se relance en premier", () => {
    const lignes = construireLignesPayeurs(
      [
        inscription({ montantHtCents: 10000, client: client("c-1", "Petite") }),
        inscription({ montantHtCents: 90000, client: client("c-2", "Grosse") }),
      ],
      SESSION,
    );
    expect(lignes.map((l) => l.payeurNom)).toEqual(["Grosse", "Petite"]);
  });

  it("une inscription sans prix de siège retombe sur le prix de la session", () => {
    const lignes = construireLignesPayeurs(
      [inscription({ montantHtCents: null, client: client("c-1", "Acme") })],
      SESSION,
    );
    expect(lignes[0]?.montantAttenduCents).toBe(SESSION.montantHtCents);
  });

  it("une inscription sans client rattaché suit le client porteur de la session", () => {
    const lignes = construireLignesPayeurs([inscription({ client: null })], SESSION);
    expect(lignes[0]?.payeurNom).toBe("Porteur SAS");
  });
});

describe("session SANS inscription — le comportement historique, intact", () => {
  it("financement direct → une créance unique au montant de la session", () => {
    const lignes = construireLignesPayeurs([], SESSION);
    expect(lignes).toEqual([
      { payeurType: "entreprise", payeurNom: "Porteur SAS", montantAttenduCents: 300000 },
    ]);
  });

  it("subrogation → OPCO subrogé + reste à charge entreprise, comme avant", () => {
    const lignes = construireLignesPayeurs([], {
      ...SESSION,
      financementType: "opco",
      opcoSubrogation: true,
      priseEnChargeMontantCents: 200000,
      client: client("c-porteur", "Porteur SAS", "atlas"),
    });

    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ payeurType: "opco_subroge", montantAttenduCents: 200000 });
    expect(lignes[1]).toMatchObject({ payeurType: "entreprise", montantAttenduCents: 100000 });
  });

  it("subrogation totale → PAS de ligne de reste à charge à 0 €", () => {
    const lignes = construireLignesPayeurs([], {
      ...SESSION,
      financementType: "opco",
      opcoSubrogation: true,
      priseEnChargeMontantCents: 300000,
      client: client("c-porteur", "Porteur SAS", "atlas"),
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.payeurType).toBe("opco_subroge");
  });

  it("une prise en charge annoncée SUPÉRIEURE au prix ne crée pas un reste à charge négatif", () => {
    const lignes = construireLignesPayeurs([], {
      ...SESSION,
      financementType: "opco",
      opcoSubrogation: true,
      priseEnChargeMontantCents: 999999,
      client: client("c-porteur", "Porteur SAS", "atlas"),
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantAttenduCents).toBe(300000);
  });

  it("🔴 un dossier n'est JAMAIS sans payeur, même à 0 €", () => {
    // Sinon aucune relance ne peut le viser : un dossier sans débiteur est un
    // dossier qu'on ne peut ni suivre ni fermer.
    const lignes = construireLignesPayeurs(
      [inscription({ montantHtCents: 0, client: client("c-1", "Acme") })],
      { ...SESSION, montantHtCents: 0 },
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantAttenduCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les DEUX circuits OPCO — exigence du plan (Lot 8, étape 6)
// ─────────────────────────────────────────────────────────────────────────────
//
// « subrogation OPCO (l'OPCO paie sa part, le client le reste à charge) OU
//   facturation client intégrale puis remboursement. Les deux circuits existent
//   en droit ; le système doit dire lequel s'applique et ce qu'il reste à
//   encaisser de chaque payeur. »

describe("🔴 OPCO SANS subrogation — le circuit du remboursement", () => {
  const SESSION_OPCO: ContexteSessionPayeurs = {
    ...SESSION,
    financementType: "opco",
    client: client("c-porteur", "Porteur SAS", "atlas"),
  };

  it("l'ENTREPRISE porte toute la créance — l'OPCO ne doit rien à l'organisme", () => {
    const lignes = construireLignesPayeurs([], { ...SESSION_OPCO, opcoSubrogation: false });
    expect(lignes).toEqual([
      { payeurType: "entreprise", payeurNom: "Porteur SAS", montantAttenduCents: 300000 },
    ]);
  });

  it("aucune ligne OPCO n'est créée — sinon on attendrait un virement fantôme", () => {
    const lignes = construireLignesPayeurs(
      [
        inscription({
          financementType: "opco",
          montantHtCents: 50000,
          client: client("c-1", "Acme", "atlas"),
        }),
      ],
      { ...SESSION_OPCO, opcoSubrogation: false },
    );
    expect(lignes.some((l) => l.payeurType === "opco_subroge")).toBe(false);
    expect(lignes[0]?.payeurType).toBe("entreprise");
  });

  it("en inter SANS subrogation, chaque EMPLOYEUR doit sa part", () => {
    const lignes = construireLignesPayeurs(
      [
        inscription({
          financementType: "opco",
          montantHtCents: 50000,
          client: client("c-1", "Acme", "atlas"),
        }),
        inscription({
          financementType: "opco",
          montantHtCents: 70000,
          client: client("c-2", "Beta", "akto"),
        }),
      ],
      { ...SESSION_OPCO, opcoSubrogation: false },
    );
    expect(lignes).toHaveLength(2);
    expect(lignes.every((l) => l.payeurType === "entreprise")).toBe(true);
    expect(lignes.map((l) => l.payeurNom).sort()).toEqual(["Acme", "Beta"]);
  });

  it("le MÊME dossier bascule correctement quand la subrogation est activée", () => {
    // C'est la preuve que les deux circuits sont servis par un seul chemin, et
    // qu'aucun n'est un cas particulier bricolé.
    const inscriptions = [
      inscription({
        financementType: "opco",
        montantHtCents: 50000,
        client: client("c-1", "Acme", "atlas"),
      }),
    ];
    const sans = construireLignesPayeurs(inscriptions, {
      ...SESSION_OPCO,
      opcoSubrogation: false,
    });
    const avec = construireLignesPayeurs(inscriptions, { ...SESSION_OPCO, opcoSubrogation: true });

    expect(sans[0]?.payeurType).toBe("entreprise");
    expect(avec[0]?.payeurType).toBe("opco_subroge");
    // Le montant dû ne change pas : c'est le DÉBITEUR qui change, pas la dette.
    expect(sans[0]?.montantAttenduCents).toBe(avec[0]?.montantAttenduCents);
  });
});

describe("montantDemandeFinanceurCents", () => {
  it("somme les lignes financeur, pas les créances des entreprises", () => {
    const montant = montantDemandeFinanceurCents(
      [
        { payeurType: "opco_subroge", payeurNom: "Atlas", montantAttenduCents: 200000 },
        { payeurType: "entreprise", payeurNom: "Acme", montantAttenduCents: 100000 },
      ],
      { priseEnCharge: 0, montantSessionCents: 300000 },
    );
    expect(montant).toBe(200000);
  });

  it("additionne plusieurs financeurs", () => {
    const montant = montantDemandeFinanceurCents(
      [
        { payeurType: "opco_subroge", payeurNom: "Atlas", montantAttenduCents: 120000 },
        { payeurType: "france_travail", payeurNom: "France Travail", montantAttenduCents: 80000 },
      ],
      { priseEnCharge: 0, montantSessionCents: 300000 },
    );
    expect(montant).toBe(200000);
  });

  it("🔴 sans ligne financeur, retombe sur la formule historique plutôt que d'afficher 0 €", () => {
    // Un dossier direct — ou un OPCO SANS subrogation — n'a rien à demander.
    // « 0 € demandé » se lirait comme une erreur de génération.
    expect(
      montantDemandeFinanceurCents(
        [{ payeurType: "entreprise", payeurNom: "Acme", montantAttenduCents: 300000 }],
        { priseEnCharge: 0, montantSessionCents: 300000 },
      ),
    ).toBe(300000);

    expect(
      montantDemandeFinanceurCents(
        [{ payeurType: "entreprise", payeurNom: "Acme", montantAttenduCents: 300000 }],
        { priseEnCharge: 180000, montantSessionCents: 300000 },
      ),
    ).toBe(180000);
  });
});
