Chaîne éditoriale C3 : six tables et une colonne facultative, sans rien brancher

## Ce que fait la PR

- Migration additive `20261128000000_chaine_editoriale_tables` : six tables neuves (`contenu_besoins`, `contenu_briefs`, `contenu_faits`, `contenu_refus`, `contenu_resultats`, `contenu_propositions`) et une colonne facultative `role` sur `cost_ledger`. Aucun DROP, UPDATE ni DELETE ; aucune énumération Postgres (statuts et codes en texte, listes fermées côté code).
- Modèles Prisma correspondants, chacun annoté `rgpd: technique` avec son motif.
- `equipe/brief.ts` : champs facultatifs (intention de recherche, plan de titres, fourchette de longueur), compatibles avec les briefs existants.
- `cost-tracker.ts` et `blog-claude-ledger.ts` : `select` explicite sur les écritures `cost_ledger`, pour qu'un client Prisma plus récent que la migration ne lise pas la colonne `role` avant qu'elle existe.
- Rien n'est branché : aucun code de production ne lit ni n'écrit ces tables.

## Tests

- Migration, listes fermées de migrations (`contacts-guide-reseau-origine-optionnelle`, relevé mensuel) et garde d'isolation mis à jour.
- Typecheck, vitest ciblé (content-gen, migrations, garde RGPD du dossier client), `content-gen:isolation-check`, `image-bank:isolation-check`, prettier : verts.
- Hors périmètre : 4 tests de `kb-ingest/url-extractor` échouent aussi sur main dans cet environnement (réseau).

VERDICT OPUS : EN COURS (tour 2)
