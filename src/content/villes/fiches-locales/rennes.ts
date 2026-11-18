// Fiche locale Rennes : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_RENNES: FicheLocale = {
  slug: "rennes",
  nomVille: "Rennes",
  dateFiche: "2026-11-18",
  population: {
    valeur: 230890,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/35238?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Rennes Métropole",
    code: "243500139",
    population: 473973,
    nombreCommunes: 43,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/243500139/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/243500139?fields=nom,population",
    communes: [
      "Acigné",
      "Bécherel",
      "Betton",
      "Bourgbarré",
      "Brécé",
      "Bruz",
      "Cesson-Sévigné",
      "Chantepie",
      "Chartres-de-Bretagne",
      "Chavagne",
      "Chevaigné",
      "Cintré",
      "Clayes",
      "Corps-Nuds",
      "Gévezé",
      "L'Hermitage",
      "La Chapelle-Chaussée",
      "La Chapelle-des-Fougeretz",
      "La Chapelle-Thouarault",
      "Laillé",
      "Langan",
      "Le Rheu",
      "Le Verger",
      "Miniac-sous-Bécherel",
      "Montgermont",
      "Mordelles",
      "Nouvoitou",
      "Noyal-Châtillon-sur-Seiche",
      "Orgères",
      "Pacé",
      "Parthenay-de-Bretagne",
      "Pont-Péan",
      "Rennes",
      "Romillé",
      "Saint-Armel",
      "Saint-Erblon",
      "Saint-Gilles",
      "Saint-Grégoire",
      "Saint-Jacques-de-la-Lande",
      "Saint-Sulpice-la-Forêt",
      "Thorigné-Fouillard",
      "Vern-sur-Seiche",
      "Vezin-le-Coquet",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 7352,
    salaries: 84956,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2235238%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2235238%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 1786,
        salaries: 15726,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 1255,
        salaries: 9883,
      },
      {
        code: "RU",
        libelle: "Autres activités de services",
        etablissements: 1074,
        salaries: 6266,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 823,
        salaries: 6218,
      },
    ],
    infoCom: {
      etablissements: 408,
      salaries: 8737,
    },
    extras: {
      transports: {
        etablissements: 3,
        salaries: 254,
      },
      agroalimentaire: {
        etablissements: 97,
        salaries: 1489,
      },
    },
  },
  institutions: [
    {
      nom: "Valorial",
      categorie: "pole",
      url: "https://www.pole-valorial.fr/",
      role: "pôle de compétitivité de l’agriculture et de l’agroalimentaire",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aéroport de Rennes",
      categorie: "aeroport",
      url: "https://www.rennes.aeroport.fr/",
      role: "aéroport de la métropole",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "Rennes recense 7 352 établissements employeurs privés et 84 956 salariés (Urssaf, 31 décembre 2025). Les activités scientifiques, techniques et administratives passent en tête (1 786), devant le commerce (1 255), les autres services (1 074) et l’hébergement-restauration (823). L’information et la communication regroupent 408 établissements et 8 737 salariés.",
    ecosysteme:
      "Valorial est le pôle de compétitivité de l’agriculture et de l’agroalimentaire dont le site évoque Rennes et la Bretagne. L’aéroport de Rennes dessert la métropole. Nous ne citons que des institutions vérifiées sur leur site officiel, sans nom d’entreprise : une marque citée près de notre offre pourrait passer pour une référence client, ce qui serait faux.",
    zone: "Rennes Métropole compte 43 communes et 473 973 habitants. Nous venons dans vos locaux, à Rennes ou dans l’une de ces communes, sans bureau sur place. Voir la politique de déplacement. Parmi les communes de l’intercommunalité : Acigné, Bécherel, Betton, Bourgbarré, Brécé. Le matin : audit (2 à 4 h selon l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Quelle est la taille du tissu rennais ?",
      a: "Au 31 décembre 2025, l’Urssaf recense 7 352 établissements employeurs privés à Rennes. Activités scientifiques, techniques et administratives : 1 786 ; commerce : 1 255 ; autres services : 1 074 ; hébergement-restauration : 823. Des PME de tous métiers cohabitent, sans filière dominante unique. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "Intervenez-vous dans toute la métropole rennaise ?",
      a: "Oui, dans les 43 communes de Rennes Métropole. Nous venons dans vos locaux, sans bureau sur place. L’appel de cadrage gratuit de 45 minutes fixe la date et l’adresse ; le déroulé est identique à celui d’ailleurs en France. Exemples de communes concernées : Saint-Sulpice-la-Forêt, Thorigné-Fouillard, Vern-sur-Seiche, Vezin-le-Coquet.",
    },
    {
      q: "L’agroalimentaire est-il concerné par la Journée IA à Rennes ?",
      a: "Il l’est comme tout autre secteur. Valorial, pôle de compétitivité de l’agriculture et de l’agroalimentaire, est cité comme repère institutionnel. L’Urssaf compte 97 établissements agroalimentaires à Rennes, pour 1 489 salariés ; la journée part de vos dossiers, quelle que soit l’activité. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
