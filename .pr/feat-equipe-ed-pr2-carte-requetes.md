# Carte des requêtes (« une requête = une seule URL propriétaire »)

## But
Poser la base anti-cannibalisation de l'équipe éditoriale : savoir, pour chaque requête, quelle URL la porte, et repérer les requêtes servies par deux URL ou plus.

## Fichiers
- `src/server/content-gen/strategie/carte-requetes.ts` : module pur. Normalisation (minuscules, accents, œ/æ, ponctuation, mots vides, singulier simple, ordre des mots ignoré), `construireCarte`, `proprietaire`, `estLibre`, liste des cannibalisations. Propriétaire : plan, puis Search Console, puis suivi ; ensuite meilleure position, plus d'impressions, URL alphabétique.
- `src/server/content-gen/strategie/carte-requetes-source.ts` : lecture seule de `KeywordTracking` (lignes GSC déjà synchronisées par le worker, fenêtre de 56 jours) et interrupteur.
- `src/server/queue/workers/content-keyword-sync-worker.ts` : derrière `CONTENT_EQUIPE_EDITORIALE="true"`, après la synchro, reconstruit la carte et journalise requêtes et cannibalisations. Une erreur n'arrête pas le run.

## Tests
- `carte-requetes.spec.ts` : normalisation, cannibalisation, requête libre, carte vide, priorité du plan.
- `carte-requetes-source.spec.ts` : conversion des lignes, fraîcheur, interrupteur exact.
- `content-keyword-sync-worker-carte.spec.ts` : interrupteur éteint/« 1 » = carte non lue ; « true » = lue ; erreur sans effet sur le run.
- Specs du worker existantes inchangées et vertes ; `tsc --noEmit` et ESLint propres.

## Risques / points à savoir
- Aucune migration, aucune charge de job modifiée, aucun fichier interdit touché.
- Le worker était déjà démarré (`worker.ts`) avec son cron du lundi : « l'activer » consiste ici à lui faire produire la carte quand l'interrupteur est allumé. Éteint = comportement identique.
- **Plan éditorial non branché** : `EdPublication` est le calendrier des posts réseaux (tags = hashtags, liens parfois externes) ; l'utiliser faussait la carte (relecture, tour 1). Le module accepte déjà des entrées « plan » ; une source par page reste à choisir en PR suivante.
- Les suivis `manual` passent après la GSC : à confirmer avant que la carte décide quoi que ce soit (elle ne sert aujourd'hui qu'au journal).
- Non fait : variable absente de la doc d'environnement, mots vides d'élision (`c`, `qu`…), regroupement http/https et www.

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)
