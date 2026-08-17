/**
 * Sous-lot 8E — le destinataire d'une relance se dérive de la FACTURE.
 *
 * Le test qui doit rougir, et qui rougissait avant ce module : **une facture
 * subrogée à l'OPCO ne doit jamais désigner l'e-mail du client**. C'est le
 * constat T4 de l'audit OPCO du 15/08 — une mise en demeure L.441-10 partait à
 * une entreprise qui ne devait rien sur cette facture.
 *
 * Chaque cas ci-dessous est écrit pour échouer si le repli sur le client
 * revenait, sous quelque forme que ce soit.
 */

import { describe, expect, it } from "vitest";
import {
  resoudreDestinataireRelance,
  type ClientPourRelance,
  type DossierPourRelance,
  type EntreeRelance,
} from "./relance-destinataire";

const CLIENT: ClientPourRelance = {
  raisonSociale: "INVEST SUN",
  contactNom: "Marie Dupont",
  contactEmail: "compta@invest-sun.example",
  opcoIdentifie: "atlas",
};

const DOSSIER_COMPLET: DossierPourRelance = {
  financeurNom: "OPCO Atlas",
  financeurContactNom: "Gestionnaire Atlas",
  financeurContactEmail: "gestion@atlas.example",
  numeroDossierExterne: "ATL-2026-4412",
  subrogation: true,
};

function entree(patch: Partial<EntreeRelance>): EntreeRelance {
  return {
    destinataire: "entreprise",
    destinataireNom: "INVEST SUN",
    dossier: null,
    client: CLIENT,
    ...patch,
  };
}

describe("facture libellée à l'entreprise", () => {
  it("retient l'e-mail de contact du client", () => {
    const r = resoudreDestinataireRelance(entree({}));
    expect(r.qualite).toBe("entreprise");
    expect(r.email).toBe("compta@invest-sun.example");
    expect(r.nom).toBe("Marie Dupont");
    expect(r.empechement).toBeNull();
  });

  it("empêche l'envoi quand le client n'a pas d'e-mail, sans inventer de repli", () => {
    const r = resoudreDestinataireRelance(entree({ client: { ...CLIENT, contactEmail: null } }));
    expect(r.email).toBeNull();
    expect(r.empechement).toContain("Aucun e-mail de contact");
  });

  it("retombe sur la raison sociale puis sur l'identité figée à la facture", () => {
    expect(
      resoudreDestinataireRelance(entree({ client: { ...CLIENT, contactNom: null } })).nom,
    ).toBe("INVEST SUN");
    expect(
      resoudreDestinataireRelance(
        entree({
          destinataireNom: "Identité figée",
          client: { raisonSociale: null, contactNom: null, contactEmail: "x@y.example" },
        }),
      ).nom,
    ).toBe("Identité figée");
  });
});

describe("facture subrogée à un OPCO — le cœur du sous-lot 8E", () => {
  it("retient le gestionnaire du dossier, JAMAIS le client", () => {
    const r = resoudreDestinataireRelance(
      entree({ destinataire: "opco", destinataireNom: "Atlas", dossier: DOSSIER_COMPLET }),
    );
    expect(r.qualite).toBe("financeur");
    expect(r.email).toBe("gestion@atlas.example");
    expect(r.nom).toBe("Gestionnaire Atlas");
    expect(r.empechement).toBeNull();
  });

  it("🔴 REFUSE plutôt que de se rabattre sur le client quand le gestionnaire manque", () => {
    const r = resoudreDestinataireRelance(
      entree({
        destinataire: "opco",
        destinataireNom: "Atlas",
        dossier: { ...DOSSIER_COMPLET, financeurContactEmail: null },
      }),
    );
    // Le point entier du module : l'adresse du client est disponible, connue, et
    // n'est PAS utilisée.
    expect(r.email).toBeNull();
    expect(r.email).not.toBe(CLIENT.contactEmail);
    expect(r.empechement).toContain("mauvais débiteur");
  });

  it("refuse aussi quand aucun dossier de financement n'est rattaché", () => {
    const r = resoudreDestinataireRelance(
      entree({ destinataire: "opco", destinataireNom: "OPCO (à préciser)", dossier: null }),
    );
    expect(r.email).toBeNull();
    expect(r.empechement).not.toBeNull();
    expect(r.precision).toContain("aucun dossier de financement");
  });

  it("dit à l'écran QUI doit, et sous quel numéro de dossier", () => {
    const r = resoudreDestinataireRelance(
      entree({ destinataire: "opco", destinataireNom: "Atlas", dossier: DOSSIER_COMPLET }),
    );
    expect(r.precision).toContain("subrogée");
    expect(r.precision).toContain("ATL-2026-4412");
  });

  it("nomme le financeur même sans `financeurNom`, par l'OPCO identifié du client", () => {
    const r = resoudreDestinataireRelance(
      entree({
        destinataire: "opco",
        destinataireNom: "OPCO (à préciser)",
        dossier: { ...DOSSIER_COMPLET, financeurNom: null, financeurContactEmail: null },
      }),
    );
    // `opcoLabel("atlas")` rend un libellé lisible : ce qui compte pour le test,
    // c'est qu'il ne reste ni le slug brut, ni le placeholder de la facture.
    expect(r.empechement).not.toContain("OPCO (à préciser)");
    expect(r.empechement).not.toContain("atlas,");
  });
});

describe("facture libellée à France Travail", () => {
  it("suit exactement le même régime que l'OPCO", () => {
    const r = resoudreDestinataireRelance(
      entree({
        destinataire: "france_travail",
        destinataireNom: "France Travail",
        dossier: null,
      }),
    );
    expect(r.qualite).toBe("financeur");
    expect(r.email).toBeNull();
    expect(r.empechement).toContain("France Travail");
  });
});

describe("reste à charge dû par le bénéficiaire", () => {
  it("n'utilise pas l'entreprise comme substitut", () => {
    const r = resoudreDestinataireRelance(
      entree({ destinataire: "stagiaire", destinataireNom: "Bénéficiaire (reste à charge)" }),
    );
    expect(r.qualite).toBe("beneficiaire");
    expect(r.email).toBeNull();
    expect(r.email).not.toBe(CLIENT.contactEmail);
    expect(r.empechement).toContain("bénéficiaire");
  });
});

describe("adresse saisie à la main par l'admin", () => {
  it("prime et lève l'empêchement — l'admin peut connaître le gestionnaire", () => {
    const r = resoudreDestinataireRelance(
      entree({
        destinataire: "opco",
        destinataireNom: "Atlas",
        dossier: { ...DOSSIER_COMPLET, financeurContactEmail: null },
      }),
      "  gestionnaire.reel@atlas.example  ",
    );
    expect(r.email).toBe("gestionnaire.reel@atlas.example");
    expect(r.empechement).toBeNull();
  });

  it("ne fait PAS disparaître la précision : l'admin doit voir qu'il écrit à un financeur", () => {
    const r = resoudreDestinataireRelance(
      entree({ destinataire: "opco", destinataireNom: "Atlas", dossier: DOSSIER_COMPLET }),
      "autre@atlas.example",
    );
    expect(r.qualite).toBe("financeur");
    expect(r.precision).toContain("subrogée");
  });

  it("une chaîne vide ou blanche n'est pas une saisie", () => {
    expect(resoudreDestinataireRelance(entree({}), "   ").email).toBe(CLIENT.contactEmail);
    expect(resoudreDestinataireRelance(entree({}), "").email).toBe(CLIENT.contactEmail);
    expect(resoudreDestinataireRelance(entree({}), null).email).toBe(CLIENT.contactEmail);
  });
});
