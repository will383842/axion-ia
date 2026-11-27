# Fiche S2 du chantier SEO : tri de l'indexation (conception seulement)

## Pourquoi
Search Console signale environ 4 129 pages en noindex et 1 566 pages explorées mais non indexées sur axion-ia.com. Le but : que Google garde seulement les pages utiles et que les bonnes pages y entrent.

## Ce que contient cette PR
Un seul fichier : `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md`. Aucun code produit n'est changé.

La fiche dit, pour chaque famille de pages noindex : d'où elle vient (fichier et règle), si elle doit rester noindex, être indexée ou sortir du plan du site. Elle propose aussi un découpage en petites PR testables.

## À retenir
- La plupart des noindex sont voulus (communes hors des 40 villes retenues, pages service × ville, anciennes actualités).
- Deux contradictions certaines : le plan du site de la galerie et celui de la presse listent des pages que la page elle-même met en noindex. Une troisième (base de connaissances) est à vérifier.
- Cause probable des « explorées mais non indexées » : des articles notés sous 70, indexables mais absents du plan du site.
- Un article classé tier-2 remonte presque jamais en tier-1 (il faut 100 impressions, et une page noindex n'en a presque pas).

## Découpage proposé
- Automatique (retrait du plan du site des pages faibles, sans effet Web Vitals) : S2-0 mesure, S2-1 galerie, S2-2 presse, S2-3 base de connaissances, S2-4 hygiène et verrous.
- Avec Will obligatoirement : S2-5 (articles sous 70), S2-6 (liens communes proches), S2-7 (FAQ générées), S2-8 (impasse tier-2). Rien sur adresses, offres, prix, légal ou apporteurs sans Will.

## Relecture
Un second agent Opus a relu la fiche contre le code et corrigé plusieurs numéros de ligne et trois affirmations. Plusieurs volumes sont marqués « non mesuré » (il faut la base ou Search Console).

Je n'ai pas pu ouvrir la PR moi-même : à ouvrir en brouillon.

VERDICT OPUS : BON
