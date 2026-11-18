/**
 * Chiffres publics vérifiés sur l'IA dans les entreprises françaises et européennes.
 * Lot GEO V2-02. Chaque entrée a été relue dans la source primaire elle-même
 * (page officielle ou PDF de l'organisme), jamais dans un article de presse.
 * `extrait` est copié mot pour mot de la source (25 mots au plus, langue d'origine) ;
 * `citation` est la phrase française prête à être reprise dans une page.
 * Ne remplace aucun chiffre existant des pages : à utiliser pour sourcer les nouveaux.
 */
export type ChiffrePublic = {
  id: string;
  valeur: string;
  unite: string;
  perimetre: string;
  annee: number;
  source: string;
  url: string;
  consulteLe: string;
  extrait: string;
  citation: string;
};

export const CHIFFRES_PUBLICS: readonly ChiffrePublic[] = [
  {
    id: "insee-ia-taux-2025",
    valeur: "18",
    unite: "%",
    perimetre:
      "entreprises de 10 salariés ou plus, secteurs principalement marchands hors agriculture, finance et assurance, France hors Mayotte",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait:
      "En 2025, 18 % des entreprises françaises de 10 salariés ou plus déclarent utiliser au moins une technologie d’ intelligence artificielle (IA)",
    citation:
      "En 2025, 18 % des entreprises françaises de 10 salariés ou plus déclarent utiliser au moins une technologie d’IA (Insee).",
  },
  {
    id: "insee-ia-hausse-1-an",
    valeur: "8",
    unite: "points",
    perimetre:
      "entreprises de 10 salariés ou plus, secteurs principalement marchands hors agriculture, finance et assurance, France hors Mayotte ; hausse du taux d’usage entre 2024 et 2025",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "8 points de plus qu’en 2024 et 12 points de plus qu’en 2023",
    citation:
      "L’usage de l’IA dans les entreprises françaises de 10 salariés ou plus a gagné 8 points en un an, entre 2024 et 2025 (Insee).",
  },
  {
    id: "insee-ia-hausse-2-ans",
    valeur: "12",
    unite: "points",
    perimetre:
      "entreprises de 10 salariés ou plus, secteurs principalement marchands hors agriculture, finance et assurance, France hors Mayotte ; hausse du taux d’usage entre 2023 et 2025",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "8 points de plus qu’en 2024 et 12 points de plus qu’en 2023",
    citation:
      "Le taux d’usage de l’IA des entreprises françaises de 10 salariés ou plus a progressé de 12 points entre 2023 et 2025 (Insee).",
  },
  {
    id: "insee-ia-10-49",
    valeur: "15",
    unite: "%",
    perimetre:
      "entreprises françaises de moins de 50 salariés (10 à 49 salariés), même champ que ci-dessus",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "(respectivement 15 %, 31 %, et 58 %)",
    citation:
      "En 2025, 15 % des entreprises françaises de moins de 50 salariés utilisent l’IA (Insee).",
  },
  {
    id: "insee-ia-50-249",
    valeur: "31",
    unite: "%",
    perimetre: "entreprises françaises de 50 à 249 salariés, même champ que ci-dessus",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "(respectivement 15 %, 31 %, et 58 %)",
    citation:
      "En 2025, 31 % des entreprises françaises de 50 à 249 salariés utilisent l’IA (Insee).",
  },
  {
    id: "insee-ia-250-plus",
    valeur: "58",
    unite: "%",
    perimetre: "entreprises françaises de 250 salariés ou plus, même champ que ci-dessus",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "Le taux d’usage atteint ainsi 58 % pour les entreprises de 250 salariés ou plus",
    citation:
      "En 2025, 58 % des entreprises françaises de 250 salariés ou plus utilisent l’IA (Insee).",
  },
  {
    id: "insee-ia-info-com",
    valeur: "59",
    unite: "%",
    perimetre: "entreprises françaises de 10 salariés ou plus du secteur information-communication",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "et 59 % pour celles du secteur de l’information‑communication",
    citation:
      "En 2025, 59 % des entreprises françaises de l’information-communication utilisent l’IA (Insee).",
  },
  {
    id: "insee-ia-transports",
    valeur: "9",
    unite: "%",
    perimetre:
      "entreprises françaises de 10 salariés ou plus du secteur transports et entreposage (taux non pondéré par l’emploi)",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "(66 % en pondéré, contre 9 % en non pondéré)",
    citation:
      "En 2025, 9 % des entreprises françaises des transports et de l’entreposage utilisent l’IA, mais elles pèsent 66 % de l’emploi du secteur (Insee).",
  },
  {
    id: "insee-ia-chiffre-affaires",
    valeur: "66",
    unite: "%",
    perimetre:
      "part du chiffre d’affaires du champ réalisée par les entreprises utilisatrices d’IA (France, 10 salariés ou plus)",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait:
      "Les entreprises utilisant l’IA concentrent désormais 66 % du chiffre d’affaires et 59 % de l’emploi total du",
    citation:
      "Les entreprises utilisatrices d’IA concentrent 66 % du chiffre d’affaires du champ en 2025 (Insee).",
  },
  {
    id: "insee-ia-emploi",
    valeur: "59",
    unite: "%",
    perimetre:
      "part de l’emploi total du champ travaillant dans des entreprises utilisatrices d’IA (et non part des salariés utilisant l’IA)",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait:
      "Les entreprises utilisant l’IA concentrent désormais 66 % du chiffre d’affaires et 59 % de l’emploi total du",
    citation:
      "59 % de l’emploi du champ se trouve dans des entreprises qui utilisent l’IA en 2025, sans que 59 % des salariés l’utilisent directement (Insee).",
  },
  {
    id: "insee-ia-ue-comparaison",
    valeur: "20",
    unite: "%",
    perimetre:
      "entreprises de l’Union européenne déclarant utiliser au moins une technologie d’IA, comparaison faite par l’Insee",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "où 20 % des entreprises déclarent utiliser au moins une technologie d’IA en 2025",
    citation:
      "En 2025, 20 % des entreprises de l’Union européenne déclarent utiliser l’IA, contre 18 % en France (Insee).",
  },
  {
    id: "insee-ia-fouille-texte",
    valeur: "56",
    unite: "%",
    perimetre:
      "entreprises françaises utilisatrices d’IA (10 salariés ou plus) ayant recours à la fouille automatique de texte",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait:
      "Plus de la moitié déclarent utiliser la fouille automatique de texte (analyse du langage écrit, 56 %).",
    citation:
      "Parmi les entreprises françaises qui utilisent l’IA, 56 % font de la fouille automatique de texte en 2025 (Insee).",
  },
  {
    id: "insee-ia-generative-texte",
    valeur: "43",
    unite: "%",
    perimetre:
      "entreprises françaises utilisatrices d’IA (10 salariés ou plus) ayant recours à l’IA générative de texte ou de parole",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "Viennent ensuite les outils d’IA générative de texte ou de parole (43 %)",
    citation:
      "Parmi les entreprises françaises qui utilisent l’IA, 43 % emploient des outils d’IA générative de texte ou de parole en 2025 (Insee).",
  },
  {
    id: "insee-ia-frein-utilite",
    valeur: "71",
    unite: "%",
    perimetre:
      "entreprises françaises de 10 salariés ou plus n’utilisant pas l’IA, citant le manque d’utilité",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait:
      "Le manque d’utilité est la raison la plus souvent citée pour ne pas utiliser l’IA (71 %)",
    citation:
      "Parmi les entreprises françaises qui n’utilisent pas l’IA, 71 % invoquent le manque d’utilité en 2025 (Insee).",
  },
  {
    id: "insee-ia-frein-expertise",
    valeur: "54",
    unite: "%",
    perimetre:
      "entreprises françaises de 10 salariés ou plus n’utilisant pas l’IA, citant le manque d’expertise",
    annee: 2025,
    source: "Insee, Insee Première n° 2120 (enquête TIC-entreprises 2025), 21 juillet 2026",
    url: "https://www.insee.fr/fr/statistiques/9025878",
    consulteLe: "2026-11-18",
    extrait: "Le manque d’expertise est évoqué par 54 % des entreprises",
    citation:
      "Parmi les entreprises françaises qui n’utilisent pas l’IA, 54 % évoquent un manque d’expertise en 2025 (Insee).",
  },
  {
    id: "eurostat-ia-ue-2025",
    valeur: "20,0",
    unite: "%",
    perimetre: "entreprises de l’UE de 10 salariés ou plus, usage d’au moins une technologie d’IA",
    annee: 2025,
    source: "Eurostat, actualité « 20% of EU enterprises use AI technologies », 11 décembre 2025",
    url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2",
    consulteLe: "2026-11-18",
    extrait:
      "In 2025, 20.0% of EU enterprises with 10 or more employees used artificial intelligence (AI) technologies to conduct their business",
    citation:
      "En 2025, 20,0 % des entreprises de l’Union européenne de 10 salariés ou plus utilisent des technologies d’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-ue-2024",
    valeur: "13,5",
    unite: "%",
    perimetre: "entreprises de l’UE de 10 salariés ou plus, usage d’au moins une technologie d’IA",
    annee: 2024,
    source: "Eurostat, actualité « 20% of EU enterprises use AI technologies », 11 décembre 2025",
    url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2",
    consulteLe: "2026-11-18",
    extrait: "showing a solid growth of 6.5 percentage points (pp) from 13.5% in 2024",
    citation:
      "En 2024, 13,5 % des entreprises de l’Union européenne de 10 salariés ou plus utilisaient l’IA, contre 20,0 % en 2025 (Eurostat).",
  },
  {
    id: "eurostat-ia-danemark",
    valeur: "42,0",
    unite: "%",
    perimetre: "entreprises danoises de 10 salariés ou plus, premier pays de l’UE",
    annee: 2025,
    source: "Eurostat, actualité « 20% of EU enterprises use AI technologies », 11 décembre 2025",
    url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2",
    consulteLe: "2026-11-18",
    extrait:
      "The highest shares of these enterprises in 2025 were in Denmark (42.0%), Finland (37.8%) and Sweden (35.0%).",
    citation:
      "Le Danemark est en tête de l’Union européenne en 2025, avec 42,0 % des entreprises de 10 salariés ou plus qui utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-roumanie",
    valeur: "5,2",
    unite: "%",
    perimetre: "entreprises roumaines de 10 salariés ou plus, dernier pays de l’UE",
    annee: 2025,
    source: "Eurostat, actualité « 20% of EU enterprises use AI technologies », 11 décembre 2025",
    url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2",
    consulteLe: "2026-11-18",
    extrait: "At the other end were Romania (5.2%), Poland (8.4%) and Bulgaria (8.5%).",
    citation:
      "La Roumanie ferme la marche de l’Union européenne en 2025, avec 5,2 % des entreprises de 10 salariés ou plus qui utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-petites",
    valeur: "17",
    unite: "%",
    perimetre: "petites entreprises de l’UE (10 à 49 salariés)",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait:
      "In 2025, 17% of small enterprises, 30.36% of medium enterprises and 55.03% of large enterprises used AI.",
    citation:
      "En 2025, 17 % des petites entreprises de l’Union européenne utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-moyennes",
    valeur: "30,36",
    unite: "%",
    perimetre: "entreprises moyennes de l’UE (50 à 249 salariés)",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait:
      "In 2025, 17% of small enterprises, 30.36% of medium enterprises and 55.03% of large enterprises used AI.",
    citation:
      "En 2025, 30,36 % des entreprises moyennes de l’Union européenne utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-grandes",
    valeur: "55,03",
    unite: "%",
    perimetre: "grandes entreprises de l’UE (250 salariés ou plus)",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait: "In 2025, 55.03% of large EU enterprises used AI technologies.",
    citation:
      "En 2025, 55,03 % des grandes entreprises de l’Union européenne utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-info-com",
    valeur: "62,52",
    unite: "%",
    perimetre: "entreprises de l’UE du secteur information et communication",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait: "the information and communication sector (with 62.52%)",
    citation:
      "En 2025, 62,52 % des entreprises européennes de l’information et de la communication utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-construction",
    valeur: "10,79",
    unite: "%",
    perimetre: "entreprises de l’UE du secteur de la construction",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait: "This ranged from 24.82% (real estate activities) to 10.79% (construction).",
    citation:
      "En 2025, 10,79 % des entreprises européennes de la construction utilisent l’IA (Eurostat).",
  },
  {
    id: "eurostat-ia-analyse-texte",
    valeur: "11,75",
    unite: "%",
    perimetre:
      "entreprises de l’UE de 10 salariés ou plus, usage de l’analyse du langage écrit (text mining)",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait: "In 2025, these AI technologies were used by 11.75% of enterprises.",
    citation:
      "En 2025, 11,75 % des entreprises de l’Union européenne utilisent l’IA pour analyser du texte, la technologie la plus répandue (Eurostat).",
  },
  {
    id: "eurostat-ia-frein-expertise",
    valeur: "70,89",
    unite: "%",
    perimetre:
      "entreprises de l’UE qui n’utilisent pas l’IA mais l’ont envisagée, citant le manque d’expertise",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait:
      "the most common reason for not using AI technologies was the lack of relevant expertise (70.89%)",
    citation:
      "Parmi les entreprises européennes qui ont envisagé l’IA sans l’adopter, 70,89 % citent le manque d’expertise en 2025 (Eurostat).",
  },
  {
    id: "eurostat-ia-frein-juridique",
    valeur: "52,52",
    unite: "%",
    perimetre:
      "entreprises de l’UE qui n’utilisent pas l’IA mais l’ont envisagée, citant le manque de clarté sur les conséquences juridiques",
    annee: 2025,
    source:
      "Eurostat, Statistics Explained : Use of artificial intelligence in enterprises (données extraites en décembre 2025)",
    url: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    consulteLe: "2026-11-18",
    extrait: "followed by lack of clarity about the legal consequences (52.52%)",
    citation:
      "Parmi les entreprises européennes qui ont envisagé l’IA sans l’adopter, 52,52 % citent le manque de clarté sur les conséquences juridiques en 2025 (Eurostat).",
  },
  {
    id: "bdf-ia-generative-2026",
    valeur: "67",
    unite: "%",
    perimetre:
      "entreprises françaises de 20 salariés et plus (industrie manufacturière, bâtiment, services marchands non financiers hors commerce), usage d’IA générative, enquête du 25 février au 3 avril 2026",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait:
      "67 % la part des entreprises de 20 salariés et plus déclarant utiliser l’IA générative début 2026",
    citation:
      "Début 2026, 67 % des entreprises françaises de 20 salariés et plus déclarent utiliser l’IA générative (Banque de France).",
  },
  {
    id: "bdf-ia-generative-20-49",
    valeur: "64",
    unite: "%",
    perimetre: "entreprises françaises de 20 à 49 salariés (même champ), usage d’IA générative",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait: "est de 64 % parmi les plus petites considérées dans l’enquête (20 à 49 salariés)",
    citation:
      "Début 2026, 64 % des entreprises françaises de 20 à 49 salariés utilisent l’IA générative (Banque de France).",
  },
  {
    id: "bdf-ia-generative-1000-plus",
    valeur: "83",
    unite: "%",
    perimetre:
      "entreprises françaises de 1 000 salariés ou plus (même champ), usage d’IA générative",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait: "contre 83 % parmi les plus grandes (1 000 salariés ou plus)",
    citation:
      "Début 2026, 83 % des entreprises françaises de 1 000 salariés ou plus utilisent l’IA générative (Banque de France).",
  },
  {
    id: "bdf-ia-fonctions-support",
    valeur: "74",
    unite: "%",
    perimetre:
      "entreprises françaises utilisatrices d’IA de 20 salariés et plus (même champ), usage principal en fonctions support",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait:
      "74 % des entreprises utilisatrices déclarent employer l’IA principalement dans des fonctions support",
    citation:
      "Début 2026, 74 % des entreprises françaises utilisatrices d’IA l’emploient d’abord dans des fonctions support (Banque de France).",
  },
  {
    id: "bdf-ia-gain-productivite",
    valeur: "31",
    unite: "%",
    perimetre:
      "entreprises françaises utilisatrices d’IA générative de 20 salariés et plus (même champ), constatant déjà un gain de productivité",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait:
      "la part des entreprises utilisatrices de l’IA générative constatant déjà un gain de productivité",
    citation:
      "Début 2026, 31 % des entreprises françaises utilisatrices d’IA générative constatent déjà un gain de productivité (Banque de France).",
  },
  {
    id: "bdf-ia-frein-cas-usage",
    valeur: "38",
    unite: "%",
    perimetre:
      "entreprises françaises de 20 salariés et plus (même champ) citant le manque de cas d’usage comme principal frein",
    annee: 2026,
    source:
      "Banque de France, Bulletin 266/1 (septembre-octobre 2026) : L’IA s’installe dans les entreprises françaises",
    url: "https://www.banque-france.fr/system/files/2026-09/BDF266-1_IA-et-entreprises_web.pdf",
    consulteLe: "2026-11-18",
    extrait: "la part des entreprises citant le manque de cas d’usage comme principal frein",
    citation:
      "Début 2026, 38 % des entreprises françaises de 20 salariés et plus citent le manque de cas d’usage comme principal frein à l’IA (Banque de France).",
  },
  {
    id: "bpifrance-iag-2025",
    valeur: "55",
    unite: "%",
    perimetre:
      "TPE-PME françaises de 1 à 249 salariés, recours à l’IA générative, enquête du 5 novembre au 2 décembre 2025 (4 722 réponses)",
    annee: 2025,
    source:
      "Bpifrance Le Lab, 82e baromètre semestriel de conjoncture TPE-PME, communiqué du 13 janvier 2026",
    url: "https://presse.bpifrance.fr/bpifrance-le-lab-presente-le-82eme-barometre-semestriel-de-conjoncture-aupres-des-tpe-pme-les-dirigeants-font-part-dun-leger-regain-de-confiance-pour-2026/?lang=fra",
    consulteLe: "2026-11-18",
    extrait: "Fin 2025, 55 % des TPE-PME déclarent recourir à des IAG",
    citation:
      "Fin 2025, 55 % des TPE-PME françaises déclarent recourir à l’IA générative (Bpifrance Le Lab).",
  },
  {
    id: "bpifrance-iag-2024",
    valeur: "31",
    unite: "%",
    perimetre: "TPE-PME françaises de 1 à 249 salariés, recours à l’IA générative, fin 2024",
    annee: 2024,
    source:
      "Bpifrance Le Lab, 82e baromètre semestriel de conjoncture TPE-PME, communiqué du 13 janvier 2026",
    url: "https://presse.bpifrance.fr/bpifrance-le-lab-presente-le-82eme-barometre-semestriel-de-conjoncture-aupres-des-tpe-pme-les-dirigeants-font-part-dun-leger-regain-de-confiance-pour-2026/?lang=fra",
    consulteLe: "2026-11-18",
    extrait: "une proportion en très forte progression sur un an (31 % fin 2024, 15 % en 2023)",
    citation:
      "Fin 2024, 31 % des TPE-PME françaises déclaraient recourir à l’IA générative (Bpifrance Le Lab).",
  },
  {
    id: "bpifrance-iag-contenus-ecrits",
    valeur: "72",
    unite: "%",
    perimetre:
      "TPE-PME françaises utilisatrices d’IA générative, usage pour la génération de contenus écrits",
    annee: 2025,
    source:
      "Bpifrance Le Lab, 82e baromètre semestriel de conjoncture TPE-PME, communiqué du 13 janvier 2026",
    url: "https://presse.bpifrance.fr/bpifrance-le-lab-presente-le-82eme-barometre-semestriel-de-conjoncture-aupres-des-tpe-pme-les-dirigeants-font-part-dun-leger-regain-de-confiance-pour-2026/?lang=fra",
    consulteLe: "2026-11-18",
    extrait: "Le principal usage reste la génération de contenus écrits (72 %, +3 points)",
    citation:
      "Parmi les TPE-PME qui utilisent l’IA générative, 72 % l’emploient pour générer des contenus écrits (Bpifrance Le Lab, fin 2025).",
  },
  {
    id: "bpifrance-iag-aucun-usage",
    valeur: "65",
    unite: "%",
    perimetre:
      "TPE-PME françaises n’utilisant pas l’IA générative et ne prévoyant pas d’y recourir à court terme, sans usage identifié",
    annee: 2025,
    source:
      "Bpifrance Le Lab, 82e baromètre semestriel de conjoncture TPE-PME, communiqué du 13 janvier 2026",
    url: "https://presse.bpifrance.fr/bpifrance-le-lab-presente-le-82eme-barometre-semestriel-de-conjoncture-aupres-des-tpe-pme-les-dirigeants-font-part-dun-leger-regain-de-confiance-pour-2026/?lang=fra",
    consulteLe: "2026-11-18",
    extrait: "n'identifient pas d'usage au sein de leur entreprise (65 % d'entre elles)",
    citation:
      "Parmi les TPE-PME qui ne prévoient pas d’utiliser l’IA générative, 65 % n’identifient pas d’usage dans leur entreprise (Bpifrance Le Lab, fin 2025).",
  },
  {
    id: "francenum-ia-tpe-pme-2026",
    valeur: "40",
    unite: "%",
    perimetre: "TPE et PME françaises, au moins une solution d’IA, baromètre France Num 2026",
    annee: 2026,
    source:
      "Direction générale des Entreprises, Baromètre France Num 2026, communiqué du 28 septembre 2026",
    url: "https://www.entreprises.gouv.fr/espace-presse/barometre-france-num-2026-quatre-tpe-pme-sur-dix-utilisent-desormais-lintelligence",
    consulteLe: "2026-11-18",
    extrait:
      "40 % des TPE PME utilisent désormais des solutions d’intelligence artificielle, soit 14 points de plus en un an.",
    citation:
      "En 2026, 40 % des TPE et PME françaises utilisent des solutions d’intelligence artificielle, soit 14 points de plus en un an (baromètre France Num).",
  },
  {
    id: "francenum-ia-pme-2026",
    valeur: "53",
    unite: "%",
    perimetre: "PME françaises, au moins une solution d’IA, baromètre France Num 2026",
    annee: 2026,
    source:
      "Direction générale des Entreprises, Baromètre France Num 2026, communiqué du 28 septembre 2026",
    url: "https://www.entreprises.gouv.fr/espace-presse/barometre-france-num-2026-quatre-tpe-pme-sur-dix-utilisent-desormais-lintelligence",
    consulteLe: "2026-11-18",
    extrait: "Chez les PME, cette proportion atteint 53 % (+19 points).",
    citation:
      "En 2026, 53 % des PME françaises utilisent des solutions d’intelligence artificielle (baromètre France Num).",
  },
  {
    id: "francenum-ia-payante-2026",
    valeur: "19",
    unite: "%",
    perimetre:
      "TPE et PME françaises utilisant des solutions d’IA payantes, baromètre France Num 2026",
    annee: 2026,
    source:
      "Direction générale des Entreprises, Baromètre France Num 2026, communiqué du 28 septembre 2026",
    url: "https://www.entreprises.gouv.fr/espace-presse/barometre-france-num-2026-quatre-tpe-pme-sur-dix-utilisent-desormais-lintelligence",
    consulteLe: "2026-11-18",
    extrait: "19 % utilisent des solutions payantes, une proportion qui atteint 32 % chez les PME.",
    citation:
      "En 2026, 19 % des TPE et PME françaises utilisent des solutions d’IA payantes (baromètre France Num).",
  },
  {
    id: "francenum-ia-impact-positif-2026",
    valeur: "68",
    unite: "%",
    perimetre:
      "TPE et PME françaises utilisant l’IA, estimant qu’elle a un impact positif sur leur activité",
    annee: 2026,
    source:
      "Direction générale des Entreprises, Baromètre France Num 2026, communiqué du 28 septembre 2026",
    url: "https://www.entreprises.gouv.fr/espace-presse/barometre-france-num-2026-quatre-tpe-pme-sur-dix-utilisent-desormais-lintelligence",
    consulteLe: "2026-11-18",
    extrait: "68 % considèrent qu’elle a un impact positif sur leur activité",
    citation:
      "Parmi les TPE et PME qui utilisent l’IA, 68 % estiment qu’elle a un impact positif sur leur activité (baromètre France Num 2026).",
  },
  {
    id: "ce-ai-act-maitrise-ia",
    valeur: "2 février 2025",
    unite: "date",
    perimetre:
      "règlement européen sur l’IA : interdictions et obligations de maîtrise de l’IA (article 4), applicables depuis cette date",
    annee: 2026,
    source:
      "Commission européenne, Cadre réglementaire sur l’IA (AI Act), calendrier d’application",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    consulteLe: "2026-11-18",
    extrait:
      "prohibited AI practices and AI literacy obligations entered into application from 2 February 2025",
    citation:
      "Les obligations de maîtrise de l’IA (article 4 de l’AI Act) s’appliquent depuis le 2 février 2025 (Commission européenne).",
  },
  {
    id: "ce-ai-act-application-generale",
    valeur: "2 août 2026",
    unite: "date",
    perimetre:
      "règlement européen sur l’IA : date à partir de laquelle il est applicable, sous réserve d’exceptions",
    annee: 2026,
    source:
      "Commission européenne, Cadre réglementaire sur l’IA (AI Act), calendrier d’application",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    consulteLe: "2026-11-18",
    extrait:
      "The AI Act entered into force on 1 August 2024 and became applicable on 2 August 2026, with some exceptions",
    citation:
      "L’AI Act est devenu applicable le 2 août 2026, avec quelques exceptions (Commission européenne).",
  },
  {
    id: "ce-ai-act-haut-risque-annexe-3",
    valeur: "2 décembre 2027",
    unite: "date",
    perimetre:
      "règlement européen sur l’IA : règles pour les systèmes à haut risque de l’annexe III, reportées par l’omnibus IA",
    annee: 2026,
    source:
      "Commission européenne, Cadre réglementaire sur l’IA (AI Act), calendrier d’application",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    consulteLe: "2026-11-18",
    extrait: "will apply from 2 December 2027",
    citation:
      "Les règles pour les systèmes d’IA à haut risque de l’annexe III s’appliquent à partir du 2 décembre 2027 (Commission européenne).",
  },
];
