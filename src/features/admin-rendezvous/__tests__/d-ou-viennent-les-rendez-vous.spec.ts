/**
 * « Rendez-vous par origine » (2026-10-05) : Will lit d'où viennent ceux qui
 * réservent. Ce test garde la lecture PURE de la réponse à « Comment nous
 * avez-vous connu ? » : tolérante (casse, accents, reformulation), sans jamais
 * lever, valeurs inconnues rangées en « Autre / non classé », réservations
 * anciennes en « Sans réponse », croisement avec les UTM.
 */
import { describe, expect, it } from "vitest";

import {
  agregerOrigines,
  classerReponse,
  estQuestionOrigine,
  lireOrigine,
  lundiDe,
  total,
  type LigneOrigineBrute,
} from "../origine-rendez-vous";

const Q = "Comment nous avez-vous connu ?";

describe("la question d'origine est reconnue sans être exacte", () => {
  it.each([
    Q,
    "COMMENT NOUS AVEZ VOUS CONNU",
    "Comment nous avez-vous connus ?",
    "comment avez-vous connu axion",
  ])("reconnaît %s", (q) => expect(estQuestionOrigine(q)).toBe(true));
  it("ignore les autres questions", () => {
    expect(estQuestionOrigine("Quel est votre besoin ?")).toBe(false);
  });
});

describe("chaque réponse de la liste va dans sa source", () => {
  it.each([
    ["Instagram", "instagram"],
    ["LinkedIn", "linkedin"],
    ["Facebook", "facebook"],
    ["Recherche Google", "google"],
    ["Bouche-à-oreille", "bouche_a_oreille"],
    ["Un apporteur d'affaires", "apporteur"],
    ["ChatGPT ou une autre IA", "ia"],
    ["E-mail reçu", "email"],
    ["Autre", "autre"],
    ["recherche GOOGLE", "google"],
    ["bouche a oreille", "bouche_a_oreille"],
    ["Un podcast", "autre"],
    ["", "autre"],
  ])("%s → %s", (reponse, attendu) => {
    expect(classerReponse(reponse)).toBe(attendu);
  });
});

describe("lireOrigine ne lève jamais", () => {
  it("lit la réponse dans la liste", () => {
    expect(
      lireOrigine([
        { question: "Votre besoin", answer: "x" },
        { question: Q, answer: "Instagram" },
      ]),
    ).toBe("instagram");
  });
  it.each([
    null,
    undefined,
    "texte",
    42,
    {},
    [],
    [null, 3, "x"],
    [{ question: Q }],
    [{ question: Q, answer: "  " }],
  ])("sans réponse exploitable → sans_reponse (%j)", (brut) =>
    expect(lireOrigine(brut)).toBe("sans_reponse"),
  );
});

describe("lundiDe", () => {
  it("rend le lundi de la semaine à Paris", () => {
    expect(lundiDe(new Date("2026-10-05T10:00:00Z"))).toBe("2026-10-05"); // lundi
    expect(lundiDe(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-05"); // dimanche 23 h 30 à Paris
    expect(lundiDe(new Date("2026-10-11T22:30:00Z"))).toBe("2026-10-12"); // lundi 00 h 30 à Paris
  });
});

function ligne(p: Partial<LigneOrigineBrute>): LigneOrigineBrute {
  return {
    typeRendezVous: "diagnostic",
    eventTypeName: "Diagnostic IA",
    capturedAt: "2026-10-01T10:00:00Z",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    qa: [{ question: Q, answer: "Instagram" }],
    ...p,
  };
}

describe("agregerOrigines", () => {
  const maintenant = new Date("2026-10-05T12:00:00Z");

  it("sans ligne : tout à zéro, des semaines quand même, pas d'erreur", () => {
    const b = agregerOrigines([], 30, maintenant);
    expect(total(b.total)).toBe(0);
    expect(b.semaines.length).toBeGreaterThanOrEqual(4);
    expect(b.utm).toEqual([]);
    expect(b.sansUtm).toBe(0);
  });

  it("ventile par type, par origine et par semaine, sans réponse à part", () => {
    const b = agregerOrigines(
      [
        ligne({}),
        ligne({ qa: [{ question: Q, answer: "Facebook" }], typeRendezVous: "echange_projet" }),
        ligne({ qa: null, capturedAt: "2026-09-10T10:00:00Z" }),
        ligne({ qa: [{ question: Q, answer: "Un podcast" }] }),
      ],
      30,
      maintenant,
    );
    expect(b.total.instagram).toBe(1);
    expect(b.total.facebook).toBe(1);
    expect(b.total.sans_reponse).toBe(1);
    expect(b.total.autre).toBe(1);
    expect(b.parType.map((x) => x.type)).toEqual(["diagnostic", "echange_projet"]);
    const sem = b.semaines.find((s) => s.lundi === "2026-09-28");
    expect(sem && total(sem.compteurs)).toBe(3);
    expect(b.semaines.at(-1)?.lundi).toBe("2026-10-05");
  });

  it("croise avec les UTM (casse ignorée) et compte les réservations sans UTM", () => {
    const b = agregerOrigines(
      [
        ligne({ utmSource: "Facebook", utmMedium: "cpc", utmCampaign: "vsl" }),
        ligne({ utmSource: "facebook", utmMedium: "CPC", utmCampaign: "vsl", qa: null }),
        ligne({}),
      ],
      30,
      maintenant,
    );
    expect(b.utm).toHaveLength(1);
    expect(b.utm[0]).toMatchObject({ source: "facebook", medium: "cpc", campagne: "vsl", n: 2 });
    expect(b.utm[0]?.origines.instagram).toBe(1);
    expect(b.utm[0]?.origines.sans_reponse).toBe(1);
    expect(b.sansUtm).toBe(1);
  });

  it("un rendez-vous annulé n'est compté nulle part, mais il est dénombré à part", () => {
    const b = agregerOrigines(
      [
        ligne({ status: "canceled", utmSource: "facebook", utmCampaign: "vsl" }),
        ligne({
          status: "canceled",
          typeRendezVous: "salon",
          qa: [{ question: Q, answer: "E-mail reçu" }],
        }),
        // contre-témoins : un actif et un absent sont toujours comptés
        ligne({ status: "active", utmSource: "facebook", utmCampaign: "vsl" }),
        ligne({ status: "no_show", qa: [{ question: Q, answer: "LinkedIn" }] }),
      ],
      30,
      maintenant,
    );
    expect(b.annules).toBe(2);
    expect(total(b.total)).toBe(2);
    expect(b.total.email).toBe(0);
    expect(b.total.linkedin).toBe(1);
    expect(b.parType.map((x) => x.type)).not.toContain("salon");
    const sem = b.semaines.find((s) => s.lundi === "2026-09-28");
    expect(sem && total(sem.compteurs)).toBe(2);
    expect(b.utm).toHaveLength(1);
    expect(b.utm[0]?.n).toBe(1);
    expect(b.sansUtm).toBe(1);
  });

  it("sans annulé : le compteur reste à zéro", () => {
    expect(agregerOrigines([ligne({})], 30, maintenant).annules).toBe(0);
  });
});
