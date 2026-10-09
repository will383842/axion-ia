import { describe, expect, it, vi } from "vitest";

// Contrat 2.6 (décision de Will, 09/10/2026) : l'attribution porte sur l'ÉTABLISSEMENT (SIRET).
// Un apporteur qui a démarché l'agence de Grenoble n'est pas commissionné sur celle de Lyon ;
// Williams seul peut étendre une attribution à toute l'entreprise (art. 3.1).

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import {
  AVANT_2_6,
  attributaireDeLaCommande,
  couvreToutLEntreprise,
  memePerimetre,
  relanceAttributionDue,
  signeAvant26,
  siretDeLaCommande,
  siretValide,
} from "../etablissement-presentation";

const GRENOBLE = "73282932000074";
const LYON = "73282932000041";
const net = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");

describe("contrat 2.6", () => {
  it("version ≥ 2.6 ; art. 3.1 : l'établissement déclaré, extension à la seule discrétion de la Société", () => {
    expect(Number(CONTRAT_VERSION)).toBeGreaterThanOrEqual(2.6);
    expect(net).toContain("L'attribution porte sur l'**établissement déclaré**");
    expect(net).toContain(
      "l'Apporteur n'est commissionné que sur les commandes de cet établissement",
    );
    expect(net).toContain("**à sa seule discrétion**");
    expect(net).toContain("qui ne sont pas déjà attribués à un autre Apporteur");
    expect(net).not.toContain("quel que soit le nombre de ses établissements");
  });

  it("relecture de a1 : le rattachement manuel sous 15 jours ne fait rien perdre à l'apporteur", () => {
    expect(net).toContain("dans les **quinze jours** de l'encaissement intégral");
    expect(net).toContain("La commission qui en résulte reste due");
    expect(net).toContain(
      "le délai de paiement de l'article 5.3 court à compter de ce rattachement",
    );
    expect(net).toContain("apprécié établissement par établissement");
  });

  it("art. 3.2 : la déclaration porte le SIRET ; art. 3.3 : l'antériorité se juge par établissement", () => {
    expect(net).toContain("le **numéro SIRET de l'établissement** visité");
    expect(net).toContain(
      "Aucune attribution ne peut porter sur un établissement que la Société connaît déjà",
    );
    expect(net).toContain(
      "*établissement* s'entend de l'établissement de l'entreprise identifié par son numéro SIRET",
    );
  });
});

describe("le périmètre d'une attribution", () => {
  const g = { siret: GRENOBLE, entreprise: false, exclus: [] };
  const l = { siret: LYON, entreprise: false, exclus: [] };
  it("deux établissements différents ne se disputent rien ; le même, oui", () => {
    expect(siretValide(GRENOBLE) && siretValide(LYON)).toBe(true);
    expect(memePerimetre(g, l)).toBe(false);
    expect(memePerimetre(g, { ...g })).toBe(true);
  });
  it("une attribution d'avant la 2.6, ou étendue, couvre toute l'entreprise", () => {
    expect(couvreToutLEntreprise(AVANT_2_6)).toBe(true);
    expect(couvreToutLEntreprise({ siret: GRENOBLE, entreprise: true, exclus: [] })).toBe(true);
    expect(memePerimetre(AVANT_2_6, l)).toBe(true);
    expect(memePerimetre({ siret: GRENOBLE, entreprise: true, exclus: [] }, l)).toBe(true);
  });
});

