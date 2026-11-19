// Fiche locale Strasbourg : chiffres Urssaf (open.urssaf.fr) et geo.api.gouv.fr relevés le 2026-11-18.
// Aucun chiffre sans source (voir les champs url*) ; la prose ne reprend que ces champs.
import type { FicheLocale } from "./types";

export const FICHE_STRASBOURG: FicheLocale = {
  slug: "strasbourg",
  nomVille: "Strasbourg",
  dateFiche: "2026-11-18",
  population: {
    valeur: 293771,
    source: "INSEE, population municipale, via geo.api.gouv.fr",
    url: "https://geo.api.gouv.fr/communes/67482?fields=nom,population,epci",
    consulteLe: "2026-11-18",
  },
  epci: {
    nom: "Eurométropole de Strasbourg",
    code: "246700488",
    population: 517386,
    nombreCommunes: 33,
    source: "geo.api.gouv.fr (intercommunalités)",
    url: "https://geo.api.gouv.fr/epcis/246700488/communes?fields=nom,code,population",
    urlPopulation: "https://geo.api.gouv.fr/epcis/246700488?fields=nom,population",
    communes: [
      "Achenheim",
      "Bischheim",
      "Blaesheim",
      "Breuschwickersheim",
      "Eckbolsheim",
      "Eckwersheim",
      "Entzheim",
      "Eschau",
      "Fegersheim",
      "Geispolsheim",
      "Hangenbieten",
      "Hœnheim",
      "Holtzheim",
      "Illkirch-Graffenstaden",
      "Kolbsheim",
      "La Wantzenau",
      "Lampertheim",
      "Lingolsheim",
      "Lipsheim",
      "Mittelhausbergen",
      "Mundolsheim",
      "Niederhausbergen",
      "Oberhausbergen",
      "Oberschaeffolsheim",
      "Osthoffen",
      "Ostwald",
      "Plobsheim",
      "Reichstett",
      "Schiltigheim",
      "Souffelweyersheim",
      "Strasbourg",
      "Vendenheim",
      "Wolfisheim",
    ],
    consulteLe: "2026-11-18",
  },
  entreprises: {
    millesime: 2025,
    perimetre: "commune",
    etablissements: 9981,
    salaries: 112618,
    urlTotal:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&where=code_commune%20in%20(%2267482%22)",
    urlSecteurs:
      "https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/etablissements-et-effectifs-salaries-au-niveau-commune-x-ape-last/records?select=secteur_na17%2C%20sum(nombre_d_etablissements_2025)%20as%20e%2C%20sum(effectifs_salaries_2025)%20as%20s&group_by=secteur_na17&order_by=e%20desc&where=code_commune%20in%20(%2267482%22)&limit=20",
    source:
      "Urssaf, établissements employeurs et effectifs salariés du secteur privé, par commune et APE (au 31/12/2025)",
    consulteLe: "2026-11-18",
    secteurs: [
      {
        code: "MN",
        libelle: "Activités scientifiques, techniques et services administratifs",
        etablissements: 1982,
        salaries: 19698,
      },
      {
        code: "GZ",
        libelle: "Commerce",
        etablissements: 1721,
        salaries: 13074,
      },
      {
        code: "OQ",
        libelle: "Administration, enseignement, santé et action sociale (part privée)",
        etablissements: 1383,
        salaries: 24105,
      },
      {
        code: "IZ",
        libelle: "Hébergement et restauration",
        etablissements: 1299,
        salaries: 11931,
      },
    ],
    infoCom: {
      etablissements: 394,
      salaries: 5996,
    },
    extras: {
      transports: {
        etablissements: 4,
        salaries: 409,
      },
      agroalimentaire: {
        etablissements: 191,
        salaries: 2354,
      },
    },
  },
  institutions: [
    {
      nom: "Université de Strasbourg",
      categorie: "universite",
      url: "https://www.unistra.fr/fr",
      role: "université strasbourgeoise",
      consulteLe: "2026-11-18",
    },
    {
      nom: "Aéroport de Strasbourg",
      categorie: "aeroport",
      url: "https://www.strasbourg.aeroport.fr/",
      role: "aéroport de la métropole",
      consulteLe: "2026-11-18",
    },
  ],
  prose: {
    tissu:
      "Strasbourg se distingue par la place de l’enseignement, de la santé et de l’action sociale dans le privé : 1 383 établissements, troisième secteur, devant l’hébergement-restauration (1 299). Les activités scientifiques, techniques et administratives (1 982) et le commerce (1 721) restent devant. Au total, 9 981 établissements employeurs privés et 112 618 salariés (Urssaf, 31 décembre 2025).",
    ecosysteme:
      "L’Université de Strasbourg est le repère institutionnel de la formation supérieure, avec facultés, écoles et instituts. L’aéroport de Strasbourg dessert l’agglomération. Nous ne retenons ici que des institutions dont le site officiel confirme l’existence : pas de technopôle ni d’entreprise sans source vérifiable. Ces repères ne sont pas des partenaires : ils situent seulement le territoire où nous intervenons.",
    zone: "L’Eurométropole de Strasbourg regroupe 33 communes et 517 386 habitants. La journée a lieu dans vos locaux, à Strasbourg ou dans une commune voisine de l’Eurométropole, sans bureau sur place. Voir la politique de déplacement pour le cadre. Parmi les communes de l’intercommunalité : Achenheim, Bischheim, Blaesheim, Breuschwickersheim, Eckbolsheim. Le matin : audit (2 à 4 h selon l’entreprise) ; l’après-midi : formation de 4 h, jusqu’à 15 personnes.",
  },
  faqLocale: [
    {
      q: "Quels métiers dominent à Strasbourg selon l’Urssaf ?",
      a: "Au 31 décembre 2025 : 1 982 établissements d’activités scientifiques, techniques et administratives, 1 721 de commerce, 1 383 d’enseignement, santé et action sociale (part privée), 1 299 d’hébergement-restauration. Les structures qui soignent, forment ou accompagnent sont donc nombreuses. Les chiffres viennent du jeu de données Urssaf par commune et APE, consultable en ligne par le lien de la fiche.",
    },
    {
      q: "Peut-on organiser la journée dans une commune de l’Eurométropole ?",
      a: "Oui, dans les 33 communes de l’Eurométropole de Strasbourg. Nous n’avons pas de bureau sur place et venons chez vous. Le Diagnostic IA gratuit de 45 minutes sert à choisir la date et l’adresse. Exemples de communes concernées : Schiltigheim, Souffelweyersheim, Vendenheim, Wolfisheim.",
    },
    {
      q: "Faut-il être dans le numérique pour y trouver sa place ?",
      a: "Non. À Strasbourg, 394 établissements d’information et de communication existent sur 9 981 établissements employeurs, mais la Journée IA concerne tout service qui traite des dossiers, des courriels ou des devis, quel que soit le secteur. Les liens vers chaque site officiel figurent en bas de page, avec la date de consultation.",
    },
  ],
};
