// Fiche locale Nantes : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_NANTES: FicheLocale = {
  slug: "nantes",
  nomVille: "Nantes",
  dateFiche: "2026-11-18",
  population: {
    valeur: 327734,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/44109?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Nantes Métropole",
    code: "244400404",
    population: 683981,
    nombreCommunes: 24,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/244400404/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/244400404?fields=nom,population",
    communes: [
      "Basse-Goulaine",
      "Bouaye",
      "Bouguenais",
      "Brains",
      "Carquefou",
      "Couëron",
      "Indre",
      "La Chapelle-sur-Erdre",
      "La Montagne",
      "Le Pellerin",
      "Les Sorinières",
      "Mauves-sur-Loire",
      "Nantes",
      "Orvault",
      "Rezé",
      "Saint-Aignan-Grandlieu",
      "Saint-Herblain",
      "Saint-Jean-de-Boiseau",
      "Saint-Léger-les-Vignes",
      "Saint-Sébastien-sur-Loire",
      "Sainte-Luce-sur-Loire",
      "Sautron",
      "Thouaré-sur-Loire",
      "Vertou",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 10028,
    salaries: 133493,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2244109%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2244109%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 2475,
        salaries: 29801,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 1493,
        salaries: 11085,
      },
      {
        code: "RU",
        libelle: "Autres activités de services",
        etablissements: 1367,
        salaries: 7488,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 1161,
        salaries: 7471,
      },
    ],
    infoCom: {
      etablissements: 719,
      salaries: 19317,
    },
    extras: {
      transports: {
        etablissements: 5,
        salaries: 63,
      },
      agroalimentaire: {
        etablissements: 157,
        salaries: 1372,
      },
    },
  },
  institutions: [
    {
      nom: "Nantes Université",
      categorie: "universite",
      url: "https://www.univ-nantes.fr/",
      role: "université nantaise",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Pôle EMC2",
      categorie: "pole",
      url: "https://www.pole-emc2.fr/",
      role: "pôle qui accompagne le montage de projets innovants pour la transformation industrielle",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Atlanpole",
      categorie: "technopole",
      url: "https://www.atlanpole.fr/",
      role: "accompagnement des chercheurs et des entrepreneurs, de la pré-incubation à l’accélération",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "Nantes totalise 10 028 établissements employeurs privés et 133 493 salariés au 31 décembre 2025 (Urssaf). Les activités scientifiques, techniques et administratives dominent nettement : 2 475 établissements, contre 1 493 pour le commerce. Les autres services en comptent 1 367 et l’hébergement-restauration 1 161. L’information et la communication, avec 719 établissements, emploient 19 317 salariés.",
    ecosysteme:
      "Nantes Université est le repère de la formation supérieure. Atlanpole accompagne chercheurs et entrepreneurs de la pré-incubation à l’accélération, à Nantes et en Pays de la Loire. Le pôle EMC2 soutient le montage de projets innovants pour la transformation industrielle. Ces institutions ne sont pas nos partenaires ; elles situent le territoire.",
    zone: "Nantes Métropole compte 24 communes et 683 981 habitants. Nous venons dans vos locaux, à Nantes ou dans l’une d’elles, sans bureau sur place. La politique de déplacement précise le cadre. Parmi les communes de l’intercommunalité : Basse-Goulaine, Bouaye, Bouguenais, Brains, Carquefou. Le matin : audit (2 à 4 h selon la structuration de l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Le numérique pèse-t-il vraiment à Nantes ?",
      a: "Selon l’Urssaf (31 décembre 2025), 719 établissements d’information et de communication emploient 19 317 salariés à Nantes, sur 133 493 salariés du privé au total. Les entreprises voisines utilisent donc déjà des outils numériques ; la Journée IA aide à choisir où l’IA fait réellement gagner du temps chez vous. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "Combien de communes la Journée IA peut-elle couvrir autour de Nantes ?",
      a: "Nantes Métropole en compte 24, toutes accessibles pour une journée dans vos locaux. Nous n’avons pas de bureau à Nantes. Date et adresse se fixent pendant le Diagnostic IA gratuit de 45 minutes, avant toute réservation. Exemples de communes concernées : Sainte-Luce-sur-Loire, Sautron, Thouaré-sur-Loire, Vertou.",
    },
    {
      q: "Quelles institutions d’innovation existent à Nantes ?",
      a: "Atlanpole (accompagnement des chercheurs et entrepreneurs), le pôle EMC2 (projets pour la transformation industrielle) et Nantes Université. Ce sont des repères institutionnels, sans lien contractuel avec nous. Leurs sites officiels détaillent leurs services. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
