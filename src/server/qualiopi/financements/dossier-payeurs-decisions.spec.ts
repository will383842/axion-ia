/**
 * Les DÉCISIONS du financeur — questions de Will du 16/08.
 *
 * « est-ce prévu si l'OPCO ne prend qu'une PARTIE en charge, ou s'il CHANGE le
 *   montant après, ou s'il ANNULE simplement sa prise en charge ? »
 *
 * 🔴 Réponse d'alors : non. Les lignes de créance étaient écrites une fois à la
 * création et **jamais mises à jour** — aucun code du dépôt n'écrivait dans
 * `DossierPayeur` après le `create`. Le reste à charge du client restait donc
 * faux, et rien ne signalait qu'il devenait débiteur du tout.
 *
 * Les trois cas passent par UN seul mécanisme : le plafond du financeur.
 * Partiel = plafond < dû. Révisé = nouveau plafond. Annulé = plafond 0.
 */

import { describe, expect, it } from "vitest";
import {
  construireLignesPayeurs,
  type ContexteSessionPayeurs,
  type InscriptionPayeur,
} from "./dossier-payeurs";

function client(id: string, nom: string, opco: string | null = null) {
  return { id, raisonSociale: nom, opcoIdentifie: opco };
}

const SESSION_SUBROGEE: ContexteSessionPayeurs = {
  financementType: "opco",
  clientId: "c-porteur",
  numeroDossierOpco: "ATL-1",
  edofVerifieAt: null,
  ftDispositif: null,
  montantHtCents: 300000,
  opcoSubrogation: true,
  priseEnChargeMontantCents: null,
  client: client("c-porteur", "Porteur SAS", "atlas"),
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

function siegeOpco(nom: string, montant: number, id: string) {
  return inscription({
    financementType: "opco",
    montantHtCents: montant,
    client: client(id, nom, "atlas"),
  });
}

describe("🔴 l'OPCO ne prend qu'une PARTIE en charge", () => {
  it("intra : la part non couverte retombe sur l'entreprise", () => {
    const lignes = construireLignesPayeurs([], {
      ...SESSION_SUBROGEE,
      priseEnChargeMontantCents: 180000,
    });
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ payeurType: "opco_subroge", montantAttenduCents: 180000 });
    expect(lignes[1]).toMatchObject({ payeurType: "entreprise", montantAttenduCents: 120000 });
  });

  it("🔴 inter : le plafond se répartit AU PRORATA des sièges, pas au premier arrivé", () => {
    // Servir les premiers sièges à 100 % et laisser les derniers à 0 ferait
    // porter tout le reste à charge à une entreprise choisie par l'ordre de la
    // requête. Personne ne pourrait lui expliquer pourquoi c'est elle.
    const lignes = construireLignesPayeurs(
      [siegeOpco("Acme", 100000, "c-1"), siegeOpco("Beta", 100000, "c-2")],
      { ...SESSION_SUBROGEE, priseEnChargeMontantCents: 100000 },
    );

    expect(lignes.find((l) => l.payeurType === "opco_subroge")?.montantAttenduCents).toBe(100000);
    // Les DEUX entreprises portent la moitié du reste, pas une seule.
    expect(lignes.find((l) => l.payeurNom === "Acme")?.montantAttenduCents).toBe(50000);
    expect(lignes.find((l) => l.payeurNom === "Beta")?.montantAttenduCents).toBe(50000);
  });

  it("aucun centime n'est perdu ni inventé sur un partage inexact", () => {
    const lignes = construireLignesPayeurs(
      [
        siegeOpco("Acme", 33333, "c-1"),
        siegeOpco("Beta", 33333, "c-2"),
        siegeOpco("Gamma", 33334, "c-3"),
      ],
      { ...SESSION_SUBROGEE, priseEnChargeMontantCents: 50000 },
    );

    expect(lignes.reduce((n, l) => n + l.montantAttenduCents, 0)).toBe(100000);
    expect(lignes.find((l) => l.payeurType === "opco_subroge")?.montantAttenduCents).toBe(50000);
  });

  it("un plafond SUPÉRIEUR au dû ne crée pas de créance négative", () => {
    const lignes = construireLignesPayeurs([], {
      ...SESSION_SUBROGEE,
      priseEnChargeMontantCents: 999999,
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.montantAttenduCents).toBe(300000);
  });
});

describe("🔴 l'OPCO CHANGE son montant après coup", () => {
  const inscriptions = [siegeOpco("Acme", 200000, "c-1")];

  it("le même dossier se reventile sur le nouveau montant accordé", () => {
    const demande = construireLignesPayeurs(inscriptions, {
      ...SESSION_SUBROGEE,
      priseEnChargeMontantCents: 200000,
    });
    const accordReduit = construireLignesPayeurs(
      inscriptions,
      { ...SESSION_SUBROGEE, priseEnChargeMontantCents: 200000 },
      { plafondFinanceurCents: 120000 },
    );

    expect(demande.find((l) => l.payeurType === "opco_subroge")?.montantAttenduCents).toBe(200000);
    expect(demande.find((l) => l.payeurType === "entreprise")).toBeUndefined();

    expect(accordReduit.find((l) => l.payeurType === "opco_subroge")?.montantAttenduCents).toBe(
      120000,
    );
    expect(accordReduit.find((l) => l.payeurType === "entreprise")?.montantAttenduCents).toBe(
      80000,
    );
  });

  it("un accord REVU À LA HAUSSE réduit d'autant le reste à charge", () => {
    const lignes = construireLignesPayeurs(
      inscriptions,
      { ...SESSION_SUBROGEE, priseEnChargeMontantCents: 80000 },
      { plafondFinanceurCents: 200000 },
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.payeurType).toBe("opco_subroge");
  });
});

