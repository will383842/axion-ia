# CI rapide, PR 2 — retour partiel de #2489

## Pourquoi

Mesure faite après #2489 : aucun gain. Règle du projet : gain < 10 % = retour arrière.

- **Cache webpack** : il n'existe jamais. `next.config.ts` (lignes ~119-131) met `config.cache = false` en build de prod ; l'étape « Cache webpack — sauvegarde » échoue donc avec « Path Validation Error » et la restauration ne restaure rien.
- **Cache Playwright** : « Install Playwright browsers » dure 19-21 s avant, 19 s après.
- **Build** : 345-425 s avant, 365 s après.

## Retiré

- Job `gate-b-cache-chauffe` (« Gate B · chauffe des caches »).
- Dans `gate-b` : étapes « Cache navigateurs Playwright — restauration » et « Cache webpack — restauration ».
- Commentaire d'en-tête `schedule` et ligne d'AGENTS.md ajoutés par #2489.
- `tests/unit/ci/gate-b-cache-sur.spec.ts`.

## Gardé

- Correction du commentaire périmé Playwright / `apt-get clean` (défaut de #2470).
- Modification de `tests/unit/ci/gate-a-caches-surs.spec.ts`.
- `.pr/ci-rapide-pr2.md` (historique).

## Ajouté

Une ligne dans AGENTS.md : ne pas refaire ce cache sans lever d'abord la coupure du cache webpack.
