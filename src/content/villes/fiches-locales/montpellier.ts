// Fiche locale Montpellier : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_MONTPELLIER: FicheLocale = {
  slug: "montpellier",
  nomVille: "Montpellier",
  dateFiche: "2026-11-18",
  population: {
    valeur: 310240,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/34172?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Montpellier Méditerranée Métropole",
    code: "243400017",
    population: 516657,
    nombreCommunes: 31,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/243400017/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/243400017?fields=nom,population",
    communes: [
      "Baillargues",
      "Beaulieu",
      "Castelnau-le-Lez",
      "Castries",
      "Clapiers",
      "Cournonsec",
      "Cournonterral",
      "Fabrègues",
      "Grabels",
      "Jacou",
      "Juvignac",
      "Lattes",
      "Lavérune",
      "Le Crès",
      "Montaud",
      "Montferrier-sur-Lez",
      "Montpellier",
      "Murviel-lès-Montpellier",
      "Pérols",
      "Pignan",
      "Prades-le-Lez",
      "Restinclières",
      "Saint-Brès",
      "Saint-Drézéry",
      "Saint-Geniès-des-Mourgues",
      "Saint-Georges-d'Orques",
      "Saint-Jean-de-Védas",
      "Saussan",
      "Sussargues",
      "Vendargues",
      "Villeneuve-lès-Maguelone",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 10241,
    salaries: 106228,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2234172%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2234172%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 2160,
        salaries: 22346,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 1641,
        salaries: 13847,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 1289,
        salaries: 9250,
      },
      {
        code: "RU",
        libelle: "Autres activités de services",
        etablissements: 1242,
        salaries: 6073,
      },
    ],
    infoCom: {
      etablissements: 574,
      salaries: 8230,
    },
    extras: {
      transports: {
        etablissements: 4,
        salaries: 187,
      },
      agroalimentaire: {
        etablissements: 144,
        salaries: 1025,
      },
    },
  },
  institutions: [
    {
      nom: "Université de Montpellier",
      categorie: "universite",
      url: "https://www.umontpellier.fr/",
      role: "université montpelliéraine",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aéroport Montpellier Méditerranée",
      categorie: "aeroport",
      url: "https://www.montpellier.aeroport.fr/fr",
      role: "aéroport de la métropole",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "Montpellier compte 10 241 établissements employeurs privés et 106 228 salariés (Urssaf, 31 décembre 2025). Les activités scientifiques, techniques et administratives forment le premier secteur (2 160 établissements), suivies du commerce (1 641), de l’hébergement-restauration (1 289) et des autres services (1 242). L’information et la communication comptent 574 établissements et 8 230 salariés.",
    ecosysteme:
      "Le principal repère institutionnel est l’Université de Montpellier, dont le site présente formation, recherche et innovation. L’aéroport Montpellier Méditerranée dessert la métropole. Nous ne citons ici que ces deux institutions, vérifiées sur leurs sites officiels, faute de source équivalente pour d’autres, et aucune entreprise privée : le but est de situer le territoire, pas de laisser entendre que ces acteurs travaillent avec nous.",
    zone: "Montpellier Méditerranée Métropole regroupe 31 communes et 516 657 habitants. La Journée IA se déroule dans vos locaux, à Montpellier ou dans l’une d’entre elles, sans bureau local. Les modalités de déplacement sont décrites dans notre politique de déplacement. Parmi les communes de l’intercommunalité : Baillargues, Beaulieu, Castelnau-le-Lez, Castries, Clapiers. Le matin : audit (2 à 4 h selon l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Quel est le profil des entreprises de Montpellier ?",
      a: "L’Urssaf recense 10 241 établissements employeurs privés au 31 décembre 2025. Premier secteur : activités scientifiques, techniques et administratives (2 160) ; ensuite le commerce (1 641) et l’hébergement-restauration (1 289). Aucun secteur n’écrase les autres, d’où une journée construite à partir de vos propres dossiers. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "La Journée IA est-elle possible dans les communes autour de Montpellier ?",
      a: "Oui : Montpellier Méditerranée Métropole compte 31 communes et nous intervenons chez vous dans chacune. Pas de bureau sur place : la date et l’adresse sont fixées pendant le Diagnostic IA gratuit de 45 minutes. Exemples de communes concernées : Saussan, Sussargues, Vendargues, Villeneuve-lès-Maguelone.",
    },
    {
      q: "Comment la journée s’articule-t-elle avec l’université locale ?",
      a: "Elle ne s’y articule pas : l’Université de Montpellier est un repère institutionnel pour situer le territoire, sans partenariat avec nous. La Journée IA reste centrée sur votre entreprise : l’audit du matin convient aux entreprises de 2 à 250 salariés, et la formation de l’après-midi forme jusqu’à 15 personnes sur leurs propres dossiers. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
