/**
 * Facture générée le lendemain de la session — la DÉCISION, testée à sec.
 *
 * Chaque cas que la génération automatique refuse de traiter est un cas où une
 * facture fausse, irrégulière ou en double partirait sinon. Le test dit lequel.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  deciderFactureAuto,
  MISE_EN_SERVICE_FACTURE_AUTO,
  FENETRE_FACTURE_AUTO_JOURS,
  type SessionFactureAuto,
} from "./facture-auto-regles";

/** 16:00 à Paris le 5 octobre 2026 (UTC+2). */
const FIN = new Date("2026-10-05T14:00:00.000Z");

function session(over: Partial<SessionFactureAuto> = {}): SessionFactureAuto {
  return {
    id: "s-1",
    numero: "AXI-SESS-2026-900",
    titreSession: "Formation test",
    statut: "realisee",
    dateFin: FIN,
    montantHtCents: 150000,
    interEntreprises: false,
    financementType: "direct",
    opcoSubrogation: false,
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: null,
      contactEmail: "compta@acme.test",
    },
    facturesFormation: [],
    dossiersFinancement: [],
    ...over,
  };
}

/** Une heure de Paris le jour donné (octobre 2026 = UTC+2). */
const paris = (jour: string, heure: string) => new Date(`${jour}T${heure}:00+02:00`);

describe("le LENDEMAIN de la fin, pas avant", () => {
  it("le soir même de la fin : on attend", () => {
    const d = deciderFactureAuto(session(), paris("2026-10-05", "23:30"));
    expect(d).toEqual({ verdict: "attendre", raison: "avant_lendemain" });
  });

  it("le lendemain dès minuit (heure de Paris) : on émet, au client, au forfait", () => {
    const d = deciderFactureAuto(session(), paris("2026-10-06", "00:10"));
    expect(d).toEqual({ verdict: "emettre", destinataire: "entreprise", ventilation: "forfait" });
  });

  it("🔑 le jour se lit à PARIS : 00:30 à Paris le 6 est encore le 5 en UTC — et c'est le lendemain", () => {
    // 2026-10-06 00:30 Paris = 2026-10-05 22:30 UTC. Un calcul en jours UTC
    // attendrait encore deux heures ; la facture est datée en France.
    const d = deciderFactureAuto(session(), new Date("2026-10-05T22:30:00.000Z"));
    expect(d.verdict).toBe("emettre");
  });

  it("une session qui n'est pas « réalisée » n'est jamais facturée, même des jours après", () => {
    const d = deciderFactureAuto(session({ statut: "en_cours" }), paris("2026-10-09", "10:00"));
    expect(d).toEqual({ verdict: "attendre", raison: "non_realisee" });
  });
});

describe("pas de rattrapage surprise du passé", () => {
  it("🔴 la borne est une DATE ÉCRITE, pas une valeur relative : 14/09/2026 00:00 à Paris", () => {
    // Les deux tests suivants se lisent RELATIVEMENT à la constante : ils
    // resteraient verts si quelqu'un la reculait en 2020 et rouvrait le
    // rattrapage de tout l'historique. Celui-ci épingle la valeur.
    expect(MISE_EN_SERVICE_FACTURE_AUTO.toISOString()).toBe("2026-09-13T22:00:00.000Z");
  });

  it("une session réalisée début septembre 2026, jamais facturée, reste hors de l'automate", () => {
    const fin = new Date("2026-09-05T15:00:00.000Z");
    const d = deciderFactureAuto(session({ dateFin: fin }), paris("2026-09-16", "11:30"));
    expect(d).toEqual({ verdict: "hors_champ", raison: "avant_mise_en_service" });
  });

  it("une session finie AVANT la mise en service n'est jamais facturée automatiquement", () => {
    const avant = new Date(MISE_EN_SERVICE_FACTURE_AUTO.getTime() - 60_000);
    const d = deciderFactureAuto(session({ dateFin: avant }), paris("2026-10-06", "10:00"));
    expect(d).toEqual({ verdict: "hors_champ", raison: "avant_mise_en_service" });
  });

  it("une session finie juste APRÈS la mise en service l'est", () => {
    const apres = new Date(MISE_EN_SERVICE_FACTURE_AUTO.getTime() + 60_000);
    const lendemain = new Date(apres.getTime() + 36 * 3600_000);
    expect(deciderFactureAuto(session({ dateFin: apres }), lendemain).verdict).toBe("emettre");
  });

  it(`au-delà de ${FENETRE_FACTURE_AUTO_JOURS} jours après la fin, l'automate ne facture plus`, () => {
    const loin = new Date(FIN.getTime() + (FENETRE_FACTURE_AUTO_JOURS + 1) * 86_400_000);
    expect(deciderFactureAuto(session(), loin)).toEqual({
      verdict: "hors_champ",
      raison: "fenetre_depassee",
    });
  });
});

