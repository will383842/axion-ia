VERDICT A CORRIGER sha=7d11e170 (R1) : tests/usine/interrupteurs-inventaire.test.ts:567 (lancé par tests/usine/inventaire/formats.test.ts) reste rouge, hérité de master (« services/site-videos.ts:885 : clé « site.repriseValidees » ni en table ni exclue ») : recenser la clé dans la table (ou l'exclure avec son motif), ou dire dans la PR que ce rouge sort du périmètre ; le correctif d'une ligne du test (c), lui, est juste et prouvé.

## Tête
- `origin/video/FIX-ROUGES-HERITES-MASTER-v21w` = `7d11e1702c60f1d1f9bad83e8b72861718a9e79d` (correspond à 7d11e170, tête inchangée).
- Un seul commit au-dessus de `origin/master` (`05f8a270`).

## Diff (jugé seul, sans fiche : le dépôt des plans est privé)
- 1 fichier, +1/-1 : `tests/tableau/prete-avec-remarques-reglage-v20j.test.ts:73`.
- Le motif `/PARAM_PRETE_AVEC_REMARQUES|…/` devient `/PARAM_PRETE_AVEC_REMARQUES(?![A-Z_])|…/`.
- Petit et en accord avec le nom de la branche. Rien dans `.github/**`, `deploiement/**`, `outils/gardes/**` ni `scripts/echecs-connus.json`, aucun secret, aucun code de `src/**`.
- Cause : `src/services/prete-avec-remarques-iv.ts:9` (`PARAM_PRETE_AVEC_REMARQUES_IV = "imageVideo.preteAvecRemarques"`) lit sa propre clé avec `lireParametre`. L'ancien motif le comptait comme un second lecteur de `tableau.preteAvecRemarques`.
- La promesse ne change pas : le nom du test (c) (« un seul lecteur de la clé dans src/** : tableau-remarques.ts, défaut false, seul true exact allume ») et ses deux `expect` sont inchangés.

## Tests lancés
- `npx vitest run tests/tableau/prete-avec-remarques-reglage-v20j.test.ts tests/image-video/prete-avec-remarques-reglage-v21q.test.ts` → 2 fichiers, 11/11 réussis.
- Témoin : version master du test sur le même arbre → (c) rouge, « + "src/services/prete-avec-remarques-iv.ts" ». Le correctif vise donc bien le rouge hérité.
- `npx vitest run tests/tableau tests/usine/inventaire/formats.test.ts` → 225 fichiers réussis, 1 en échec : l'inventaire des interrupteurs, cf. 1re ligne. Ce rouge est identique sur `origin/master` (vérifié). Il vient de la série « Encart vidéo » (#1781/#1783/#1785), pas de cette branche.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=6144`, sinon le tas sature) → 154 erreurs, toutes déjà présentes avant cette branche. Aucune ne touche le fichier modifié, qui est le seul changement : il n'y a donc aucune erreur nouvelle.
- La suite complète `npx vitest run` n'a pas terminé en 580 s sur ce runner. Je n'ai donc pas l'inventaire exhaustif des rouges restants.

## Mutations sur le test (c) (fichiers jetables, retirés ensuite)
1. Second lecteur dans `src/services/mutant-r1.ts` via `lireParametre(PARAM_PRETE_AVEC_REMARQUES, true)` → rouge ✅
2. Second lecteur via la chaîne `"tableau.preteAvecRemarques"` → rouge ✅
3. Second lecteur via l'import renommé `PARAM_PRETE_AVEC_REMARQUES as K` → rouge ✅
4. Défaut basculé à `true` dans `tableau-remarques.ts` → rouge ✅

Le resserrement du motif n'ouvre donc aucun trou mesuré.

## À corriger / remarques
- **Bloquant (périmètre)** : la branche s'appelle « FIX-ROUGES-HERITES-MASTER » (au pluriel), mais master reste rouge sur `tests/usine/inventaire/formats.test.ts`. C'est la même famille de test (balayage des `lireParametre` de `src/**`). Il faut soit recenser `site.repriseValidees` dans `tests/usine/interrupteurs-inventaire.test.ts`, soit écrire dans la PR que ce rouge est traité ailleurs. Sinon le vert promis n'est pas prouvé.
- Remarque, non bloquante : `(?![A-Z_])` laisse passer un suffixe en chiffre ou en minuscule (`PARAM_PRETE_AVEC_REMARQUES2`). `\b` serait plus simple et plus large. Aucun cas réel aujourd'hui.