describe("🔴 l'OPCO ANNULE sa prise en charge", () => {
  it("plafond 0 → TOUT retombe sur l'entreprise, et la ligne OPCO disparaît", () => {
    const lignes = construireLignesPayeurs([siegeOpco("Acme", 200000, "c-1")], SESSION_SUBROGEE, {
      plafondFinanceurCents: 0,
    });

    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      payeurType: "entreprise",
      payeurNom: "Acme",
      montantAttenduCents: 200000,
    });
  });

  it("en inter, chaque employeur récupère SA part — pas le client porteur", () => {
    // Le piège : rendre la totalité au client qui a réservé la session, alors
    // que ce sont les employeurs des participants qui doivent.
    const lignes = construireLignesPayeurs(
      [siegeOpco("Acme", 60000, "c-1"), siegeOpco("Beta", 40000, "c-2")],
      SESSION_SUBROGEE,
      { plafondFinanceurCents: 0 },
    );

    expect(lignes).toHaveLength(2);
    expect(lignes.find((l) => l.payeurNom === "Acme")?.montantAttenduCents).toBe(60000);
    expect(lignes.find((l) => l.payeurNom === "Beta")?.montantAttenduCents).toBe(40000);
    expect(lignes.some((l) => l.payeurNom === "Porteur SAS")).toBe(false);
  });

  it("🔴 le total dû ne change JAMAIS — seul le DÉBITEUR change", () => {
    const inscriptions = [siegeOpco("Acme", 150000, "c-1")];
    const totalDe = (plafond: number | null) =>
      construireLignesPayeurs(inscriptions, SESSION_SUBROGEE, {
        plafondFinanceurCents: plafond,
      }).reduce((n, l) => n + l.montantAttenduCents, 0);

    expect(totalDe(null)).toBe(150000);
    expect(totalDe(150000)).toBe(150000);
    expect(totalDe(90000)).toBe(150000);
    expect(totalDe(0)).toBe(150000);
  });

  it("un refus SANS subrogation ne change rien — l'entreprise devait déjà tout", () => {
    const lignes = construireLignesPayeurs(
      [siegeOpco("Acme", 150000, "c-1")],
      { ...SESSION_SUBROGEE, opcoSubrogation: false },
      { plafondFinanceurCents: 0 },
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ payeurType: "entreprise", montantAttenduCents: 150000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Le reliquat d'arrondi — defaut prouve par execution le 16/08
// ─────────────────────────────────────────────────────────────────────────────
//
// Le commentaire affirmait « le total ventile est rigoureusement egal au
// plafond ». C'etait FAUX : le cumul se faisait sur la part NON bornee, si bien
// qu'un siege sature faisait basculer sa difference sur les entreprises, en
// silence. Le test cense couvrir le cas prenait trois sieges quasi egaux, ou
// l'ecart est nul PAR CONSTRUCTION — il ne pouvait pas rougir.

describe("le financeur recoit EXACTEMENT son plafond, meme a sieges heterogenes", () => {
  it("40 petits sieges + 1 gros : le siege sature ne mange pas le plafond", () => {
    const petits = Array.from({ length: 40 }, (_, i) => siegeOpco(`P${i}`, 3, `cp-${i}`));
    const gros = siegeOpco("Gros", 500, "cg");

    const lignes = construireLignesPayeurs([...petits, gros], SESSION_SUBROGEE, {
      plafondFinanceurCents: 619,
    });

    const opco = lignes.find((l) => l.payeurType === "opco_subroge");
    expect(opco?.montantAttenduCents).toBe(619);

    // Et le total du ne bouge pas : 40 x 3 + 500 = 620.
    expect(lignes.reduce((n, l) => n + l.montantAttenduCents, 0)).toBe(620);
  });

  it("un plafond egal au brut donne TOUT au financeur, sans reliquat perdu", () => {
    const sieges = [siegeOpco("A", 7, "a"), siegeOpco("B", 11, "b"), siegeOpco("C", 13, "c")];
    const lignes = construireLignesPayeurs(sieges, SESSION_SUBROGEE, {
      plafondFinanceurCents: 31,
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.payeurType).toBe("opco_subroge");
    expect(lignes[0]?.montantAttenduCents).toBe(31);
  });

  it("plafond impair sur sieges egaux : rien ne se perd au centime", () => {
    const sieges = [siegeOpco("A", 100, "a"), siegeOpco("B", 100, "b"), siegeOpco("C", 100, "c")];
    const lignes = construireLignesPayeurs(sieges, SESSION_SUBROGEE, {
      plafondFinanceurCents: 101,
    });
    expect(lignes.find((l) => l.payeurType === "opco_subroge")?.montantAttenduCents).toBe(101);
    expect(lignes.reduce((n, l) => n + l.montantAttenduCents, 0)).toBe(300);
  });
});
