# Console « Collaborateurs » : liste, fiche, publication, carte, journal

## Quoi

Nouvelle entrée de la console, `/{adminPrefix}/collaborateurs`, réservée aux administrateurs (`super_admin` et `admin`). Elle gère les fiches des pages équipe (modèle `TeamMember`, posé par D1) :

- **Liste** : filtres catégorie et statut, compteur « à valider », pastille « indexable / noindex » (avec ce qu'il manque), interrupteur « point sur la carte » sur la ligne, date de publication.
- **Création et modification** : lieu choisi dans la table `City` (ville ou département, coordonnées calculées par le serveur et arrondies), slug proposé et unique, aperçu en direct, encadré d'indexabilité, accords de publication et LinkedIn avec note de preuve.
- **Publier / dépublier**, avec journal `TeamMemberEvent` à chaque action et `revalidatePath` de `/fr/equipe` et `/fr/equipe/<slug>`.
- Lien dans le menu de la console (groupe Contenu).

Hors de ce lot : questionnaire, écran « À valider », photos, RGPD (retrait, effacement), `ConsentEvent`. Ils viennent dans les tâches suivantes. Rien n'est touché dans `src/server/content-gen/equipe/`.

## Pourquoi

Permettre de créer, relire et publier les fiches sans toucher à la base, en gardant la preuve des accords et un journal de chaque changement.

## Comment c'est protégé

- Le rôle administrateur est revérifié dans **chaque** action serveur (7 sur 7), avant tout accès à la base. Les pages passent par la même exigence.
- Validation Zod stricte : prénom seul (un mot), pas de `<` `>`, pas de caractère de contrôle, pas d'image ni de lien Markdown non https, LinkedIn limité à `/in/…` ou `/company/…` sans requête ni port ni identifiants, adresses normalisées. Identifiants au format UUID.
- Le lieu vient de `City` : le navigateur n'envoie jamais de coordonnées.
- Slug : unique contre `TeamMember.slug`, `previousSlugs`, `AuthorProfile` et les slugs réservés ; refus propre en cas de collision simultanée ; figé après la première publication.
- Publier exige l'accord de publication ; une fiche retirée exige un **nouvel** accord (et une note de preuve nouvelle). La note n'est jamais écrasée : les preuves s'ajoutent.
- Une demande d'effacement (`erasureRequestedAt`) verrouille modification, publication et carte (la dépublication reste possible).
- Écritures conditionnelles sur `updatedAt` et sur la version du formulaire : un formulaire ouvert sur une fiche modifiée entre-temps est refusé.
- Le journal ne contient que des noms de champs et l'identifiant de l'administrateur, jamais de contenu personnel.
- `revalidatePath` est appelé après la validation de la transaction.

## Comment vérifier

1. `pnpm vitest run src/server/actions/equipe src/lib/admin-nav.test.ts` (95 tests d'actions : droits par rôle pour chaque action, validation, slug, journal, concurrence, effacement).
2. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm use-client:check`, `pnpm admin-gardes:check`, `pnpm admin-nav:routes-check`.
3. Dans la console : ouvrir `/collaborateurs`, créer une fiche (brouillon), cocher l'accord avec une note, enregistrer, publier ; vérifier le journal, puis dépublier.

## Points connus et acceptés

- Pas de `ConsentEvent` dans ce lot (il viendra avec le questionnaire) ; la version de l'accord n'est pas comparée à la version courante à la publication.
- Le filtre de texte ne traite pas les liens Markdown « par référence » : le futur rendu public doit assainir le Markdown lui-même (aucune page publique ne lit `TeamMember` pour l'instant).
- La garde de rôle est locale (`super_admin` / `admin`), comme `requireAdminPublish`.
- Les réponses propres à la catégorie (`categoryAnswers`) ne s'éditent pas ici : les éléments « exemple » et « parcours » de l'indexabilité viendront avec le questionnaire.
- Aucune migration, aucune page publique modifiée : pas de mesure Web Vitals à fournir. Le bucket admin du bundle est « hors budget public ».

## Relectures

Relecture Opus (données et sécurité) et audit Opus indépendant, puis second tour : tous les défauts réels ont été corrigés (concurrence, preuve d'accord, effacement, validation, revalidation). Restent les points ci-dessus.

VERDICT OPUS : BON (les défauts du second tour, version du formulaire, longueur d'adresse et prénoms, sont corrigés ; les points mineurs restants sont listés ci-dessus)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