describe("à qui revient la commande d'un établissement", () => {
  const paul = {
    nom: "Paul",
    recueAt: new Date("2026-10-01"),
    etablissement: { siret: GRENOBLE, entreprise: false, exclus: [] as string[] },
  };
  const marie = {
    nom: "Marie",
    recueAt: new Date("2026-10-02"),
    etablissement: { siret: LYON, entreprise: true, exclus: [] as string[], etendue: true },
  };

  it("Grenoble commande : Paul (son établissement), même si Marie a l'extension à toute l'entreprise", () => {
    expect(attributaireDeLaCommande([marie, paul], GRENOBLE)).toEqual({ presentation: paul });
  });
  it("un troisième établissement commande : Marie (extension)", () => {
    expect(attributaireDeLaCommande([paul, marie], "73282932000090")).toEqual({
      presentation: marie,
    });
  });
  it("point 1 (a1) : autre établissement que celui de Paul → « à attribuer », jamais perdue en silence", () => {
    expect(attributaireDeLaCommande([paul], LYON)).toEqual({ aAttribuer: true, candidats: [paul] });
  });
  it("point 1 (a1) : facture SANS SIRET, seules des attributions d'établissement → « à attribuer »", () => {
    expect(attributaireDeLaCommande([paul], null)).toEqual({ aAttribuer: true, candidats: [paul] });
  });
  it("aucune présentation sur ce SIREN : rien", () => {
    expect(attributaireDeLaCommande([], LYON)).toBeNull();
  });
  it("point 3 (a1) : un établissement EXCLU de l'extension n'est pas emporté → « à attribuer »", () => {
    const etendue = {
      recueAt: new Date("2026-10-02"),
      etablissement: { siret: LYON, entreprise: true, exclus: ["73282932000090"] },
    };
    expect(attributaireDeLaCommande([etendue], "73282932000090")).toEqual({
      aAttribuer: true,
      candidats: [etendue],
    });
    expect(attributaireDeLaCommande([etendue], GRENOBLE)).toEqual({ presentation: etendue });
  });
  it("facture sans SIRET mais attribution d'avant la 2.6 : elle couvre l'entreprise, comme avant", () => {
    const ancienne = { recueAt: new Date("2026-09-01"), etablissement: AVANT_2_6 };
    expect(attributaireDeLaCommande([ancienne], null)).toEqual({ presentation: ancienne });
  });
});

describe("point 2 (a1) : une seule source du SIRET de la commande, jamais le payeur", () => {
  it("le devis d'abord, puis la fiche client", () => {
    expect(siretDeLaCommande({ devisSiret: GRENOBLE, clientSiret: LYON })).toBe(GRENOBLE);
    expect(siretDeLaCommande({ devisSiret: null, clientSiret: "732 829 320 00041" })).toBe(LYON);
    expect(siretDeLaCommande({})).toBeNull();
  });
});

describe("point 4 (a1) : un contrat signé avant la 2.6 garde toute l'entreprise (art. 13)", () => {
  it("version signée < 2.6 : oui ; 2.6 et plus, ou inconnue : non", () => {
    expect(signeAvant26({ version: "2.4" })).toBe(true);
    expect(signeAvant26({ version: "2.5" })).toBe(true);
    expect(signeAvant26({ version: "2.6" })).toBe(false);
    expect(signeAvant26(null)).toBe(false);
  });
});

describe("relecture 2 de a1", () => {
  it("défaut 1 : une EXTENSION ne couvre jamais d'elle-même une commande sans SIRET", () => {
    const etendue = {
      recueAt: new Date("2026-10-02"),
      etablissement: { siret: LYON, entreprise: true, exclus: [], etendue: true },
    };
    expect(attributaireDeLaCommande([etendue], null)).toEqual({
      aAttribuer: true,
      candidats: [etendue],
    });
    // Signé avant la 2.6 (toute l'entreprise sans extension) ou d'avant la 2.6 : comme avant.
    const ancien = {
      recueAt: new Date("2026-09-01"),
      etablissement: { siret: LYON, entreprise: true, exclus: [], etendue: false },
    };
    expect(attributaireDeLaCommande([ancien], null)).toEqual({ presentation: ancien });
  });

  it("défaut 2 : le contrat prévoit la décision motivée et la contestation", () => {
    expect(net).toContain("elle en informe l'Apporteur concerné par écrit et motive sa décision");
    expect(net).toContain("il peut la contester par écrit");
  });

  it("défaut 3 : relance à J+10, retard à J+15", () => {
    const ouverte = new Date("2026-10-01T10:00:00Z");
    expect(relanceAttributionDue(ouverte, new Date("2026-10-10T10:00:00Z"))).toBeNull();
    expect(relanceAttributionDue(ouverte, new Date("2026-10-11T10:00:00Z"))).toBe(10);
    expect(relanceAttributionDue(ouverte, new Date("2026-10-16T10:00:00Z"))).toBe(15);
  });
});
