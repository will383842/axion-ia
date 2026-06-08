// Saint-Denis (93066) — data économique sourcée (ciblée recrutement commercial).
//
// Créé 2026-06-08 pour compléter le 40e hub /devenir-commercial-ia (était le
// seul des 40 sans economic-data → noindex). Contrat zéro invention : seuls les
// champs réellement sourçables sont renseignés ; les autres sont omis (tous
// optionnels sauf lastReviewedOn/reviewedBy).
//
// Sources :
//   - INSEE dossier complet commune 93066 (sections NAF dominantes)
//   - Wikipédia « Économie de la Seine-Saint-Denis » (Generali ~3 000 emplois
//     site Le Landy ; SNCF Direction Générale Plaine Saint-Denis ; ex-campus SFR)
//   - Plaine Commune / Stade de France
//
// Reviewer : Claude Opus 4.8 (complément hub recrutement #40).

import type { VilleEconomicData } from "./types";

export const SAINT_DENIS_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93066",
      verifiedOn: "2026-06-08",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93066",
      verifiedOn: "2026-06-08",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93066",
      verifiedOn: "2026-06-08",
    },
    {
      naf: "J",
      label: "Information et communication (audiovisuel, cinéma, médias, logiciels)",
      rank: 4,
      source: "https://fr.wikipedia.org/wiki/%C3%89conomie_de_la_Seine-Saint-Denis",
      verifiedOn: "2026-06-08",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93066",
      verifiedOn: "2026-06-08",
    },
  ],

  statsInsee: {
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93066",
    verifiedOn: "2026-06-08",
  },

  grandsGroupesImplantes: [
    {
      nom: "Generali France (site Le Landy, Plaine Saint-Denis — ~3 000 emplois)",
      secteur: "Assurance",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/%C3%89conomie_de_la_Seine-Saint-Denis",
      verifiedOn: "2026-06-08",
    },
    {
      nom: "SNCF (Direction Générale, La Plaine Saint-Denis)",
      secteur: "Transport ferroviaire / services",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/%C3%89conomie_de_la_Seine-Saint-Denis",
      verifiedOn: "2026-06-08",
    },
  ],

  cciCompetente: {
    nom: "CCI Seine-Saint-Denis (CCI Paris Île-de-France)",
    source: "https://www.cci-paris-idf.fr/",
    verifiedOn: "2026-06-08",
  },

  specificitesLocales: [
    {
      theme: "pole_tertiaire_plaine_saint_denis",
      description:
        "La Plaine Saint-Denis est l'un des plus grands quartiers d'affaires de France, aux portes de Paris : sièges et grands sites tertiaires (Generali, SNCF, ex-campus SFR), forte densité de services aux entreprises.",
      source: "https://fr.wikipedia.org/wiki/%C3%89conomie_de_la_Seine-Saint-Denis",
      verifiedOn: "2026-06-08",
    },
    {
      theme: "audiovisuel_cinema",
      description:
        "Pôle majeur de l'image, du cinéma et de la télévision en Île-de-France, et ville du Stade de France (premier équipement sportif et événementiel du pays).",
      source: "https://fr.wikipedia.org/wiki/%C3%89conomie_de_la_Seine-Saint-Denis",
      verifiedOn: "2026-06-08",
    },
  ],

  lastReviewedOn: "2026-06-08",
  reviewedBy: "Claude Opus 4.8 (complément hub recrutement #40)",
};
