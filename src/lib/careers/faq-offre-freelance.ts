// FAQ de l'offre de formateur indépendant (lot L0c-1) — une MISSION, pas un
// emploi. Servie seulement quand `formateurs.formulaire_freelance` est allumé
// ET que l'offre est une offre de formateur freelance (`modeFormateurFreelance`) ;
// sinon la page garde `buildOfferFaq`, à l'identique.
//
// Même liste pour l'affichage et pour le JSON-LD FAQPage (FaqBlock). Lexique :
// ni poste, ni entretien, ni recrutement, ni salaire, ni rémunération, ni
// ville nommée — verrouillé par `__tests__/faq-offre.spec.ts`. Module PUR.

import type { JobOffer } from "../../../prisma/generated/client";
import type { FaqOffreItem } from "./faq-offre";
import { applicantCountryLabel, normalizeApplicantCountries, salaryLabel } from "./format";

export function buildOfferFaqFreelance(o: JobOffer, isFr: boolean): FaqOffreItem[] {
  const items: FaqOffreItem[] = [];

  items.push({
    id: "mission",
    question: isFr ? "En quoi consiste la mission ?" : "What does the assignment involve?",
    answer: isFr
      ? "Vous animez des formations à l'intelligence artificielle pour les clients d'Axion-IA, en tant que formateur indépendant, à la journée."
      : "You run AI training sessions for Axion-IA's clients as an independent trainer, paid by the day.",
  });

  const countries = normalizeApplicantCountries(o.applicantCountries);
  const nbVilles = Array.isArray(o.jobLocations)
    ? (o.jobLocations as Array<{ city?: string }>).filter((l) => Boolean(l.city)).length
    : 0;
  const lieu =
    nbVilles > 1
      ? isFr
        ? `La mission couvre toute la France, avec des interventions autour de ${nbVilles} villes.`
        : `The assignment covers all of France, with sessions around ${nbVilles} cities.`
      : o.workMode === "remote"
        ? isFr
          ? "La mission se fait à distance."
          : "The assignment is carried out remotely."
        : o.workMode === "hybrid"
          ? isFr
            ? "La mission alterne présentiel et distance."
            : "The assignment mixes on-site and remote work."
          : isFr
            ? "La mission se déroule en présentiel, chez le client."
            : "The assignment takes place on-site, at the client.";
  items.push({
    id: "lieu",
    question: isFr ? "Où se déroule la mission ?" : "Where does the assignment take place?",
    answer: lieu,
  });

  items.push({
    id: "statut",
    question: isFr ? "Quel est le statut ?" : "What is the status?",
    answer: isFr
      ? "Vous intervenez en tant que formateur indépendant et facturez vos journées à Axion-IA."
      : "You work as an independent trainer and invoice your days to Axion-IA.",
  });

  const tarif = salaryLabel(o, isFr);
  if (tarif) {
    items.push({
      id: "honoraires",
      question: isFr ? "Quels sont les honoraires ?" : "What are the fees?",
      answer: isFr ? `Les honoraires sont de ${tarif}.` : `The fee is ${tarif}.`,
    });
  }

  if (countries.length > 1) {
    const noms = countries.map((c) => applicantCountryLabel(c, isFr));
    const liste = isFr
      ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`
      : `${noms.slice(0, -1).join(", ")} and ${noms[noms.length - 1]}`;
    items.push({
      id: "pays",
      question: isFr
        ? "Depuis quels pays peut-on proposer ses services ?"
        : "Which countries can I apply from?",
      answer: isFr
        ? `Les candidatures sont ouvertes depuis ${liste}.`
        : `Applications are open from ${liste}.`,
    });
  }

  items.push({
    id: "candidature",
    question: isFr ? "Comment proposer ses services ?" : "How do I offer my services?",
    answer: isFr
      ? "Vous envoyez votre candidature en ligne en quelques minutes, via le bouton « Postuler » : un formulaire en quatre blocs courts, sans lettre ni photo."
      : "Send your application online in a few minutes via the « Apply » button: a short four-part form, no cover letter or photo.",
  });

  return items;
}
