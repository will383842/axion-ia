/**
 * Fragments d'URL partagés par la console — module PUR, sans dépendance UI.
 *
 * 🔴 Pourquoi ici, et pas dans le composant qui les rend.
 *
 * Un fragment d'ancre s'écrit toujours **deux fois** : sur la cible (`id=`) et
 * sur le lien (`href="#…"`). Ici les deux vivent dans des couches différentes —
 * l'en-tête de page (`components/admin/ui`) porte la cible, la barre de
 * sommaire (`features/admin-qualiopi`) porte le lien. Exporter la constante
 * depuis l'un obligerait l'autre à remonter d'une couche, ce que la règle
 * d'imports du dépôt interdit à juste titre (`no-restricted-imports` :
 * descendant seulement).
 *
 * ⚠️ Et deux copies d'un même fragment divergent. Un lien d'évitement cassé est
 * **invisible** : il ne se voit qu'au clavier, par quelqu'un qui n'a pas
 * d'autre moyen d'avancer dans la page. Personne ne remonterait le défaut.
 */

/**
 * Zone d'actions d'une page admin — cible du lien d'évitement « Aller aux
 * actions ».
 *
 * Sur le hub d'une session, les boutons sont précédés de TOUTES les sections
 * ancrées (douze au 25 août 2026) et de la barre de sommaire : au clavier, les
 * atteindre demandait une quinzaine de tabulations.
 *
 * ⚠️ Le compte est cité pour l'ordre de grandeur, jamais pour être vérifié
 * ici : le catalogue qui fait foi est `ANCRES_HUB_SESSION`, et le défaut
 * grandit avec lui — c'est bien pourquoi le lien d'évitement ne doit pas
 * dépendre d'un nombre.
 */
export const ID_ACTIONS_PAGE = "actions-page";
