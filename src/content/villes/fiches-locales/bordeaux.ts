// Fiche locale Bordeaux : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_BORDEAUX: FicheLocale = {
  slug: "bordeaux",
  nomVille: "Bordeaux",
  dateFiche: "2026-11-18",
  population: {
    valeur: 267991,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/33063?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Bordeaux Métropole",
    code: "243300316",
    population: 843738,
    nombreCommunes: 28,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/243300316/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/243300316?fields=nom,population",
    communes: [
      "Ambarès-et-Lagrave",
      "Ambès",
      "Artigues-près-Bordeaux",
      "Bassens",
      "Bègles",
      "Blanquefort",
      "Bordeaux",
      "Bouliac",
      "Bruges",
      "Carbon-Blanc",
      "Cenon",
      "Eysines",
      "Floirac",
      "Gradignan",
      "Le Bouscat",
      "Le Haillan",
      "Le Taillan-Médoc",
      "Lormont",
      "Martignas-sur-Jalle",
      "Mérignac",
      "Parempuyre",
      "Pessac",
      "Saint-Aubin-de-Médoc",
      "Saint-Louis-de-Montferrand",
      "Saint-Médard-en-Jalles",
      "Saint-Vincent-de-Paul",
      "Talence",
      "Villenave-d'Ornon",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 12402,
    salaries: 130124,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2233063%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2233063%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 2940,
        salaries: 23303,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 2205,
        salaries: 16717,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 1626,
        salaries: 13080,
      },
      {
        code: "RU",
        libelle: "Autres activités de services",
        etablissements: 1321,
        salaries: 8390,
      },
    ],
    infoCom: {
      etablissements: 672,
      salaries: 11159,
    },
    extras: {
      transports: {
        etablissements: 5,
        salaries: 1153,
      },
      agroalimentaire: {
        etablissements: 194,
        salaries: 1598,
      },
    },
  },
  institutions: [
    {
      nom: "Université de Bordeaux",
      categorie: "universite",
      url: "https://www.u-bordeaux.fr/",
      role: "université bordelaise",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aerospace Valley",
      categorie: "pole",
      url: "https://www.aerospace-valley.com/",
      role: "pôle de compétitivité de l’aéronautique, de l’espace et des drones",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Alpha-RLH",
      categorie: "pole",
      url: "https://www.alpha-rlh.com/",
      role: "pôle de compétitivité deeptech de Nouvelle-Aquitaine : photonique, matériaux, électronique",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aéroport Bordeaux-Mérignac",
      categorie: "aeroport",
      url: "https://www.bordeaux.aeroport.fr/",
      role: "aéroport de la métropole",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "L’Urssaf recense 12 402 établissements employeurs privés à Bordeaux, pour 130 124 salariés (31 décembre 2025). Le premier secteur regroupe les activités scientifiques, techniques et administratives (2 940), suivi du commerce (2 205), de l’hébergement-restauration (1 626) et des autres services (1 321). 672 établissements d’information et de communication emploient 11 159 salariés.",
    ecosysteme:
      "Bordeaux s’appuie sur l’Université de Bordeaux, sur Aerospace Valley (pôle de compétitivité de l’aéronautique, de l’espace et des drones) et sur Alpha-RLH, pôle deeptech de Nouvelle-Aquitaine spécialisé en photonique, matériaux et électronique. L’aéroport Bordeaux-Mérignac est la porte d’entrée aérienne. Aucun lien commercial n’existe avec ces institutions.",
    zone: "Bordeaux Métropole compte 28 communes et 843 738 habitants. Nous venons dans vos locaux, à Bordeaux ou dans une autre commune de la métropole, sans bureau local. La politique de déplacement donne le cadre. Parmi les communes de l’intercommunalité : Ambarès-et-Lagrave, Ambès, Artigues-près-Bordeaux, Bassens, Bègles. Le matin : audit (2 à 4 h selon la structuration de l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Quelle est la taille du tissu économique bordelais ?",
      a: "Selon l’Urssaf, Bordeaux compte 12 402 établissements employeurs privés au 31 décembre 2025, pour 130 124 salariés. Les activités scientifiques, techniques et administratives en regroupent 2 940, le commerce 2 205. Ces chiffres situent le territoire ; ils ne préjugent pas de votre besoin. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "La Journée IA dessert-elle les communes de Bordeaux Métropole ?",
      a: "Oui, les 28 communes de la métropole. Nous n’avons pas de bureau à Bordeaux : l’audit et la formation ont lieu chez vous. L’adresse et la date se fixent pendant le Diagnostic IA gratuit de 45 minutes. Exemples de communes concernées : Saint-Médard-en-Jalles, Saint-Vincent-de-Paul, Talence, Villenave-d'Ornon.",
    },
    {
      q: "Quels acteurs institutionnels existent autour de Bordeaux ?",
      a: "Aerospace Valley pour l’aéronautique et l’espace, Alpha-RLH pour la photonique et les matériaux, et l’Université de Bordeaux. Ce sont des repères institutionnels : nous ne sommes ni membres ni partenaires, et nous ne citons aucune entreprise privée. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
