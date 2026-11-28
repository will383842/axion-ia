# Baromètre 2027 : ouverture dès le 28 novembre (B7)

Le baromètre 2027 (page publique et questionnaire) ouvre le 28 novembre 2026 au lieu du 1er décembre.

## Ce qui change

- La page du baromètre devient publique (indexable, dans le sitemap et dans Ressources) dès le 28 novembre 2026, 00:00 heure de Paris.
- Le questionnaire est ouvert : l'interrupteur est allumé et sa date de début passe au 28 novembre 2026.
- Les dates de publication et de modification de la page sont le 28 novembre 2026.
- Les textes et commentaires qui citaient le « 1er décembre » disent maintenant « 28 novembre 2026 ».
- La route de la page est ajoutée à la liste des routes publiques auditées par les tests E2E.

## Fichiers

- `src/content/barometre-2027/donnees.ts` : date d'ouverture, de publication et de modification, commentaire.
- `src/lib/barometre-questionnaire/constantes.ts` : `QUESTIONNAIRE_OUVERT = true`, `DATE_DEBUT_COLLECTE = "2026-11-28"`.
- `src/content/barometre-questionnaire/textes.ts` : texte « pas encore ouvert » (date citée).
- `src/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page.tsx` : commentaire.
- `src/content/barometre-2027/__tests__/barometre.spec.ts` : dates autour du 2026-11-28T00:00:00+01:00.
- `src/lib/barometre-questionnaire/__tests__/constantes.spec.ts` : interrupteur allumé, nouvelle date de début ; le cas « interrupteur éteint » reste testé en passant `false`.
- `tests/e2e/qualiopi/_harness/routes-publiques.json` : ajout de `/fr/ressources/barometre-ia-tpe-pme-2027`.
- `tests/unit/e2e-harness/routes-publiques-existent.spec.ts` : la route quitte `HORS_AUDIT`.

## À savoir

- `DATE_DEBUT_COLLECTE` fonctionne aussi comme barrière : elle est en UTC (minuit UTC = 1 h à Paris), alors que la page ouvre à minuit Paris. Entre 0 h et 1 h le 28 novembre, la page est publique mais le questionnaire dit encore « fermé ». Sans conséquence ici.
- L'ouverture réelle suit le déploiement (créneaux fixes) et la revalidation de la page (1 h).
- `pnpm typecheck` a d'abord planté faute de mémoire ; relancé avec `NODE_OPTIONS=--max-old-space-size=8192`.
- Le lockfile n'a pas été touché.

Fiche: B7
