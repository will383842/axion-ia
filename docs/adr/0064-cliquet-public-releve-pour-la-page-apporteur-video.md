# ADR 0064 — Cliquet des pages publiques relevé de 265 à 280 KB pour la page apporteur avec vidéo

- **Statut** : **ACCEPTÉ** — décision de Will, en chat, le 2026-10-05 (« ok pour A »)
- **Date** : 2026-10-05
- **Auteur** : Claude, sous mandat de Will
- **Référence** : `package.json` (bucket `size-limit` « SOMME des page chunks PUBLICS »), ADR 0049, PR #1309, `AGENTS.md` (« Performance budget »)

## Pourquoi cet ADR existe

`AGENTS.md` exige un ADR et l'accord de Will pour tout patch qui dégrade un seuil de
performance. Ce patch relève une limite de la CI : il est donc tracé ici.

## 1. Le constat

La CI mesure **279,22 KB brotli** pour la somme des page chunks publics (limite 265 KB,
dépassement de 14,22 KB) après l'ajout de `/fr/apporteur-affaires/video` et
`/fr/apporteur-affaires/video/merci`. Ce sont deux routes `noindex`, réservées à la
publicité : hors sitemap, non maillées depuis le site.

## 2. Ce que le seuil mesure, et ce qu'il ne mesure pas

Le cliquet est une **somme de tous les page chunks publics** (ADR 0049), pas un budget par
route. Toute nouvelle page publique l'augmente mécaniquement ; il ne dit rien sur le poids
d'une page prise seule.

## 3. La mesure après allègement

Les textes du navigateur ont été séparés des textes du serveur, l'étape 2 du formulaire,
le lecteur vidéo et le Calendly sont chargés à la demande. Les chunks des deux pages
pèsent environ **14,6 KB brotli** (page de remerciement 7,76 KB, vidéo 6,86 KB). Ce qui
reste est le formulaire (étape 1, champs, validation, état, historique, pixel), la FAQ et
le bouton collant.

## 4. La décision

Relever la limite de **265 à 280 KB** (marge d'environ 2 KB, soit 5,7 %), plutôt que de
retirer la FAQ, le bouton collant ou le Calendly de la page, qui sont ce qui fait convertir
une page de recrutement payée au clic.

## Garde-fous

- Le shell partagé (138 KB) et la console d'administration (487 KB) ne bougent pas.
- La prochaine page publique ajoutée devra de nouveau rentrer dans 280 KB, ou faire l'objet
  d'un nouvel ADR.
- Les tests `tests/unit/ci/*` (buckets, séparation public/admin, garde de poids) restent en
  place et verrouillent le cliquet.