describe("jamais deux factures pour la même session", () => {
  const lendemain = paris("2026-10-06", "10:00");

  it.each(["emise", "partiellement_payee", "en_retard", "payee", "brouillon"])(
    "une facture « %s » existe déjà : rien",
    (statut) => {
      const d = deciderFactureAuto(
        session({ facturesFormation: [{ statut, montantHtCents: 150000, avoirs: [] }] }),
        lendemain,
      );
      expect(d).toEqual({ verdict: "deja_facturee" });
    },
  );

  it("un avoir PARTIEL laisse la facture vivante : rien", () => {
    const d = deciderFactureAuto(
      session({
        facturesFormation: [
          {
            statut: "emise",
            montantHtCents: 150000,
            avoirs: [{ statut: "emise", montantHtCents: -50000 }],
          },
        ],
      }),
      lendemain,
    );
    expect(d).toEqual({ verdict: "deja_facturee" });
  });

  it("🔴 un avoir TOTAL a été émis : on ne refacture PAS automatiquement, on le signale", () => {
    const d = deciderFactureAuto(
      session({
        facturesFormation: [
          {
            statut: "emise",
            montantHtCents: 150000,
            avoirs: [{ statut: "emise", montantHtCents: -150000 }],
          },
        ],
      }),
      lendemain,
    );
    expect(d.verdict).toBe("non_automatisable");
    expect(d.verdict === "non_automatisable" && d.motifs.map((m) => m.code)).toEqual([
      "refacturation_apres_annulation",
    ]);
  });

  it("une facture ANNULÉE seule : même chose, on signale", () => {
    const d = deciderFactureAuto(
      session({ facturesFormation: [{ statut: "annulee", montantHtCents: 150000, avoirs: [] }] }),
      lendemain,
    );
    expect(d.verdict === "non_automatisable" && d.motifs.map((m) => m.code)).toEqual([
      "refacturation_apres_annulation",
    ]);
  });

  it("un avoir ANNULÉ ne compte pas comme une rectification", () => {
    const d = deciderFactureAuto(
      session({
        facturesFormation: [
          {
            statut: "emise",
            montantHtCents: 150000,
            avoirs: [{ statut: "annulee", montantHtCents: -150000 }],
          },
        ],
      }),
      lendemain,
    );
    expect(d).toEqual({ verdict: "deja_facturee" });
  });
});

