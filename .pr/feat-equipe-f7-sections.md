# Pages équipe F7 : sections propres à chaque catégorie et FAQ modèle

## Quoi

La fiche d'un collaborateur affiche maintenant, selon sa catégorie, des sections propres, deux boutons d'action et une FAQ modèle (3 à 4 questions).

- Spécialiste IA : formations et accompagnements ; métiers et secteurs (seulement si la fiche a des compétences).
- Développeur : ce qu'il construit ; technologies et méthodes (seulement avec données) ; sécurité et confidentialité.
- Apporteur d'affaires : rôle (mise en relation, pas vente) ; « Vous avez été contacté ? » ; devenir apporteur (lien vers `/devenir-commercial-ia`). Aucun montant, taux ni commission.
- Partenaire : ce qu'il apporte ; comment il travaille avec l'équipe.
- Direction (Williams) et persona IA (Manon) : inchangées.

## Comment

- Registre : `src/lib/equipe/modeles-categorie.ts` (sections, boutons, FAQ par catégorie), branché dans `CATEGORIES[...].modele`. Ajouter une catégorie = une entrée + ses textes.
- `depuis-membre.ts` remplit `{prenom}` (prénom seul), produit les sections et fusionne la FAQ : réponses de la personne d'abord, modèles ensuite. La FAQ passe donc aussi dans le JSON-LD existant.
- Composants : `SectionsCategorie` (un H2 par section, jamais de section vide) et `ActionsFiche` (boutons du registre, ou les deux boutons par défaut pour Williams).
- Aucune migration, aucun job, aucun enum.

## Vérifier

`pnpm vitest run src/components/equipe src/lib/equipe src/lib/seo` (438 tests verts, dont `sections-categorie.spec.tsx` et le garde Williams). Lint propre.

## Risques

- Textes modèles (sécurité/RGPD du développeur, rôle du partenaire) à faire relire côté contenu.
- Le JSON-LD FAQ n'est émis que pour une fiche indexable (règle existante).

VERDICT OPUS : EN COURS
