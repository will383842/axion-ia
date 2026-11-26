# S-10-BRANCHER-v20l : échec (aucun correctif poussé)

- **Rouge** : un seul test, `tests/tableau/prete-avec-remarques-reglage-v20j.test.ts:74` (cas « c »), job « tests ciblés écriture des scripts (2/4) » sur 95ea6936 : reçu `["src/services/prete-avec-remarques-iv.ts", "src/services/tableau-remarques.ts"]`, attendu `["src/services/tableau-remarques.ts"]`. La regex `/PARAM_PRETE_AVEC_REMARQUES|…/` attrape aussi `PARAM_PRETE_AVEC_REMARQUES_IV` (`src/services/prete-avec-remarques-iv.ts:9`, arrivé avec #1739 sur master).
- **Pourquoi rien changé** : ni ce test ni ce service ne sont dans le diff de la branche. Le rouge vient de master (#1739 + #1740), pas de la fiche ; le corriger (par ex. `PARAM_PRETE_AVEC_REMARQUES(?!_)`) obligerait à modifier un fichier hors fiche, ce que la consigne interdit. Aucun autre rouge vu (3 annotations, dont un avertissement Node 20).
- **Tests lancés** : aucun. `pnpm install --frozen-lockfile` échoue (EROFS : magasin pnpm en lecture seule) et `npm ci` aussi (pas de package-lock) : ni vitest ni tsc n'ont pu tourner.
- **Rouge hérité non réparé** : celui ci-dessus. À trancher : élargir la regex dans la fiche, ou corriger dans une PR séparée sur master.
