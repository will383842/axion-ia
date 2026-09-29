/**
 * Un « non » à la question Calendly sur l'enregistrement est renvoyé à
 * l'extension (bandeau rouge), avec la réponse telle quelle ; la réponse est
 * gardée UNE fois comme indice (`reponse_calendly`, chiffrée), jamais comme
 * accord. Un refus antérieur du même client ou de la même adresse est signalé.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { estUnNon, reponseEnregistrementCalendly } from "../enregistreur-calendly";
import { listerRencontresDuJour } from "../rencontres-du-jour";
import {
  CLE_DE_TEST,
  commePrisma,
  fausseBase,
  semerAppareil,
  semerEnregistrement,
  semerRencontreCalendly,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const QUESTION = "Acceptez-vous que l'échange soit enregistré pour en faire le compte rendu ?";

describe("un non sur Calendly est renvoyé", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("lecture de la réponse et du non", () => {
    expect(
      reponseEnregistrementCalendly({
        questions_and_answers: [{ question: QUESTION, answer: "Non merci" }],
      }),
    ).toBe("Non merci");
    expect(estUnNon("Non merci")).toBe(true);
    expect(estUnNon("non")).toBe(true);
    expect(estUnNon("Oui")).toBe(false);
    expect(estUnNon("Nonobstant, oui")).toBe(false);
    expect(estUnNon(null)).toBe(false);
  });

  it("la liste porte nonSurCalendly et la réponse ; l'indice est écrit une fois, chiffré", async () => {
    const db = fausseBase();
    semerRencontreCalendly(db, { reponses: [{ question: QUESTION, answer: "Non" }] });
    const liste = await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "ouvert" });
    await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "ouvert" });
    expect(liste[0]?.nonSurCalendly).toBe(true);
    expect(liste[0]?.reponseCalendly).toBe("Non");
    const indices = db
      .lignes("enregistrementConsentement")
      .filter((c) => c["type"] === "reponse_calendly");
    expect(indices).toHaveLength(1);
    expect(String(indices[0]?.["texteReponse"])).toMatch(/^enc:v1:/);
  });

  it("un refus antérieur de la même adresse allume refusAnterieur", async () => {
    const db = fausseBase();
    const { appareilId } = semerAppareil(db);
    const ancien = semerRencontreCalendly(db, {
      startTime: new Date(T0.getTime() - 20 * 86_400_000),
    });
    semerEnregistrement(db, {
      rencontreId: ancien.rencontreId as string,
      appareilId,
      statut: "refuse",
    });
    semerRencontreCalendly(db);
    const liste = await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "ouvert" });
    expect(liste).toHaveLength(1);
    expect(liste[0]?.refusAnterieur).toBe(true);
  });
});
