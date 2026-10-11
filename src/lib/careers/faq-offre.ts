// FAQ des offres /carrieres/[slug] — module pur (sorti de la page pour être testé).
// La FAQ générique est reprise À L'IDENTIQUE ; la variante freelance est dans
// `faq-offre-freelance.ts`.

import type { JobOffer } from "../../../prisma/generated/client";
import {
  applicantCountryLabel,
  contractTypeLabel,
  normalizeApplicantCountries,
  salaryLabel,
} from "./format";

export type FaqOffreItem = { id: string; question: string; answer: string };

/**
 * Ce que l'annonce dit de la disponibilité du poste (décision de Will,
 * 2026-10-11). Les annonces restent en ligne pour constituer un vivier : aucun
 * poste n'est forcément ouvert le jour où la personne postule, et l'entreprise
 * ne recrute pas encore régulièrement — ne PAS écrire « nous recrutons
 * régulièrement », ce serait faux. Le Code du travail (art. L5331-3) interdit
 * de laisser croire qu'un poste est disponible ; cette phrase dit ce qui est,
 * sans bandeau.
 */
export const RECRUTEMENT_REGULIER = {
  fr: "Nous préparons nos prochains recrutements : chaque candidature est étudiée et conservée pour le moment où ce poste s'ouvrira.",
  en: "We are preparing our next hires: every application is reviewed and kept for when this role opens.",
} as const;

// FAQ par offre (AEO / AI Overviews) : questions/réponses FACTUELLES dérivées des
// données réelles de l'offre (mode de travail, contrat, salaire, candidature) →
// unique par offre (anti-thin/anti-doorway), rien d'inventé. Rendu via FaqAccordion
// (CSS-only, 0 JS) qui émet le JSON-LD FAQPage.
export function buildOfferFaq(
  o: JobOffer,
  title: string,
  isFr: boolean,
): Array<{ id: string; question: string; answer: string }> {
  const items: Array<{ id: string; question: string; answer: string }> = [];
  const cityPart = o.city ? (isFr ? ` à ${o.city}` : ` in ${o.city}`) : "";

  // Pays éligibles calculés AVANT la réponse télétravail : quand une offre à
  // distance est ouverte hors de France (`applicant_countries`), dire « ouvert
  // partout en France » contredit la réponse « pays » trois questions plus bas —
  // et c'est la phrase que reprend un moteur de réponse.
  const countries = normalizeApplicantCountries(o.applicantCountries);
  const countryNames = countries.map((c) => applicantCountryLabel(c, isFr));

  // Villes du poste (multi-lieux) : un poste à zone nationale ne doit pas
  // répondre « en présentiel à Grenoble » — c'est la question n°1 d'un candidat
  // hors Isère, et la réponse que reprennent les moteurs de réponse.
  const faqCities = Array.isArray(o.jobLocations)
    ? (o.jobLocations as Array<{ city?: string }>)
        .map((l) => l.city)
        .filter((c): c is string => Boolean(c))
    : [];

  const remoteScope =
    countries.length > 1
      ? isFr
        ? `ouvert depuis ${countries.length} pays francophones (${countryNames.slice(0, 5).join(", ")}…)`
        : `open from ${countries.length} French-speaking countries (${countryNames.slice(0, 5).join(", ")}…)`
      : isFr
        ? "ouvert partout en France"
        : "open across France";
  const modeAnswer =
    faqCities.length > 1
      ? isFr
        ? `Le poste couvre toute la France — interventions organisées par secteurs autour de ${faqCities.length} villes (${faqCities.slice(0, 5).join(", ")}…)${o.city ? `, avec un rattachement à ${o.city}` : ""}.`
        : `The role covers all of France — organised by sector around ${faqCities.length} cities (${faqCities.slice(0, 5).join(", ")}…)${o.city ? `, with a home base in ${o.city}` : ""}.`
      : o.workMode === "remote"
        ? isFr
          ? `Oui, ce poste est en télétravail (à distance), ${remoteScope}.`
          : `Yes, this role is fully remote, ${remoteScope}.`
        : o.workMode === "hybrid"
          ? isFr
            ? `Ce poste est en hybride : une partie en présentiel${cityPart} et une partie en télétravail.`
            : `This role is hybrid: partly on-site${cityPart} and partly remote.`
          : isFr
            ? `Ce poste est en présentiel${cityPart}.`
            : `This role is on-site${cityPart}.`;
  items.push({
    id: "teletravail",
    question:
      faqCities.length > 1
        ? isFr
          ? `Où s'exerce le poste de ${title} ?`
          : `Where is the ${title} role based?`
        : isFr
          ? `Le poste de ${title} est-il en télétravail ?`
          : `Is the ${title} role remote?`,
    answer: modeAnswer,
  });

  // Libellé traduit (SSOT `format.ts`) : sans lui, l'enum schema.org brut
  // fuitait en façade (« Il s'agit d'un poste en CONTRACTOR »). `null` si le
  // type est inconnu → on n'émet pas la question plutôt que d'afficher un code.
  const contract = contractTypeLabel(o, isFr);
  if (contract) {
    items.push({
      id: "contrat",
      question: isFr ? "Quel est le type de contrat ?" : "What type of contract is it?",
      answer: isFr ? `Il s'agit d'un poste en ${contract}.` : `This is a ${contract} position.`,
    });
  }

  // Pays éligibles (AEO) : « Puis-je postuler depuis le Maroc ? » est LA question
  // d'un candidat francophone hors de France devant une offre à distance.
  if (countries.length > 1) {
    const names = countryNames;
    const listed = isFr
      ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    items.push({
      id: "pays",
      question: isFr
        ? "Depuis quels pays peut-on postuler à cette offre ?"
        : "Which countries can I apply from?",
      answer: isFr
        ? `Les candidatures sont ouvertes depuis ${listed}. Le travail se fait intégralement à distance, en français.`
        : `Applications are open from ${listed}. The role is fully remote and works in French.`,
    });
  }

  const sal = salaryLabel(o, isFr);
  if (sal) {
    items.push({
      id: "remuneration",
      question: isFr ? "Quelle est la rémunération ?" : "What is the salary?",
      answer: isFr
        ? `La rémunération proposée est de ${sal}, selon votre profil et votre expérience.`
        : `The offered pay is ${sal}, depending on your profile and experience.`,
    });
  }

  items.push({
    id: "candidature",
    question: isFr ? "Comment postuler à cette offre ?" : "How do I apply?",
    answer: isFr
      ? `Vous postulez en ligne en quelques minutes via le bouton « Postuler ». Le CV est optionnel : ce qui compte, c'est votre motivation et ce que vous savez faire. ${RECRUTEMENT_REGULIER.fr}`
      : `Apply online in a few minutes via the « Apply » button. A CV is optional — what matters is your motivation and skills. ${RECRUTEMENT_REGULIER.en}`,
  });

  return items;
}
