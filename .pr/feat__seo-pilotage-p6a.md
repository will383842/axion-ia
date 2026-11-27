Pilotage SEO : recalculer les positions depuis l'historique au lieu d'appeler Google page par page

## Ce que fait la PR

- Nouveau module `src/server/seo-pilotage/recalcul.ts` : les champs `SiteRoute.gsc*`, les lignes `KeywordTracking` et les métriques lues par le tier-lifecycle sont recalculés depuis les tables de l'historique (P4), sur une fenêtre de 28 jours identique pour toutes les pages. Aucun appel réseau, donc aucun quota Search Console consommé.
- Nouvelle tâche `recalcul` du worker `seo-pilotage` (07 h 07 Paris, après l'ingestion de 06 h 37).
- `site-route-gsc` et `content-keyword-sync` s'effacent quand le robot recalcule ; `fetchSearchConsoleCtr` (tier-lifecycle) lit la table.
- **Éteint par défaut** : tout dépend de `CONTENT_PILOTAGE_SEO="true"` exact. Même allumé, rien ne change tant que l'historique n'a pas 28 jours réussis consécutifs et un dernier jour de moins de 5 jours : on garde alors l'ancien comportement (API). Table absente (P2021) ou build stub : repli, sans échec. Une tâche inconnue reste ignorée par un ancien worker. Aucune migration.
- Exception d'isolation content-gen ajoutée pour deux fichiers nommés (`recalcul.ts` et son test).

## Changements de chiffres à connaître (une fois allumé)

- `SiteRoute.gsc*` vient de l'agrégat de page (avant : somme des 25 premières requêtes). Les routes sans donnée passent à 0 (position vide), pour toutes les routes à chaque passage (avant : 400 par passage).
- Les routes `/en/...` ne sont pas recalculées (le site les redirige vers le FR).
- Le tier-lifecycle lit la fenêtre qui finit au dernier jour final. Les décisions de promotion et de rétrogradation peuvent donc bouger à l'allumage.
- `KeywordTracking` : l'URL d'un guide suit le gabarit (`/fr/guides/...`), comme le correctif D8 du lifecycle. L'ancien `content-keyword-sync` utilise encore `/fr/blog/...` : si l'historique repasse sous 28 jours, des lignes doubles peuvent apparaître (non traité ici, hors fiche).
- Une écriture en échec n'arrête pas le recalcul ; les mots-clés de plus de 255 caractères sont ignorés.

## Base

`main`, à ouvrir après la fusion de P4. Branche créée depuis `feat/seo-pilotage-p4-robot`.

## Tests

Tests ciblés : `recalcul.spec.ts` (25), `analytics-clients.spec.ts`, deux specs P6a des anciens workers, worker `seo-pilotage`, cadences. Typecheck, `content-gen:isolation-check`, `image-bank:isolation-check`, lint et prettier verts.

VERDICT OPUS : BON
