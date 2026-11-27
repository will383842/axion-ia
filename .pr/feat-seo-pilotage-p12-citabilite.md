# SEO pilotage P12 : score de citabilité d'une page

## Ce que fait cette PR

Elle ajoute un calcul pur (aucun réseau, aucun modèle, aucun JavaScript exécuté) qui note sur 100 la « citabilité » d'une page publique : à quel point un moteur de réponse peut la citer. Il lit le HTML rendu et rend un score, le détail par critère et les pénalités.

Le score sert à **prioriser le travail éditorial**. Il n'agit sur rien et n'est encore branché à aucun appelant (la tâche hebdomadaire et le remplacement de `scripts/seo-audit.ts` restent à faire ; la checklist le dit honnêtement).

Fichiers :

- `src/server/seo-pilotage/citabilite/score.ts` : la grille (11 critères, total 100, voir `PLAN.md` § 3.5) et les pénalités.
- `src/server/seo-pilotage/citabilite/faits.ts` : faits « canon » (prix de la Journée IA, délai du rapport) lus à la source (`pricing.ts`, `journee-ia-commun.ts`), jamais recopiés ; mots interdits de la doctrine.
- `src/server/seo-pilotage/citabilite/__tests__/score.spec.ts` : 63 tests.
- `docs/content-gen/seo-aeo-60-items-checklist.md` : corrections d'honnêteté (la gate CI n'existe pas encore ; réponse directe 40-90 mots ; ≥ 3 H2 sans plafond).

## Corrections issues de la relecture

- **Coût linéaire** : extraction des blocs en une passe, chevrons orphelins neutralisés, commentaires non fermés coupés. Des entrées hostiles de 1 Mo (balises non fermées, chiffres collés…) passent en moins d'une seconde. Les tests de temps testent maintenant de vrais cas pathologiques.
- **JSON-LD** : seules les organisations posées au niveau du document ou de `@graph` comptent comme définitions ; un `recognizedBy` ou `publisher` imbriqué (organisme certificateur) ne fait plus tomber le critère à 0. Les dates d'un `WebSite` ou d'une image ne datent plus la page. Un JSON-LD en commentaire HTML est ignoré.
- **Faits canon** : « par rapport à » n'est pas le rapport remis ; un autre délai après un point-virgule n'est pas jugé ; les blocs voisins (titres, cartes) ne fusionnent plus en une seule phrase.
- **Mots interdits** : sur une page, seuls le slogan « Nous, si. » et l'étiquette « TPE-PME » sont tolérés ; faux partenariat, fausse statistique et faux témoignage restent pénalisés partout.
- **Questions de titres** : « Questions fréquentes », « Quelques… », « Commentaires » ne comptent plus comme des questions.
- **Date visible** : un `<time>` hors du contenu principal (pied de page) ne compte pas.
- **Page réelle** : un test sur un rendu complet reconstitué (graphe JSON-LD global, hero, srcset long, script Next, pied de page) remplace l'extrait de six lignes. Une vraie page de production n'était pas accessible depuis cet environnement.

## Vérifications

- `pnpm vitest run src/server/seo-pilotage/citabilite` : 63 tests verts.
- ESLint et Prettier propres sur les fichiers touchés ; aucune erreur de types dans le périmètre (les autres erreurs de `pnpm typecheck` viennent du client Prisma non généré dans cet environnement).
- Aucun changement de contrat app↔worker, aucune migration, aucun impact sur le budget Web Vitals (code serveur pur).

## Points connus, non bloquants

- Un `<!--` dans une chaîne d'un `<script>` non échappé peut effacer du JSON-LD voisin (les composants du site échappent `<`, risque faible).
- Délais séparés par une virgule dans une même phrase : encore jugés ensemble.
- Au branchement : d'autres codes de doctrine (ex. « réservation-paiement » sur `/appel`, « Grenoble » en mentions légales) coûteront 20 points ; vérifier le périmètre des pages notées.

VERDICT OPUS : BON
