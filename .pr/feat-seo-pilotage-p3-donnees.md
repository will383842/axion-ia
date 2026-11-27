# feat(seo-pilotage) : P3, module pur des données

Lot P3 de `docs/pilotage-seo-geo/DECOUPAGE.md` (document sur `origin/docs/pilotage-seo-geo-conception`, absent de `main`). Module pur, non branché : aucune base, aucun réseau, aucun import depuis `src/app`, aucune migration, aucun frontend.

## But

Poser les fonctions de données dont dépendront l'ingestion Search Console (P4) et les détecteurs (P7).

## Fichiers (`src/server/seo-pilotage/donnees/`)

- `chemins.ts` : `normaliserChemin` (hôte, `www`, slash final, query, fragment, minuscules ; `/en/…` ramené au FR par `mapEnToFr` ; hôte étranger ou valeur illisible → `null`, donc isolée).
- `types-page.ts` : `typePageDepuisChemin` et `TYPES_PAGE` (table par segment ; `categories.ts` n'a ni faq, ni guide, ni actualité).
- `agregats.ts` : `positionSum`, `positionMoyenne` (nulle sans impression), `partAnonymisee`, `semaineIso`, `cumulerParSemaineIso`.
- `personnel.ts` : `filtrerDonneesPersonnelles` (e-mails, téléphones, noms injectés ; compte ce qui est retiré, sans seuil journalier) et `requetesARetirerDuTexte` (moins de 3 impressions cumulées sur 90 jours).
- `interdits.ts` : `verdictRequete` / `filtrerInterdits` (ville interdite + `detecterInterdits` existant ; classe, ne supprime aucune mesure).
- `index.ts` : réexport.
- Tests : `donnees/__tests__/*.spec.ts` (137 tests).

## Tests

Variantes d'hôte, de slash, de query et de fragment ; `/en/` ramené à FR ; un type de page par section, plus un test paramétré qui confronte la table à `categorizeRoute` pour chaque section connue ; frontières d'année ISO (2020-W53, 2025-W01) ; nom connu jamais conservé (casse, accents, ordre) ; position nulle sans impression ; « iso 27001 2022 » n'est pas pris pour un téléphone.

## Vérifications

- `pnpm vitest run src/server/seo-pilotage` : 137 verts. ESLint et `tsc` : rien sur les fichiers ajoutés.
- `pnpm typecheck` global rouge ici pour une raison étrangère : le client Prisma n'est pas généré dans cet environnement (`prisma/generated/client` absent). `node_modules` était aussi absent : installé par `pnpm install --frozen-lockfile --ignore-scripts`.

## Risques

- Aucun branchement : risque d'exécution nul. Réutilise `mapEnToFr`, `normaliserPourControle`, `detecterInterdits` sans les modifier.
- Le filtre de téléphones est volontairement étroit (formats français et « + » international) pour ne pas vider des requêtes comme « iso 27001 2022 » ; un numéro écrit en groupes inhabituels peut passer.
- Les noms d'un seul mot sont retirés en mot entier : un nom commun injecté retirera aussi les requêtes qui le contiennent (choix prudent pour la vie privée).
- `contenu` hors blog/guides/actualités (glossaire, connaissances…) → `article` ; `presse` → `institutionnel` : à revoir en P7 si besoin.
- `categories.ts` : seul changement hors module, `SECTION_TO_CATEGORY` est exportée (aucun changement de comportement) pour que le test de cohérence parcoure toute la table.
- Points mineurs connus : nom collé cherché en sous-chaîne (un nom comme « Marc Hand » retirerait « marchand ia ») ; `/fr/blog%3Fx` décodé en `/fr/blog?x` ; un numéro vert d'entreprise est retiré comme un téléphone.

## Relecture

Deux tours de relecture Opus en lecture seule. Tour 1 : à corriger (purge qui rendait des clés normalisées, trous du filtre e-mail, téléphone et nom collé, test de cohérence non exhaustif, sections classées « autre », forme du chemin selon l'entrée, schémas non http, NaN dans le cumul) ; tout corrigé. Tour 2 : aucun problème bloquant.

VERDICT OPUS : BON
