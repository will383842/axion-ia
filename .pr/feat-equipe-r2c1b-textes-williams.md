# Pages équipe, lot R2c1 : textes de Williams et types

## Résumé

- Les textes de la fiche de Williams Jullin sont réécrits selon le plan (titre, meta, phrase du héros, avant/après, méthode, services, FAQ, appel final).
- Nouveau bloc « Vous êtes… » : 3 cartes par taille d'entreprise et 8 cartes par métier. Chaque carte suit trois temps (coût, action, gain), sans chiffre.
- Nouveau bloc « Partout en France » : question H2 et réponse de 40 à 60 mots. Les villes et les régions ne sont pas écrites ici : elles seront lues dans les données des pages de ville (lot d'assemblage).
- Une réponse directe de 40 à 60 mots par section (`WILLIAMS_ENTETES`).
- FAQ : 10 questions (sans financement). « Transformer son entreprise… » sort de la FAQ (couverte par un H2), trois questions ajoutées.
- Types optionnels ajoutés dans `contenu.ts` et passés dans `adaptateurs.ts`. Aucune migration, aucun job, aucune dépendance.
- `WILLIAMS_PREUVES` est gardée (retrait en R2d). La date de révision n'est pas avancée (R2d).

## Fichiers

- `src/content/equipe/williams.ts`, `src/lib/equipe/contenu.ts`, `src/lib/equipe/adaptateurs.ts`
- Tests : `src/content/__tests__/equipe-williams-textes.spec.ts`, `src/components/equipe/__tests__/profil-williams.spec.tsx` (attentes de titres et de nombre de questions)

## Points à noter

- Le test de vocabulaire accepte désormais « agence immobilière » et « restauration » (métiers demandés) ; « agence » reste interdit ailleurs.
- Les composants ne lisent pas encore les nouveaux champs (lot R2d). Le H2 des services et celui de l'appel final changent de texte dès maintenant.
- `pnpm-lock.yaml` : non touché, pas de changement de branche avec dépendances différentes.

## Vérifications lancées

- `pnpm typecheck` (avec plus de mémoire) : OK.
- Tests ciblés (fiche Williams, composants équipe, JSON-LD, textes publics) : 359 réussis.
- ESLint et Prettier sur les fichiers touchés ; grep des mots interdits : rien.

## Relecture Opus

Onze remarques. Corrigées : « trois fois » (chiffre inventé), H2 « celles-ci » (ne tenait pas hors de la page), réponse « avant/après » qui ne nommait pas Axion-IA, « startup » en dur, typage strict des en-têtes (`Record<IdSection, …>`), doublon du type `CarteVousEtes`, titres « Vous dirigez une agence… », promesse absolue « aucun prospect oublié », intitulé de test. Non retenues, volontairement : la phrase de la FAQ « contact » (texte du plan) et le retrait de la Journée IA du héros (phrase prescrite par le plan).

Après corrections : typecheck OK, 176 tests ciblés réussis.

VERDICT OPUS : BON

## Reprise sur main

Branche neuve `feat/equipe-r2c1b-textes-williams` depuis `origin/main` (l'ancienne branche était en conflit). Apports réappliqués à la main, sans toucher à `src/lib/seo/williams-person.ts`.

- **Un seul type de carte « Vous êtes »** : `CarteVousEtes` vit dans `contenu.ts` ; `modeles-categorie.ts` le ré-exporte (R2c2). `CleIcone` vit aussi dans `contenu.ts` ; `visuels/icones.ts` le ré-exporte (R2a).
- **Champs communs de `ContenuFiche`** : `entetes` (type `EnteteSection`, déplacé depuis `depuis-membre.ts`, réponse facultative), `chiffresCles`, `pourQui` (question facultative, lien facultatif), `vousEtes` (cartes par taille), `presence`, `pastillesDetaillees`, `liensInternes`. `ExtensionContenuR2c2` ne garde plus que `presence` et `iconesIdentite`.
- **Écarts avec l'ancienne branche** : le second groupe « par métier » est `vousEtesMetiers` (au lieu de `vousEtes.{tailles,metiers}`) ; « Partout en France » passe par `presence` (au lieu de `partoutEnFrance`), pour ne pas dupliquer R2c2.
- **Titre SEO et meta de Williams : ceux de main** (Search Console #2544, « Williams Jullin, fondateur d'Axion IA ») ; ceux de l'ancienne branche sont abandonnés. Le test est adapté.
- Test de plan de titres de main conservé (R2b1/R2b2), mis à jour : nouveaux H2, titres courts des tuiles, 10 questions.

Tests réels : `pnpm typecheck` OK ; `pnpm vitest run src/lib/equipe src/components/equipe src/content src/lib/seo` : 167 fichiers passés, 2333 tests passés ; eslint et prettier OK sur les fichiers touchés. Aucun diff de `pnpm-lock.yaml`, aucune dépendance, migration, job ni enum.

VERDICT OPUS : BON
