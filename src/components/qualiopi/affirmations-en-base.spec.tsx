/**
 * Contenus EN BASE (articles de blog, FAQ issues des articles, offres d'emploi)
 * qui parlent de la certification Qualiopi d'Axion-IA — audit initial du
 * 16/10/2026, certification NON obtenue.
 *
 * Ces textes ne peuvent pas lire l'interrupteur : ils sont neutralisés AU RENDU,
 * selon `isQualiopiCertificationObtenue()`. La base n'est pas modifiée ; le jour
 * où l'interrupteur passe à `true`, le texte d'origine revient seul.
 *
 * Les phrases ci-dessous sont copiées des pages servies le 14/10/2026
 * (`/fr/blog/*`, `/fr/carrieres/responsable-qualite-qualiopi`).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { neutraliserAffirmationsQualiopi } from "./affirmations-en-base";
import { QualiopiContentBadge } from "./QualiopiContentBadge";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

// ── Phrases relevées en ligne ───────────────────────────────────────────────
const NANTERRE_ENCADRE =
  '<aside class="callout callout-info"><p class="callout-label">À noter</p><p>Axion-IA est un cabinet de conseil opérationnel, non un organisme de formation certifié Qualiopi. Si la prise en charge OPCO est un critère décisif pour votre structure, orientez-vous vers les alternatives 3 ou 5 ci-dessous.</p></aside>';
const NANTERRE_FAQ =
  "Axion-IA n'est pas certifié Qualiopi, ce qui exclut la prise en charge directe par les OPCO ou le CPF pour nos programmes. Si ce financement est impératif pour votre structure, nous recommandons de combiner un organisme Qualiopi pour le volet théorique avec notre accompagnement opérationnel pour le volet implémentation.";
const NANTERRE_TABLEAU =
  "<tr>\n      <td><strong>Financement OPCO</strong></td>\n      <td>⚠️ Non (hors Qualiopi)</td>\n      <td>✅ partiel</td>\n    </tr>";
const SAINT_DENIS_TABLEAU =
  '<tr>\n      <td>Certification Qualiopi</td>\n      <td>Vérifier sur <a href="/tarifs">page Tarifs</a></td>\n      <td>Souvent oui (vérifier au cas par cas)</td>\n    </tr>';
const TOURCOING =
  "<p>Plusieurs dispositifs permettent de financer une formation IA à Tourcoing : le Compte Personnel de Formation pour les salariés, les fonds OPCO pour les entreprises, et les aides régionales Hauts-de-France — à condition que le prestataire soit certifié Qualiopi, ce qui est la règle pour tout organisme sérieux.</p>";
const OFFRE_VOUS =
  "<p>Ce poste est fait pour vous si vous voulez être la gardienne ou le gardien de notre certification Qualiopi et tirer toute la boîte vers le haut.</p>";
const OFFRE_TU =
  "Ce poste, c'est le tien si tu veux être la gardienne ou le gardien de notre certification Qualiopi et tirer toute la boîte vers le haut.";

/** Ce qui, pour un lecteur, revient à dire « Axion-IA est (ou n'est pas) certifié ». */
const AFFIRMATIONS = [
  /non un organisme de formation certifi/i,
  /n'est pas certifi[ée] Qualiopi/i,
  /hors Qualiopi/i,
  /Vérifier sur <a[^>]*>page Tarifs/i,
  /la règle pour tout organisme sérieux/i,
  /gardien de notre certification/i,
];

function sansAffirmation(texte: string): string[] {
  return AFFIRMATIONS.filter((r) => r.test(texte)).map(String);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("contenus en base — interrupteur ÉTEINT (certification non obtenue)", () => {
  it("aucune phrase relevée n'affirme ni ne nie la certification d'Axion-IA", () => {
    for (const phrase of [
      NANTERRE_ENCADRE,
      NANTERRE_FAQ,
      NANTERRE_TABLEAU,
      SAINT_DENIS_TABLEAU,
      TOURCOING,
      OFFRE_VOUS,
      OFFRE_TU,
    ]) {
      expect(sansAffirmation(neutraliserAffirmationsQualiopi(phrase, false)), phrase).toEqual([]);
    }
  });

  it("le tableau de Saint-Denis dit « En cours » pour Axion-IA", () => {
    expect(neutraliserAffirmationsQualiopi(SAINT_DENIS_TABLEAU, false)).toContain(
      "<td>Certification Qualiopi</td>\n      <td>En cours</td>",
    );
  });

  it("l'offre de responsable qualité parle d'une démarche à mener, pas d'un certificat détenu", () => {
    expect(neutraliserAffirmationsQualiopi(OFFRE_VOUS, false)).toContain(
      "si vous voulez porter notre démarche de certification Qualiopi jusqu'à son obtention et tirer",
    );
  });

  it("les phrases purement informatives sur le dispositif restent", () => {
    const info =
      "La mobilisation du CPF ou des fonds OPCO nécessite que l'organisme soit certifié Qualiopi.";
    expect(neutraliserAffirmationsQualiopi(info, false)).toBe(info);
  });

  it("traverse un objet chargé de la base (corps, FAQ) sans toucher aux dates", () => {
    const publieLe = new Date("2026-05-01T00:00:00Z");
    const vue = {
      slug: "alternatives-formation-ia-nanterre",
      body: NANTERRE_ENCADRE,
      publishedAt: publieLe,
      faqItems: [
        { question: "Les formations Axion-IA sont-elles finançables ?", answer: NANTERRE_FAQ },
      ],
    };
    const rendu = neutraliserAffirmationsQualiopi(vue, false);
    expect(rendu.publishedAt).toBe(publieLe);
    expect(rendu.slug).toBe(vue.slug);
    expect(sansAffirmation(rendu.body)).toEqual([]);
    expect(sansAffirmation(rendu.faqItems[0]!.answer)).toEqual([]);
  });

  it("le badge de fin d'article ne revendique ni la certification ni la marque", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    const html = renderToStaticMarkup(<QualiopiContentBadge locale="fr" />);
    expect(html).not.toMatch(/Qualiopi/);
    expect(html).not.toMatch(/démarche qualité alignée/);
    expect(html).toContain("certification qualité");
  });
});

describe("contenus en base — interrupteur ALLUMÉ (certificat délivré)", () => {
  it("les affirmations d'origine reviennent sans autre changement", () => {
    for (const phrase of [SAINT_DENIS_TABLEAU, TOURCOING, OFFRE_VOUS, OFFRE_TU]) {
      expect(neutraliserAffirmationsQualiopi(phrase, true)).toBe(phrase);
    }
  });

  it("les NÉGATIONS ne reviennent pas : elles deviendraient fausses le jour du certificat", () => {
    for (const phrase of [NANTERRE_ENCADRE, NANTERRE_FAQ, NANTERRE_TABLEAU]) {
      const rendu = neutraliserAffirmationsQualiopi(phrase, true);
      expect(rendu).toBe(neutraliserAffirmationsQualiopi(phrase, false));
      expect(sansAffirmation(rendu)).toEqual([]);
    }
  });

  it("le badge de fin d'article redevient le badge certifié d'origine", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    const html = renderToStaticMarkup(<QualiopiContentBadge locale="fr" />);
    expect(html).toContain("organisme de formation certifié Qualiopi");
  });
});