describe("cas non automatisables : rien n'est émis, et le motif est nommé", () => {
  const lendemain = paris("2026-10-06", "10:00");
  const motifs = (s: SessionFactureAuto) => {
    const d = deciderFactureAuto(s, lendemain);
    expect(d.verdict).toBe("non_automatisable");
    return d.verdict === "non_automatisable" ? d.motifs.map((m) => m.code) : [];
  };

  it("montant HT nul", () => {
    expect(motifs(session({ montantHtCents: 0 }))).toEqual(["montant_absent"]);
  });

  it("aucun client rattaché", () => {
    expect(motifs(session({ client: null }))).toEqual(["client_absent"]);
  });

  it("client sans raison sociale", () => {
    const s = session();
    expect(motifs({ ...s, client: { ...s.client!, raisonSociale: "  " } })).toEqual([
      "client_absent",
    ]);
  });

  it("entreprise sans SIRET", () => {
    const s = session();
    expect(motifs({ ...s, client: { ...s.client!, siret: null } })).toEqual(["client_sans_siret"]);
  });

  it("un PARTICULIER n'a pas de SIRET : ce n'est pas un motif", () => {
    const s = session();
    const d = deciderFactureAuto(
      { ...s, client: { ...s.client!, type: "particulier", siret: null } },
      lendemain,
    );
    expect(d.verdict).toBe("emettre");
  });

  it("client sans adresse (ni libre, ni structurée)", () => {
    const s = session();
    expect(motifs({ ...s, client: { ...s.client!, adresse: null } })).toEqual([
      "client_sans_adresse",
    ]);
  });

  it("l'adresse STRUCTURÉE suffit", () => {
    const s = session();
    const d = deciderFactureAuto(
      {
        ...s,
        client: {
          ...s.client!,
          adresse: null,
          adresseRue: "1 rue de l'Exemple",
          adresseCodePostal: "00000",
          adresseVille: "Ville",
        },
      },
      lendemain,
    );
    expect(d.verdict).toBe("emettre");
  });

  it("aucun e-mail de contact", () => {
    const s = session();
    expect(motifs({ ...s, client: { ...s.client!, contactEmail: null } })).toEqual([
      "client_sans_email",
    ]);
  });

  it("session inter-entreprises : à facturer par participant", () => {
    expect(motifs(session({ interEntreprises: true }))).toEqual(["inter_entreprises"]);
  });

  it.each(["opco", "cpf", "france_travail", "mixte"] as const)(
    "financement « %s » : destinataire non déterminable sans ambiguïté",
    (financementType) => {
      expect(motifs(session({ financementType }))).toEqual(["financement_non_automatisable"]);
    },
  );

  it("subrogation OPCO cochée, même sur un financement « direct »", () => {
    expect(motifs(session({ opcoSubrogation: true }))).toEqual(["financement_non_automatisable"]);
  });

  it("un financement non renseigné est traité comme direct", () => {
    expect(deciderFactureAuto(session({ financementType: null }), lendemain).verdict).toBe(
      "emettre",
    );
  });

  it("dossier à plusieurs créances : plusieurs débiteurs, donc plusieurs factures", () => {
    const s = session({
      dossiersFinancement: [
        {
          payeurs: [
            { payeurType: "opco_subroge", montantAttenduCents: 100000, factureFormationId: null },
            { payeurType: "entreprise", montantAttenduCents: 50000, factureFormationId: null },
          ],
        },
      ],
    });
    expect(motifs(s)).toEqual(["creances_non_automatisables"]);
  });

  it("dossier à UNE créance « entreprise » libre : on émet (le montant viendra de la créance)", () => {
    const s = session({
      montantHtCents: 0,
      dossiersFinancement: [
        {
          payeurs: [
            { payeurType: "entreprise", montantAttenduCents: 90000, factureFormationId: null },
          ],
        },
      ],
    });
    expect(deciderFactureAuto(s, lendemain).verdict).toBe("emettre");
  });

  it("une créance unique mais NULLE : montant absent", () => {
    const s = session({
      dossiersFinancement: [
        {
          payeurs: [{ payeurType: "entreprise", montantAttenduCents: 0, factureFormationId: null }],
        },
      ],
    });
    expect(motifs(s)).toEqual(["montant_absent"]);
  });

  it("🔑 TOUS les motifs sont rendus, jamais le premier seul", () => {
    const s = session({ montantHtCents: 0, interEntreprises: true });
    expect(motifs({ ...s, client: { ...s.client!, siret: null, contactEmail: null } })).toEqual([
      "montant_absent",
      "inter_entreprises",
      "client_sans_siret",
      "client_sans_email",
    ]);
  });

  it("chaque motif porte un libellé lisible", () => {
    const d = deciderFactureAuto(session({ client: null, montantHtCents: 0 }), lendemain);
    expect(d.verdict === "non_automatisable" && d.motifs.every((m) => m.libelle.length > 10)).toBe(
      true,
    );
  });
});
