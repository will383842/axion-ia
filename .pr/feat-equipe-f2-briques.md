# Équipe F2 : briques visuelles

## Quoi

Cinq composants serveur pour les futures pages équipe, plus une option de la FAQ. Aucune page n'est modifiée.

- `AvatarInitiales` : avatar SVG à initiales, sans requête réseau.
- `PortraitCollaborateur` : vraie photo seulement avec une date de consentement valide, sinon avatar. Conteneur carré réservé (pas de décalage de mise en page).
- `PastilleCategorie` : forme + couleur + libellé (jamais la couleur seule).
- `FicheIdentite` : liste de définitions, sans ligne vide.
- `CarteCollaborateur` : portrait 96 px, prénom en titre, un seul lien.
- `FaqAccordion` : nouvelle option `questionAs="h3"` (par défaut, rien ne change).

## Pourquoi

Socle commun du gabarit des pages collaborateurs. Prénom seul partout (via `nomAffiche`). Couleurs : jetons existants (terracotta, ocre, sauge, prune, mocha), aucun bleu, aucun jeton neuf.

## Comment vérifier

- `pnpm vitest run src/components/equipe src/lib/equipe src/components/marketing/__tests__/FaqAccordion` : le test de contraste lit `globals.css` et exige ≥ 4,5:1 (texte, lettre d'avatar) et ≥ 3:1 (formes) sur l'ivoire.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.

## Points connus

- Un `h3` dans un `<summary>` peut ne pas être annoncé comme titre par certains lecteurs d'écran : option réservée aux fiches équipe, à confirmer par un test axe lors de leur intégration.
- Aucune page touchée : pas de mesure de poids avant/après ; composants serveur uniquement.

VERDICT OPUS : BON
