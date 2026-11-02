/**
 * Catalogue des rôles de l'équipe d'analyse (2026-11-02) — générique, aucun secteur ni client.
 *
 * Le CHEF D'ORCHESTRE lit le profil de l'entreprise et choisit parmi ces rôles ceux qu'il active,
 * puis AJOUTE un ou plusieurs spécialistes du secteur (ex. : santé, bâtiment, droit, transport…) avec
 * leurs questions de recherche. Ce fichier ne nomme aucun secteur : le spécialiste de secteur est
 * composé à l'exécution, pas codé ici.
 *
 * Hiérarchie : chef d'orchestre → (besoins) → spécialistes → analyste croisé → critique → rédacteur.
 * Opus pour penser, critiquer et rédiger ; Sonnet pour chercher et relever (modeles.ts).
 */

import type { SECTIONS_ANALYSE } from "../base-audit-schema";
import { MODELES_RAPPORT } from "../modeles";

type SectionAnalyse = (typeof SECTIONS_ANALYSE)[number];

export interface RoleAnalyse {
  readonly id: string;
  readonly titre: string;
  readonly modele: (typeof MODELES_RAPPORT)[keyof typeof MODELES_RAPPORT];
  /** Peut interroger le web (outil de recherche). */
  readonly recherche: boolean;
  /** Toujours actif, ou choisi par le chef d'orchestre. */
  readonly socle: boolean;
  readonly mission: string;
  /** Sections de la base d'audit que ce rôle alimente. */
  readonly sections: ReadonlyArray<SectionAnalyse>;
}

export const ROLES: ReadonlyArray<RoleAnalyse> = [
  {
    id: "besoins",
    titre: "Analyste des besoins déclarés",
    modele: MODELES_RAPPORT.reflexion,
    recherche: false,
    socle: true,
    mission:
      "Relever, dans les réponses, ce que les personnes disent vouloir, subir ou craindre : douleurs, souhaits, objectifs, contraintes, priorités. Citer leurs mots exacts, dire qui l'a écrit, combien de personnes le disent, et où la direction et les équipes divergent. Ne rien ajouter qu'elles n'aient dit.",
    sections: [],
  },
  {
    id: "identite_finances",
    titre: "Identité, finances et évolution de l'activité",
    modele: MODELES_RAPPORT.execution,
    recherche: true,
    socle: true,
    mission:
      "Trouver sur le web et dans les registres : identité légale, dirigeants, capital, effectif, établissements, et SURTOUT les chiffres d'affaires, résultats et effectifs de chaque exercice publié, pour permettre de lire la croissance ou la décroissance. Chaque chiffre avec son lien. Préférer les comptes déposés et les sources officielles ; un annuaire privé = confiance « probable ». Si les comptes ne sont pas publiés, le dire.",
    sections: ["identite", "finances"],
  },
  {
    id: "offre_marche",
    titre: "Offre, clients, marché et concurrence",
    modele: MODELES_RAPPORT.execution,
    recherche: true,
    socle: true,
    mission:
      "Établir ce que l'entreprise vend, à qui, avec quelle différence, face à quels concurrents, dans quel marché (taille, tendance, réglementation commerciale). Comparer avec ce que l'entreprise dit d'elle-même.",
    sections: ["activite_offre", "commercial_clients", "marche_concurrence"],
  },
  {
    id: "numerique_outils",
    titre: "Présence numérique et système d'information",
    modele: MODELES_RAPPORT.execution,
    recherche: true,
    socle: true,
    mission:
      "Relever ce qui est visible depuis l'extérieur : site (technologie, hébergement, domaine et son échéance), messagerie, outils détectables, présence sur les réseaux professionnels. Confronter avec les outils que l'entreprise déclare utiliser et signaler les écarts.",
    sections: ["presence_numerique", "outils_systeme_information", "donnees"],
  },
  {
    id: "reputation",
    titre: "Réputation et signaux publics",
    modele: MODELES_RAPPORT.execution,
    recherche: true,
    socle: true,
    mission:
      "Relever avis, presse, récompenses, offres d'emploi (ce qu'elles disent des outils et de l'organisation), annonces légales. Sources publiques uniquement.",
    sections: ["reputation"],
  },
  {
    id: "organisation_processus",
    titre: "Organisation, processus et temps perdu",
    modele: MODELES_RAPPORT.reflexion,
    recherche: false,
    socle: true,
    mission:
      "À partir des seules réponses : décrire l'organisation, les processus clés, les ressaisies, les tâches répétitives et le temps qu'elles prennent, par service. Chiffrer ce que les personnes ont chiffré, sans extrapoler. Dire quels services n'ont pas répondu.",
    sections: ["organisation_equipe", "processus"],
  },
  {
    id: "maturite_ia",
    titre: "Maturité numérique et IA",
    modele: MODELES_RAPPORT.reflexion,
    recherche: false,
    socle: true,
    mission:
      "Évaluer, à partir des réponses et des constats du web, la maturité : outils, données, sécurité et conformité déclarées, usage actuel de l'IA, freins et appétit pour le changement.",
    sections: ["maturite_ia", "reglementaire"],
  },
  {
    id: "specialiste_secteur",
    titre: "Spécialiste du secteur (composé pour ce client)",
    modele: MODELES_RAPPORT.execution,
    recherche: true,
    socle: false,
    mission:
      "Rôle CRÉÉ par le chef d'orchestre pour le métier du client : enjeux, vocabulaire, normes, logiciels et pratiques propres à ce secteur, et ce que les entreprises comparables ont déjà automatisé.",
    sections: ["marche_concurrence", "reglementaire", "processus"],
  },
];

/** Étapes de synthèse, hors des spécialistes. */
export const ROLES_DE_SYNTHESE = {
  chef: { titre: "Chef d'orchestre", modele: MODELES_RAPPORT.reflexion },
  analyste: { titre: "Analyste croisé", modele: MODELES_RAPPORT.reflexion },
  critique: { titre: "Critique", modele: MODELES_RAPPORT.reflexion },
  redacteur: { titre: "Rédacteur", modele: MODELES_RAPPORT.reflexion },
} as const;
