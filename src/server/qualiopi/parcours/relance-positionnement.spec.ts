/**
 * 🔴 LE POSITIONNEMENT N'ÉTAIT JAMAIS RELANCÉ.
 *
 * Envoyé une fois, à la conclusion de la pièce contractuelle. Ensuite, plus
 * rien. Un stagiaire qui ne répond pas n'était jamais relancé, et le jour de la
 * formation arrivait sans que le besoin ait été recueilli (indicateur 8).
 *
 * Devant un auditeur : une non-réponse du stagiaire n'est pas une faute de
 * l'organisme ; **l'absence de tentative tracée, si**.
 */

import { describe, expect, it } from "vitest";
import {
  gestePositionnement,
  HORIZON_JOURS,
  DELAI_ENTRE_RELANCES_JOURS,
  RELANCES_MAX,
  type EtatPositionnement,
} from "./relance-positionnement";

const MAINTENANT = new Date("2026-08-17T09:00:00Z");
const j = (n: number) => new Date(MAINTENANT.getTime() + n * 86400000);

const etat = (p: Partial<EtatPositionnement> = {}): EtatPositionnement => ({
  envoyeAt: null,
  reponduAt: null,
  relanceCount: 0,
  derniereRelanceAt: null,
  dateDebut: j(7),
  maintenant: MAINTENANT,
  ...p,
});

describe("🔴 PAS de compte à rebours — l'état, et le rattrapage", () => {
  it("jamais envoyé, session dans 7 jours → on envoie", () => {
    expect(gestePositionnement(etat())).toBe("envoyer");
  });

  it("jamais envoyé, session DEMAIN → on envoie encore", () => {
    // 🔴 Le cœur du patron. Une fenêtre « J-5 » aurait laissé passer ce cas :
    // vérifié en production sur la convocation, AUCUNE session réelle n'existait
    // cinq jours avant son début. Une session créée à l'intérieur de sa propre
    // fenêtre n'y entre jamais, et rien ne la rattrape.
    expect(gestePositionnement(etat({ dateDebut: j(1) }))).toBe("envoyer");
  });

  it("jamais envoyé, session dans 3 heures → on envoie ENCORE", () => {
    // Tant que la session n'a pas commencé, il reste un besoin à recueillir.
    expect(
      gestePositionnement(etat({ dateDebut: new Date(MAINTENANT.getTime() + 3 * 3600000) })),
    ).toBe("envoyer");
  });

  it("une exécution manquée n'est pas définitive", () => {
    // Le cron n'a pas tourné hier (déploiement, coupure Redis) : l'inscription
    // reste candidate aujourd'hui, parce que le critère est l'ÉTAT.
    expect(gestePositionnement(etat({ dateDebut: j(2) }))).toBe("envoyer");
  });
});

describe("🔴 la session a commencé : on n'envoie PLUS", () => {
  it.each([[-1], [-10]])("début il y a %s jour(s) → rien", (n) => {
    // Un positionnement recueilli après le début ne mesure plus le besoin
    // d'entrée : il mesure ce que la formation vient d'apprendre. La pièce
    // existerait, datée, et serait FAUSSE.
    expect(gestePositionnement(etat({ dateDebut: j(n) }))).toBe("rien");
  });

  it("même quand rien n'a jamais été envoyé", () => {
    // Ce cas relève d'un écart à consigner, pas d'un envoi.
    expect(gestePositionnement(etat({ dateDebut: j(-1), envoyeAt: null }))).toBe("rien");
  });
});

describe("l'horizon haut : on ne réclame pas trop tôt", () => {
  it(`au-delà de ${HORIZON_JOURS} jours → rien`, () => {
    // Le besoin n'est pas encore formé ; le réclamer trois mois à l'avance en
    // fait une case à cocher.
    expect(gestePositionnement(etat({ dateDebut: j(HORIZON_JOURS + 1) }))).toBe("rien");
  });

  it("la bordure exacte est INCLUSE", () => {
    expect(gestePositionnement(etat({ dateDebut: j(HORIZON_JOURS) }))).toBe("envoyer");
  });
});

describe("🔴 les relances : tracées, espacées, plafonnées", () => {
  it("envoyé il y a longtemps, sans réponse → on relance", () => {
    expect(gestePositionnement(etat({ envoyeAt: j(-6) }))).toBe("relancer");
  });

  it("envoyé HIER → on attend", () => {
    // Sans repère sur l'envoi initial, la première relance partirait le
    // lendemain — et le stagiaire recevrait deux e-mails en deux jours.
    expect(gestePositionnement(etat({ envoyeAt: j(-1) }))).toBe("rien");
  });

  it("le délai court depuis la DERNIÈRE relance, pas depuis l'envoi", () => {
    const e = etat({ envoyeAt: j(-20), relanceCount: 1, derniereRelanceAt: j(-1) });
    expect(gestePositionnement(e)).toBe("rien");
  });

  it(`plafonné à ${RELANCES_MAX} — au-delà on ne relance plus, on harcèle`, () => {
    const e = etat({
      envoyeAt: j(-30),
      relanceCount: RELANCES_MAX,
      derniereRelanceAt: j(-20),
    });
    expect(gestePositionnement(e)).toBe("rien");
  });

  it(`la bordure du délai (${DELAI_ENTRE_RELANCES_JOURS} j) est INCLUSE`, () => {
    const e = etat({ envoyeAt: j(-DELAI_ENTRE_RELANCES_JOURS) });
    expect(gestePositionnement(e)).toBe("relancer");
  });
});

describe("répondu : c'est fini", () => {
  it("quelles que soient les autres conditions", () => {
    // ⚠️ Le contre-test. Sans lui, un stagiaire ayant répondu pourrait être
    // relancé — le pire des e-mails, celui qui prouve qu'on n'a pas lu.
    expect(
      gestePositionnement(
        etat({ envoyeAt: j(-30), reponduAt: j(-25), relanceCount: 0, dateDebut: j(1) }),
      ),
    ).toBe("rien");
  });
});
