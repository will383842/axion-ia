// Fiche locale Toulouse : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_TOULOUSE: FicheLocale = {
  slug: "toulouse",
  nomVille: "Toulouse",
  dateFiche: "2026-11-18",
  population: {
    valeur: 514819,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/31555?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Toulouse Métropole",
    code: "243100518",
    population: 832348,
    nombreCommunes: 37,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/243100518/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/243100518?fields=nom,population",
    communes: [
      "Aigrefeuille",
      "Aucamville",
      "Aussonne",
      "Balma",
      "Beaupuy",
      "Beauzelle",
      "Blagnac",
      "Brax",
      "Bruguières",
      "Castelginest",
      "Colomiers",
      "Cornebarrieu",
      "Cugnaux",
      "Drémil-Lafage",
      "Fenouillet",
      "Flourens",
      "Fonbeauzard",
      "Gagnac-sur-Garonne",
      "Gratentour",
      "L'Union",
      "Launaguet",
      "Lespinasse",
      "Mondonville",
      "Mondouzil",
      "Mons",
      "Montrabé",
      "Pibrac",
      "Pin-Balma",
      "Quint-Fonsegrives",
      "Saint-Alban",
      "Saint-Jean",
      "Saint-Jory",
      "Saint-Orens-de-Gameville",
      "Seilh",
      "Toulouse",
      "Tournefeuille",
      "Villeneuve-Tolosane",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 16880,
    salaries: 247636,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2231555%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2231555%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 3913,
        salaries: 57104,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 3011,
        salaries: 24385,
      },
      {
        code: "RU",
        libelle: "Autres activités de services",
        etablissements: 1918,
        salaries: 12787,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 1851,
        salaries: 14533,
      },
    ],
    infoCom: {
      etablissements: 922,
      salaries: 18944,
    },
    extras: {
      transports: {
        etablissements: 28,
        salaries: 30964,
      },
      agroalimentaire: {
        etablissements: 221,
        salaries: 1790,
      },
    },
  },
  institutions: [
    {
      nom: "Université de Toulouse",
      categorie: "universite",
      url: "https://www.univ-toulouse.fr/",
      role: "communauté d’universités et d’établissements de Toulouse",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aerospace Valley",
      categorie: "pole",
      url: "https://www.aerospace-valley.com/",
      role: "pôle de compétitivité de l’aéronautique, de l’espace et des drones, en Occitanie et en Nouvelle-Aquitaine",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aéroport Toulouse-Blagnac",
      categorie: "aeroport",
      url: "https://www.toulouse.aeroport.fr/",
      role: "aéroport de la métropole",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "À Toulouse, l’Urssaf recense 16 880 établissements employeurs privés et 247 636 salariés au 31 décembre 2025. Les activités scientifiques et techniques en comptent 3 913, le commerce 3 011, les autres services 1 918 et l’hébergement-restauration 1 851. Dans la fabrication de matériels de transport, 28 établissements emploient 30 964 salariés.",
    ecosysteme:
      "Aerospace Valley est le pôle de compétitivité de l’aéronautique, de l’espace et des drones, actif en Occitanie et en Nouvelle-Aquitaine. L’Université de Toulouse est une communauté d’universités et d’établissements, utile pour situer l’offre de formation locale. L’aéroport Toulouse-Blagnac complète ces repères institutionnels. Nous ne nommons aucune entreprise : cela éviterait de laisser croire à des références que nous n’avons pas.",
    zone: "Toulouse Métropole réunit 37 communes et 832 348 habitants. Nous venons dans vos locaux, à Toulouse ou dans l’une de ces communes, sans bureau sur place. L’aéroport Toulouse-Blagnac est celui de l’agglomération ; les conditions de déplacement sont détaillées dans notre politique de déplacement. Parmi les communes de l’intercommunalité : Aigrefeuille, Aucamville, Aussonne, Balma, Beaupuy. Le matin : audit (2 à 4 h selon l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Pourquoi l’aéronautique compte-t-elle à Toulouse ?",
      a: "Dans les données Urssaf de 2025, 28 établissements de fabrication de matériels de transport regroupent 30 964 salariés à Toulouse. Le pôle Aerospace Valley, actif en Occitanie, illustre cette filière. La Journée IA ne vise pas l’industrie en général : elle part de vos propres dossiers. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "Les autres communes de Toulouse Métropole sont-elles couvertes ?",
      a: "Oui : Toulouse Métropole compte 37 communes, et la journée a lieu chez vous, où que vous soyez dans cette zone. Il n’y a pas de bureau à Toulouse, donc pas de lieu à rejoindre. La date et l’adresse se calent pendant l’appel de cadrage gratuit de 45 minutes. Exemples de communes concernées : Saint-Orens-de-Gameville, Seilh, Tournefeuille, Villeneuve-Tolosane.",
    },
    {
      q: "Quels secteurs de bureau sont les plus présents à Toulouse ?",
      a: "Au 31 décembre 2025, l’Urssaf compte à Toulouse 3 913 établissements d’activités scientifiques, techniques et administratives, 3 011 commerces et 1 918 établissements d’autres services. L’information et la communication en réunissent 922. C’est là que les gains de temps de l’IA sont souvent les plus faciles à chiffrer. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
