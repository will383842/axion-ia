/**
 * SSOT — Photos Unsplash des cartes/fiches formations (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-formations-cards-unsplash.mjs. Photos
 * téléchargées en local (public/illustrations/formations/fiches/<slug>/card.avif,
 * 0 hotlink). Attribution photographe OBLIGATOIRE au rendu (CGU Unsplash §9) —
 * consommé par catalog-v2-facts.ts (getFormationImage / getFormationImageCredit).
 * Clé = slugFr du catalogue (catalog-v2.ts).
 */

export interface FormationCardPhoto {
  /** Chemin public local (AVIF 1280×800). */
  src: string;
  /** Alt FR descriptif (base SEO — enrichi côté rendu par le titre). */
  alt: string;
  credit: { name: string; url: string };
}

export const FORMATION_CARD_PHOTOS: Readonly<Record<string, FormationCardPhoto>> = {
  "ia-pour-bien-commencer-journee": {
    src: "/illustrations/formations/fiches/ia-pour-bien-commencer-journee/card.avif",
    alt: "woman and man sitting in front of monitor",
    credit: { name: "X", url: "https://unsplash.com/@disruptxn" },
  },
  "ia-pour-les-equipes": {
    src: "/illustrations/formations/fiches/ia-pour-les-equipes/card.avif",
    alt: "group of people using laptop computer",
    credit: { name: "Annie Spratt", url: "https://unsplash.com/@anniespratt" },
  },
  "ia-pour-l-automatisation": {
    src: "/illustrations/formations/fiches/ia-pour-l-automatisation/card.avif",
    alt: "two colleagues discussing ideas at whiteboard",
    credit: { name: "ThisisEngineering", url: "https://unsplash.com/@thisisengineering" },
  },
  "ia-pour-les-rh": {
    src: "/illustrations/formations/fiches/ia-pour-les-rh/card.avif",
    alt: "Two women shaking hands across a desk",
    credit: { name: "Vitaly Gariev", url: "https://unsplash.com/@silverkblack" },
  },
  "ia-pour-le-marketing": {
    src: "/illustrations/formations/fiches/ia-pour-le-marketing/card.avif",
    alt: "three men laughing while looking in the laptop inside room",
    credit: { name: "Priscilla Du Preez 🇨🇦", url: "https://unsplash.com/@priscilladupreez" },
  },
  "ia-pour-les-commerciaux": {
    src: "/illustrations/formations/fiches/ia-pour-les-commerciaux/card.avif",
    alt: "two people shaking hands",
    credit: { name: "Cytonn Photography", url: "https://unsplash.com/@cytonn_photography" },
  },
  "ia-pour-la-finance": {
    src: "/illustrations/formations/fiches/ia-pour-la-finance/card.avif",
    alt: "person holding paper near pen and calculator",
    credit: { name: "Kelly Sikkema", url: "https://unsplash.com/@kellysikkema" },
  },
  "ia-pour-le-juridique": {
    src: "/illustrations/formations/fiches/ia-pour-le-juridique/card.avif",
    alt: "person writing on white paper",
    credit: { name: "Cytonn Photography", url: "https://unsplash.com/@cytonn_photography" },
  },
  "ia-pour-la-production": {
    src: "/illustrations/formations/fiches/ia-pour-la-production/card.avif",
    alt: "a group of people in a factory",
    credit: { name: "Arno Senoner", url: "https://unsplash.com/@arnosenoner" },
  },
  "ia-pour-les-achats": {
    src: "/illustrations/formations/fiches/ia-pour-les-achats/card.avif",
    alt: "woman walking at the hallway",
    credit: { name: "Sikai Gu", url: "https://unsplash.com/@gentle_kay" },
  },
  "ia-pour-la-relation-client": {
    src: "/illustrations/formations/fiches/ia-pour-la-relation-client/card.avif",
    alt: "people working at desks in open office",
    credit: { name: "Arlington Research", url: "https://unsplash.com/@arlington_research" },
  },
  "ia-pour-l-it": {
    src: "/illustrations/formations/fiches/ia-pour-l-it/card.avif",
    alt: "man sitting in front of table",
    credit: { name: "Arlington Research", url: "https://unsplash.com/@arlington_research" },
  },
  "ia-pour-la-sante": {
    src: "/illustrations/formations/fiches/ia-pour-la-sante/card.avif",
    alt: "white wooden desk on hallway inside building",
    credit: { name: "Brandon Holmes", url: "https://unsplash.com/@brankotsu" },
  },
  "ia-pour-le-btp": {
    src: "/illustrations/formations/fiches/ia-pour-le-btp/card.avif",
    alt: "red hard hat on pavement\\",
    credit: { name: "Ümit Yıldırım", url: "https://unsplash.com/@umityildirim" },
  },
  "ia-pour-l-immobilier": {
    src: "/illustrations/formations/fiches/ia-pour-l-immobilier/card.avif",
    alt: "white and red wooden house miniature on brown table",
    credit: { name: "Tierra Mallorca", url: "https://unsplash.com/@tierramallorca" },
  },
  "ia-pour-le-commerce": {
    src: "/illustrations/formations/fiches/ia-pour-le-commerce/card.avif",
    alt: "man in grey crew-neck t-shirt smiling to woman on counter",
    credit: { name: "Clay Banks", url: "https://unsplash.com/@claybanks" },
  },
  "ia-pour-l-hotellerie-restauration": {
    src: "/illustrations/formations/fiches/ia-pour-l-hotellerie-restauration/card.avif",
    alt: "man pick some food at buffet table",
    credit: { name: "Ye Chen", url: "https://unsplash.com/@yeeu" },
  },
  "ia-pour-l-industrie": {
    src: "/illustrations/formations/fiches/ia-pour-l-industrie/card.avif",
    alt: "grayscale photo of man doing mechanical work",
    credit: { name: "Museums Victoria", url: "https://unsplash.com/@museumsvictoria" },
  },
  "ia-pour-le-transport-logistique": {
    src: "/illustrations/formations/fiches/ia-pour-le-transport-logistique/card.avif",
    alt: "aerial view of vehicles in parking area",
    credit: { name: "Marcin Jozwiak", url: "https://unsplash.com/@marcinjozwiak" },
  },
  "ia-pour-la-banque-assurance": {
    src: "/illustrations/formations/fiches/ia-pour-la-banque-assurance/card.avif",
    alt: "person in black suit jacket holding white tablet computer",
    credit: { name: "Towfiqu barbhuiya", url: "https://unsplash.com/@towfiqu999999" },
  },
  "ia-pour-bien-commencer": {
    src: "/illustrations/formations/fiches/ia-pour-bien-commencer/card.avif",
    alt: "man smiling while sitting and using MacBook",
    credit: { name: "Csaba Balazs", url: "https://unsplash.com/@balazscsaba2006" },
  },
  "seminaire-ia-toute-l-entreprise-1j": {
    src: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/card.avif",
    alt: "crowd of people sitting on chairs inside room",
    credit: { name: "Headway", url: "https://unsplash.com/@headwayio" },
  },
};
