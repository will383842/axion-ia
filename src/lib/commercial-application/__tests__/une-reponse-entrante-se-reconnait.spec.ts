// Les règles PURES des réponses entrantes (2026-09-27) : réponse automatique
// ou non, adresse de l'expéditeur, objet et extrait taillés, badge de la liste.

import { describe, expect, it } from "vitest";

import {
  LONGUEUR_EXTRAIT_MAX,
  LONGUEUR_OBJET_MAX,
  adresseExpediteur,
  estReponseAutomatique,
  estTableAbsente,
  extraitCourt,
  lienZoho,
  normaliserEntetes,
  objetEnregistre,
} from "../reponse-entrante";
import { badgeSuiviInvitation } from "../relance-invitation";

const HUMAIN = "Re: Ton échange de 15 minutes";

describe("réponse automatique ou réponse de la personne", () => {
  it("🔴 un message ordinaire, en-têtes ordinaires, est une réponse de la personne", () => {
    const entetes = normaliserEntetes({ "Message-Id": ["<a@b>"], "In-Reply-To": "<x@y>" });
    expect(estReponseAutomatique({ entetes, objet: HUMAIN })).toBe(false);
    expect(estReponseAutomatique({ entetes: null, objet: HUMAIN })).toBe(false);
  });

  it("Auto-Submitted autre que « no » (RFC 3834) : automatique", () => {
    expect(
      estReponseAutomatique({
        entetes: normaliserEntetes({ "Auto-Submitted": ["auto-replied"] }),
        objet: HUMAIN,
      }),
    ).toBe(true);
    expect(
      estReponseAutomatique({
        entetes: normaliserEntetes({ "Auto-Submitted": ["no"] }),
        objet: HUMAIN,
      }),
    ).toBe(false);
  });

  it("X-Autoreply, X-Autorespond, Precedence auto_reply / bulk : automatique", () => {
    for (const brut of [
      { "X-Autoreply": "yes" },
      { "X-Autorespond": "1" },
      { Precedence: "auto_reply" },
      { Precedence: "bulk" },
    ]) {
      expect(estReponseAutomatique({ entetes: normaliserEntetes(brut), objet: HUMAIN })).toBe(true);
    }
  });

  it("X-Auto-Response-Suppress SEUL ne suffit pas : Exchange le pose sur des messages humains", () => {
    expect(
      estReponseAutomatique({
        entetes: normaliserEntetes({ "X-Auto-Response-Suppress": "All" }),
        objet: HUMAIN,
      }),
    ).toBe(false);
  });

  it("à défaut d'en-têtes, l'objet : « Réponse automatique », « Out of office », « Absence »", () => {
    for (const objet of [
      "Réponse automatique : Ton échange de 15 minutes",
      "Automatic reply: Ton échange",
      "Out of Office: Ton échange",
      "Absence du bureau",
      "Message d'absence",
    ]) {
      expect(estReponseAutomatique({ entetes: null, objet }), objet).toBe(true);
    }
  });

  it("un mot « absence » AU MILIEU d'un objet écrit par la personne ne suffit pas", () => {
    expect(
      estReponseAutomatique({ entetes: null, objet: "Re: désolé pour mon absence de réponse" }),
    ).toBe(false);
  });
});

describe("l'adresse de l'expéditeur", () => {
  it("se lit nue ou entre chevrons, et se normalise comme l'empreinte l'exige", () => {
    expect(adresseExpediteur("Camille@Exemple.FR")).toBe("camille@exemple.fr");
    expect(adresseExpediteur('"Camille M." <Camille@Exemple.fr>')).toBe("camille@exemple.fr");
    expect(adresseExpediteur("pas une adresse")).toBeNull();
    expect(adresseExpediteur("")).toBeNull();
  });
});

describe("l'objet et l'extrait gardés — jamais plus", () => {
  it("🔴 l'extrait retire la citation de notre invitation et tient en 300 caractères", () => {
    expect(
      extraitCourt(
        "Avec plaisir, jeudi 14 h ?  Le sam. 27 sept. 2026 à 21:30, Axion-IA <contact@axion-ia.com> a écrit : Bonjour Camille",
      ),
    ).toBe("Avec plaisir, jeudi 14 h ?");
    expect(extraitCourt("Yes! On Sat, Sep 27, 2026 at 9:30 PM Axion-IA wrote: Hello")).toBe("Yes!");
    const long = extraitCourt("mot ".repeat(200))!;
    expect(long.length).toBeLessThanOrEqual(LONGUEUR_EXTRAIT_MAX);
    expect(long.endsWith("…")).toBe(true);
    expect(extraitCourt("")).toBeNull();
    expect(extraitCourt(null)).toBeNull();
  });

  it("l'objet tient dans sa colonne (500), et n'est jamais vide", () => {
    expect(objetEnregistre("x".repeat(900)).length).toBeLessThanOrEqual(LONGUEUR_OBJET_MAX);
    expect(objetEnregistre("   ")).toBe("(sans objet)");
    expect(objetEnregistre("Re:\n  Ton   échange")).toBe("Re: Ton échange");
  });

  it("le lien « Ouvrir dans Zoho » vise le centre de données configuré", () => {
    expect(lienZoho("eu", "1709887058769100001")).toBe(
      "https://mail.zoho.eu/zm/#mail/folder/inbox/p/1709887058769100001",
    );
  });

  it("seule P2021 (table absente) est tenue pour « pas encore migrée »", () => {
    expect(estTableAbsente({ code: "P2021" })).toBe(true);
    expect(estTableAbsente({ code: "P2002" })).toBe(false);
    expect(estTableAbsente(new Error("connexion perdue"))).toBe(false);
  });
});

describe("🔴 le badge de la liste : échange réservé > a répondu > échange annulé > rappel > invité", () => {
  const INV = new Date("2026-09-27T19:30:00Z");
  const R1 = new Date("2026-10-01T08:00:00Z");
  const REP = new Date("2026-10-02T09:00:00Z");

  it("un échange réservé l'emporte sur une réponse", () => {
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1], echange: "reserve", reponse: REP }),
    ).toEqual({ type: "echange-reserve" });
  });

  it("une réponse l'emporte sur un échange annulé et sur les rappels", () => {
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1], echange: "annule", reponse: REP }),
    ).toEqual({ type: "a-repondu", le: REP });
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1], echange: null, reponse: REP }),
    ).toEqual({ type: "a-repondu", le: REP });
  });

  it("sans réponse, rien ne change", () => {
    expect(
      badgeSuiviInvitation({ invitation: INV, relances: [R1], echange: null, reponse: null }),
    ).toEqual({ type: "rappel", numero: 1, le: R1 });
  });
});
