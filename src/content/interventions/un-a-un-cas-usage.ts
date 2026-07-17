/**
 * Cas d'usage illustrés des accompagnements 1-to-1 (SSOT).
 *
 * Miroir de `casUsageFr` du catalogue formations (catalog-v2.ts) : 4 cas concrets
 * par accompagnement, chacun avec sa photo et le crédit photographe (Unsplash —
 * crédit obligatoire, CGU §9). Les textes reprennent les bénéfices réels de
 * chaque config (intervention-detail-configs.ts / IndividualCoachingPage) — un
 * seul endroit à éditer pour les deux templates 1-to-1.
 *
 * Photos : `public/illustrations/interventions/un-a-un/<slug>/cas-N.webp`
 * (webp 700×466, même format que les fiches formation).
 */

export interface UnAUnCasUsage {
  texteFr: string;
  texteEn: string;
  imageSrc: string;
  imageCredit: { name: string; url: string };
}

/** Slugs 1-to-1 disposant de cas d'usage illustrés. */
export type UnAUnCasUsageSlug = "dirigeant-vision-strategique" | "coaching-decouverte";

const CAS_USAGE: Record<UnAUnCasUsageSlug, ReadonlyArray<UnAUnCasUsage>> = {
  "dirigeant-vision-strategique": [
    {
      texteFr:
        "Voir clairement où va votre secteur : panorama IA ciblé, mouvements concurrents, signaux faibles",
      texteEn:
        "See clearly where your sector is heading: targeted AI panorama, competitor moves, weak signals",
      imageSrc: "/illustrations/interventions/un-a-un/dirigeant-vision-strategique/cas-1.webp",
      imageCredit: {
        name: "Adeolu Eletu",
        url: "https://unsplash.com/@adeolueletu?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr:
        "Identifier 5 à 10 leviers stratégiques sur votre business model, hiérarchisés par impact et urgence",
      texteEn:
        "Identify 5 to 10 strategic levers on your business model, ranked by impact and urgency",
      imageSrc: "/illustrations/interventions/un-a-un/dirigeant-vision-strategique/cas-2.webp",
      imageCredit: {
        name: "Amy Hirschi",
        url: "https://unsplash.com/@amyhirschi?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Penser différemment votre organisation, vos métiers, votre relation client",
      texteEn: "Think your organisation, your roles and your customer relationship differently",
      imageSrc: "/illustrations/interventions/un-a-un/dirigeant-vision-strategique/cas-3.webp",
      imageCredit: {
        name: "Bethany Legg",
        url: "https://unsplash.com/@bkotynski?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repartir avec une note de cadrage stratégique sous 7 jours",
      texteEn: "Leave with a strategic framing note within 7 days",
      imageSrc: "/illustrations/interventions/un-a-un/dirigeant-vision-strategique/cas-4.webp",
      imageCredit: {
        name: "Mediamodifier",
        url: "https://unsplash.com/@mediamodifier?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  "coaching-decouverte": [
    {
      texteFr:
        "Passer votre poste en revue : vos tâches, vos irritants, votre vraie journée de travail",
      texteEn: "Review your role: your tasks, your friction points, your real working day",
      imageSrc: "/illustrations/interventions/un-a-un/coaching-decouverte/cas-1.webp",
      imageCredit: {
        name: "Andrew Neel",
        url: "https://unsplash.com/@andrewtneel?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Prendre en main les outils essentiels, à votre rythme, sur vos cas",
      texteEn: "Get to grips with the essential tools, at your pace, on your own cases",
      imageSrc: "/illustrations/interventions/un-a-un/coaching-decouverte/cas-2.webp",
      imageCredit: {
        name: "Christin Hume",
        url: "https://unsplash.com/@christinhumephoto?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Maîtriser 3 à 5 méthodes opérationnelles, testées avec vous",
      texteEn: "Master 3 to 5 operational methods, tested with you",
      imageSrc: "/illustrations/interventions/un-a-un/coaching-decouverte/cas-3.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repartir avec un plan d'action chiffré pour aller plus loin",
      texteEn: "Leave with a quantified action plan to go further",
      imageSrc: "/illustrations/interventions/un-a-un/coaching-decouverte/cas-4.webp",
      imageCredit: {
        name: "Annie Spratt",
        url: "https://unsplash.com/@anniespratt?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
};

/** Cas d'usage illustrés d'un accompagnement 1-to-1 ([] si le slug n'en a pas). */
export function getUnAUnCasUsage(slug: string): ReadonlyArray<UnAUnCasUsage> {
  return CAS_USAGE[slug as UnAUnCasUsageSlug] ?? [];
}

/** Toutes les entrées (tests d'intégrité, sitemap images). */
export const UN_A_UN_CAS_USAGE = CAS_USAGE;
