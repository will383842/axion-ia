# Gabarits d'articles du blog : conception (phase 1, aucun code)

## But

Refondre les pages d'articles du blog pour qu'elles soient parfaites sur mobile **et** sur ordinateur : design moderne, contrastes forts, hiérarchie claire, mise en page soignée, avec **plusieurs gabarits selon le type de contenu**. Cette étape ne livre que la conception ; rien n'est modifié sous `src/` ni `prisma/`.

## Familles de gabarits retenues (8)

| Gabarit                                       | Types de contenu                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Analyse (article de fond, gabarit par défaut) | `blog_article`, `blog_from_keywords`, `blog_from_title`, `long_tail_keyword`, `pain_point_solution`, `landing_ville` |
| Guide pratique                                | `how_to_x_in_y`, `calculator_roi`, `guide_pilier`                                                                    |
| Comparatif                                    | `comparison`, `vs_comparator`, `alternative_to`                                                                      |
| Sélection (top X)                             | `top_x_in_y`, `best_for_x_in_y`                                                                                      |
| Étude de cas                                  | `case_study_local`                                                                                                   |
| Définition                                    | `what_is_x`, `glossary_term`                                                                                         |
| Questions-réponses                            | `faq_standalone`, `faq_geo`, `qa_derived`                                                                            |
| Chiffres (baromètre)                          | `barometer_insight`                                                                                                  |

L'actualité (`blog_from_rss`) reste sur `/actualites`, hors du périmètre.

## Contraintes écrites dans le plan

- Aucun changement de la sélection des images ni de l'attribution du photographe Unsplash.
- Aucun changement de schéma Prisma, aucune migration.
- Interrupteur `BLOG_GABARITS_V2` : `"true"` = nouveaux gabarits, toute autre valeur = pages actuelles (balisage identique), pour pouvoir revenir en arrière.
- Version anglaise toujours désactivée, mais textes via `next-intl` (`src/messages`).
- Aucun JavaScript client ajouté ; aucun cliquet de poids relevé.

## Ce que la conception a mesuré

- **Poids actuel** de `/blog/[slug]` : **249,70 Ko gz** de JavaScript au premier chargement (cible : 75 Ko). Le dépassement (×3,3) vient du socle et du layout, pas du gabarit d'article ; il est valable pour tout le site. La refonte ne doit pas l'aggraver (objectif : 0 octet de JS ajouté).
- **Contrastes** calculés sur les vraies couleurs de la marque (tableau chiffré dans le plan) : texte courant en AAA ; paires interdites listées (terracotta sur sable-deep, ochre en texte, tout texte coloré sur mocha sauf ivoire et terracotta clair).
- Trous constatés dans les garde-fous : aucune URL de blog dans Lighthouse post-déploiement, les chunks de l'article ne sont vus par aucune gate.

## Maquettes (`docs/design/gabarits-articles/maquettes/`)

Pages HTML autonomes, responsives, aux couleurs de la marque, sans prix ni donnée client : `index.html`, `analyse.html`, `guide.html`, `comparatif.html`, `selection.html`, `etude-de-cas.html`, `definition.html`, `faq.html`, `chiffres.html`. Vérifiées à 360 px et 1280 px (aucun défilement horizontal, un seul h1, aucun saut de titre).

## Découpage des PR d'implémentation (`DECOUPAGE.md`)

1. **S1** socle : interrupteur, type de contenu, aiguillage. En parallèle avec **S3** (transformations de contenu : tableaux défilants, ancres, h1).
2. **S2** composants communs, jetons et feuilles de style (après S1).
3. **G1 à G8**, un gabarit par PR (analyse, guide, comparatif, sélection, cas, définition, FAQ, chiffres) : fichiers disjoints, donc **parallèles entre elles**.
4. **J1** données structurées (derrière l'interrupteur), **T1** garde-fous de test et de mesure (axe, Lighthouse en avertissement), **F1** correctif du `BreadcrumbList` en double sur `/guides/[slug]` (hors interrupteur, à valider).

## Décisions à prendre par le propriétaire

- Chargement différé du formulaire newsletter (≈ 24 Ko gz, première économie possible).
- Page canonique des termes de glossaire (`/blog` ou `/glossaire`).
- Étude de cas : le générateur demande des chiffres et un témoignage non vérifiables, à revoir côté générateur.
- Mesurer la répartition du stock par type (requête SQL dans le plan).
- F1 (correctif SEO hors interrupteur).

## Équipe

Quatre experts en lecture seule (interface, accessibilité, performance, SEO/GEO) puis un critique design qui a tranché les désaccords (consignés dans le plan §3). Première relecture : « À CORRIGER » (6 bloquants), tous corrigés ; seconde relecture : validé.

VERDICT OPUS : BON
