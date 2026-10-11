import { describe, expect, it } from "vitest";

import type { JobOffer } from "../../../../prisma/generated/client";
import { buildFaqJsonLd } from "@/lib/seo";

import { buildOfferFaq } from "../faq-offre";
import { buildOfferFaqFreelance } from "../faq-offre-freelance";

const offre = (surcharge: Record<string, unknown>): JobOffer =>
  ({
    city: null,
    jobLocations: null,
    applicantCountries: [],
    workMode: "remote",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
    contractLabel: null,
    isCommission: false,
    salaryVisible: true,
    salaryMin: 41000,
    salaryMax: 85000,
    salaryPeriod: "YEAR",
    salaryCurrency: "EUR",
    ...surcharge,
  }) as unknown as JobOffer;

const MOTS_INTERDITS =
  /poste|entretien|recrutement|salaire|r[ée]mun[ée]ration|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i;

const freelance = (surcharge: Record<string, unknown> = {}) =>
  offre({
    employmentType: "CONTRACTOR",
    salaryMin: 350,
    salaryMax: null,
    salaryPeriod: "DAY",
    city: "Grenoble",
    ...surcharge,
  });

describe("FAQ d'une offre — non-régression (interrupteur absent, offre salariée)", () => {
  it("la FAQ générique reste celle d'aujourd'hui, mot pour mot", () => {
    const o = offre({ city: "Grenoble", workMode: "hybrid" });
    expect(buildOfferFaq(o, "Formateur IA", true)).toMatchInlineSnapshot(`
      [
        {
          "answer": "Ce poste est en hybride : une partie en présentiel à Grenoble et une partie en télétravail.",
          "id": "teletravail",
          "question": "Le poste de Formateur IA est-il en télétravail ?",
        },
        {
          "answer": "Il s'agit d'un poste en CDI temps plein.",
          "id": "contrat",
          "question": "Quel est le type de contrat ?",
        },
        {
          "answer": "La rémunération proposée est de 41k–85k EUR /an, selon votre profil et votre expérience.",
          "id": "remuneration",
          "question": "Quelle est la rémunération ?",
        },
        {
          "answer": "Vous postulez en ligne en quelques minutes via le bouton « Postuler ». Le CV est optionnel : ce qui compte, c'est votre motivation et ce que vous savez faire. Nous préparons nos prochains recrutements : chaque candidature est étudiée et conservée pour le moment où ce poste s'ouvrira.",
          "id": "candidature",
          "question": "Comment postuler à cette offre ?",
        },
      ]
    `);
    // JSON-LD : les mêmes questions/réponses (l'URL du site, elle, dépend de l'environnement).
    const items = buildOfferFaq(o, "Formateur IA", true);
    expect(buildFaqJsonLd({ items }).mainEntity).toEqual(
      items.map((i) => ({
        "@type": "Question",
        name: i.question,
        acceptedAnswer: { "@type": "Answer", text: i.answer },
      })),
    );
  });

  it("offre à zone nationale, multi-pays", () => {
    const o = offre({
      jobLocations: [{ city: "Lyon" }, { city: "Lille" }],
      applicantCountries: ["FR", "BE", "CH"],
    });
    expect(buildOfferFaq(o, "Formateur IA", true)).toMatchInlineSnapshot(`
      [
        {
          "answer": "Le poste couvre toute la France — interventions organisées par secteurs autour de 2 villes (Lyon, Lille…).",
          "id": "teletravail",
          "question": "Où s'exerce le poste de Formateur IA ?",
        },
        {
          "answer": "Il s'agit d'un poste en CDI temps plein.",
          "id": "contrat",
          "question": "Quel est le type de contrat ?",
        },
        {
          "answer": "Les candidatures sont ouvertes depuis France, Belgique et Suisse. Le travail se fait intégralement à distance, en français.",
          "id": "pays",
          "question": "Depuis quels pays peut-on postuler à cette offre ?",
        },
        {
          "answer": "La rémunération proposée est de 41k–85k EUR /an, selon votre profil et votre expérience.",
          "id": "remuneration",
          "question": "Quelle est la rémunération ?",
        },
        {
          "answer": "Vous postulez en ligne en quelques minutes via le bouton « Postuler ». Le CV est optionnel : ce qui compte, c'est votre motivation et ce que vous savez faire. Nous préparons nos prochains recrutements : chaque candidature est étudiée et conservée pour le moment où ce poste s'ouvrira.",
          "id": "candidature",
          "question": "Comment postuler à cette offre ?",
        },
      ]
    `);
  });
});

describe("FAQ de l'offre freelance — lexique", () => {
  const cas: Array<[string, JobOffer]> = [
    ["à distance", freelance()],
    ["présentiel, une ville", freelance({ workMode: "onsite" })],
    ["hybride", freelance({ workMode: "hybrid" })],
    ["zone nationale", freelance({ jobLocations: [{ city: "Grenoble" }, { city: "Lyon" }] })],
    ["multi-pays", freelance({ applicantCountries: ["FR", "BE", "CH"] })],
    ["sans tarif visible", freelance({ salaryVisible: false })],
  ];

  for (const [nom, o] of cas) {
    for (const isFr of [true, false]) {
      it(`${nom} (${isFr ? "fr" : "en"}) : ni le texte ni le JSON-LD ne contiennent un mot interdit`, () => {
        const items = buildOfferFaqFreelance(o, isFr);
        expect(items.length).toBeGreaterThanOrEqual(4);
        expect(JSON.stringify(items)).not.toMatch(MOTS_INTERDITS);
        expect(JSON.stringify(buildFaqJsonLd({ items }))).not.toMatch(MOTS_INTERDITS);
        expect(JSON.stringify(items)).not.toMatch(/selon votre profil/i);
      });
    }
  }

  it("dit la mission, les honoraires, le statut indépendant et comment proposer ses services", () => {
    const items = buildOfferFaqFreelance(freelance(), true);
    expect(items.map((i) => i.id)).toEqual([
      "mission",
      "lieu",
      "statut",
      "honoraires",
      "candidature",
    ]);
    expect(items.find((i) => i.id === "honoraires")?.answer).toBe(
      "Les honoraires sont de 350 EUR /jour.",
    );
    expect(items.find((i) => i.id === "statut")?.answer).toMatch(/indépendant/);
    expect(items.find((i) => i.id === "candidature")?.question).toBe(
      "Comment proposer ses services ?",
    );
  });

  it("sans tarif visible, aucune question d'honoraires", () => {
    const ids = buildOfferFaqFreelance(freelance({ salaryVisible: false }), true).map((i) => i.id);
    expect(ids).not.toContain("honoraires");
  });
});

describe("la FAQ générique, elle, garde ses mots (preuve que le test de lexique discrimine)", () => {
  it("contient « poste » et « rémunération »", () => {
    expect(JSON.stringify(buildOfferFaq(offre({}), "Formateur IA", true))).toMatch(MOTS_INTERDITS);
  });
});
