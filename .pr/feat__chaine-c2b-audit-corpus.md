Audit du corpus déjà publié (C2b) : rapport en lecture seule des pages faibles, sans impression ou en doublon

## Ce que fait cette PR

Un outil qui LIT les articles, actualités et pages villes déjà publiés et produit un rapport pour un humain. Il signale :

- les contenus très courts (faible valeur) ;
- les pages sans aucune impression dans Search Console (au moins 90 jours après publication) ;
- les doublons de plan entre articles (les intertitres génériques « Conclusion », « FAQ »… ne comptent pas) ;
- les pages villes dont le texte est quasi identique d'une ville à l'autre, au nom de ville près.

Il ne change JAMAIS une URL : aucun noindex, aucune suppression, aucune fusion, aucune redirection, aucune écriture en base, aucune migration (principe 5 du PLAN). Un humain décide page par page.

- Module pur testé : `src/server/seo-pilotage/audit-corpus/` (analyseur + rapport Markdown), 11 tests dont un qui prouve l'absence d'écriture dans les fichiers de l'outil.
- Script : `scripts/audit-corpus-publie.ts`. ÉTEINT par défaut : il ne fait rien sans `--lancer`. Il refuse la base factice du build (`stub.invalid`). Il n'utilise que des `findMany`.
- Une donnée absente n'est jamais lue comme zéro (principe 4) : route supprimée, page noindex, mesure jamais relevée, nombre de mots d'une ville = « indisponible » dans le rapport.

## Limites connues (à lire avec le rapport)

- Pour une ville, la date retenue est la découverte de la route par le Site Explorer, pas le passage en indexable : un « sans impression » peut être prématuré.
- Les impressions du Site Explorer viennent des 25 premières requêtes sur 28 jours : un 0 peut cacher quelques impressions rares.
- Le texte comparé pour les villes est celui des 4 champs générés, pas de la page entière.

## C2c : la PR #2447 (C2) couvre-t-elle déjà la mise en relecture des pages villes ?

Réponse : OUI, en grande partie, mais pas à 100 %.

- Couvert : `scripts/regen-villes-complete.ts` ne passe plus les copies de villes en « approved » sur la seule note (elles restent « generated »), sauf retour arrière `VILLES_AUTO_APPROBATION_ACTIVE=true`. Nouveau module `statutPageVilleApresGeneration`. De plus, les autres types gabaritées passant par le worker de génération sont couverts par la règle générale (auto-publication seulement avec `publicationSansRelectureAutorisee`).
- Non couvert / à vérifier : `ville-hub-copy.ts` enregistre déjà ses copies en « generated » (rien à changer). Mais aucune action de la console ne permet encore de passer une copie en « approved » : la validation se fait à la main en base, ce que #2447 reconnaît dans son code. Les copies déjà « approved » avant la PR restent publiées (non touchées, voulu). Les scripts de test (`src/scripts/test-ville-hub-copy-paris.ts`) ne sont pas concernés.
- Conclusion : C2c n'a pas besoin d'une PR séparée pour l'arrêt de la publication automatique ; reste à décider (Will) d'un écran de validation des copies villes.

## Vérifications

- `pnpm typecheck` : OK. Vitest ciblé : 11/11. Prettier : OK.
- Relectures Opus : tour 1 = À CORRIGER (jointure villes par code INSEE, routes mortes, mesure périmée, intertitres génériques) ; tout corrigé ; tour 2 sur le code final = BON.

VERDICT OPUS : BON
