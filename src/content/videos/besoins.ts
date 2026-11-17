/**
 * LISTE FERMÉE DES BESOINS D'ENTREPRISE DES VIDÉOS (SEO-06, `usine/seo/FICHE-DE-PAGE.md` §5).
 *
 * Seconde entrée de classement du hub, à côté des thèmes (le « type » de contenu). Une vidéo
 * n'a pas de champ « besoin » : elle y est rattachée par son thème, via `themes`. Une page de
 * besoin n'existe qu'à partir de `SEUIL_PAGE_GROUPE` vidéos (même seuil que les thèmes) ; en
 * dessous, rien n'est indexable. Aucun prix, aucun résultat promis, aucun client cité.
 */

export interface BesoinEntreprise {
  readonly slug: string;
  readonly libelle: string;
  /** Meta description de la page de besoin. */
  readonly description: string;
  /** Intro visible en tête de la page de besoin. */
  readonly intro: string;
  /** Thèmes dont les vidéos répondent à ce besoin. */
  readonly themes: ReadonlyArray<string>;
}

export const BESOINS: ReadonlyArray<BesoinEntreprise> = [
  {
    slug: "gagner-du-temps",
    libelle: "Gagner du temps",
    description:
      "Des vidéos courtes pour repérer les tâches répétitives de votre entreprise et comprendre comment l'IA peut vous en décharger, étape par étape.",
    intro:
      "Dans beaucoup d'entreprises, une part importante de la semaine part dans des tâches qui se répètent : recopier des informations, préparer les mêmes documents, relire les mêmes messages. Les vidéos réunies ici partent de ce constat et répondent à une question simple : par où commencer pour récupérer du temps utile ? Elles expliquent comment repérer les tâches qui s'y prêtent, comment les décrire clairement, comment tester sur quelques cas avant de généraliser et comment garder la main sur le résultat. Certaines abordent la formation d'une équipe, d'autres l'accompagnement individuel, l'audit ou l'automatisation, mais toutes gardent le même fil : un gain concret, expliqué sans jargon, avec ses limites écrites noir sur blanc. Chaque vidéo est accompagnée d'un résumé écrit, de points à retenir et de réponses aux questions fréquentes, pour que vous puissiez décider vite si le sujet vous concerne.",
    themes: ["automatisation", "audit-ia", "coaching-ia"],
  },
  {
    slug: "ne-rien-oublier",
    libelle: "Ne rien oublier",
    description:
      "Des vidéos pour comprendre comment ne plus laisser passer une relance, un suivi ou une échéance grâce à des automatisations que vous gardez sous contrôle.",
    intro:
      "Une relance qui part trop tard, un suivi qui se perd entre deux réunions, une demande restée sans réponse : ces oublis ne tiennent pas à un manque de sérieux, mais à une charge de travail qui déborde la mémoire de chacun. Les vidéos de cette page montrent comment confier ces rappels à un enchaînement d'outils, tout en décidant ce qui est envoyé et à quel moment. Elles détaillent comment choisir ce qu'il faut surveiller, comment écrire un message de rappel qui reste naturel, comment vérifier que rien n'est parti par erreur et comment prévoir la marche à suivre quand l'outil se trompe. Les exemples sont tirés du travail quotidien d'une petite entreprise et les notions techniques sont expliquées simplement. Chaque vidéo propose un résumé écrit, trois points à retenir et des réponses aux questions courantes, afin que vous repériez rapidement celle qui correspond à votre situation.",
    themes: ["automatisation"],
  },
  {
    slug: "repondre-plus-vite",
    libelle: "Répondre plus vite",
    description:
      "Des vidéos pour comprendre comment trier les demandes et apporter une première réponse rapide à vos clients, sans perdre le ton de votre entreprise.",
    intro:
      "Un client qui attend une réponse plusieurs jours finit souvent par aller voir ailleurs. Répondre vite ne veut pourtant pas dire répondre à la hâte : il s'agit surtout de bien trier les demandes, de traiter tout de suite celles qui reviennent souvent et de réserver le temps de l'équipe à celles qui demandent un vrai échange. Les vidéos de cette page expliquent comment l'IA peut aider à classer les messages entrants, préparer une première réponse que vous relisez, ou renseigner les visiteurs d'un site sur les questions courantes. Elles insistent sur ce qui reste du ressort des personnes, sur la confidentialité des informations échangées et sur la manière de vérifier ce qu'un assistant affirme. Chaque vidéo est accompagnée d'un résumé écrit, de points à retenir et de réponses aux questions fréquentes, pour juger en quelques lignes si elle répond à votre besoin.",
    themes: ["automatisation", "sites-web-ia"],
  },
  {
    slug: "mieux-se-faire-connaitre",
    libelle: "Mieux se faire connaître",
    description:
      "Des vidéos pour comprendre comment un site web et des outils d'IA aident une entreprise à présenter clairement ce qu'elle fait et à être trouvée.",
    intro:
      "Une entreprise peut faire un excellent travail et rester invisible si personne ne comprend rapidement ce qu'elle propose. Les vidéos de cette page abordent ce besoin sous l'angle du site web : comment présenter une activité en des termes simples, comment structurer les pages pour qu'elles se lisent aussi bien par un visiteur que par un moteur de recherche ou un assistant, et comment faire vivre le contenu dans la durée sans y passer ses soirées. Elles expliquent aussi ce que l'IA peut préparer pour vous, et ce qu'il vous revient toujours de relire et de valider avant publication. Les exemples sont concrets, sans promesse de résultat, et les termes techniques sont expliqués en une phrase. Chaque vidéo s'accompagne d'un résumé écrit, de points à retenir et de réponses aux questions les plus fréquentes pour vous aider à choisir par laquelle commencer.",
    themes: ["sites-web-ia"],
  },
];

export const BESOIN_SLUGS = BESOINS.map((b) => b.slug) as ReadonlyArray<string>;

export function besoinParSlug(slug: string): BesoinEntreprise | null {
  return BESOINS.find((b) => b.slug === slug) ?? null;
}
