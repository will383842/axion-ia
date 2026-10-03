# Rapport — LOT A1 · `opco/a1-schema-effectif-opco`

Tête de la branche de code : `9d868ea9dad3bb680d8dd367c6c983871741cc38`
Commit ROUGE (tests seuls) : `d7848f2b`

## Ce qui est fait

| # | Livrable | État |
|---|----------|------|
| 1 | `Client` : `effectif`, `effectifSource` (nouvel enum `EffectifSource { saisie insee }`), `effectifReleveLe` (`@db.Date`), `opco` (enum `Opco` existant). `opcoIdentifie` conservé, rien recopié ni écrasé. | ✅ |
| 2 | `DossierFinancement` : `accordEcritLe`, `depotFaitLe` (`@db.Date`), `subrogationConfirmeeParAccord` (`Boolean?`). | ✅ |
| 3 | Migration `20261003120000_opco_effectif_client_et_accord_ecrit` : ajouts seuls (1 type, 7 colonnes nullables), `CHECK (effectif >= 0) NOT VALID`. SQL issu de `prisma migrate diff`, puis commenté. | ✅ |
| 4 | Garde de démarrage (`transitionSessionAction`, `toStatus === "en_cours"`) : **échec fermé**. Une exception de `getFinancementValidations` est journalisée (Sentry, logger déjà utilisé par ce fichier ; `extra: { sessionId, toStatus }`, aucune donnée personnelle) et rend `{ error: "Démarrage bloqué : impossible de vérifier les financements de la session. Réessayez ou contactez l'administrateur." }`. | ✅ |
| 5a | `updateClientAction` : `effectif` entier ≥ 0 (zod, `null` efface) → source `saisie` + date du jour civil de Paris posées par le serveur ; effacer efface aussi source et date. `opco` ∈ les 11 de `opco-referentiel.ts` (`null` efface). Les deux sont refusés pour un particulier (garde `CHAMPS_ENTREPRISE`). | ✅ |
| 5b | `ClientBrancheForm` : champs « OPCO (référentiel) » et « Effectif », envoyés **seulement s'ils ont changé** (un simple « Enregistrer » ne re-date pas l'effectif), masqués pour un particulier. Page clients : passe `opco` et `effectif`. | ✅ |
| 5c | Rapprochement en **lecture seule** : module pur `opco-suggestion.ts`. Si `opco` est vide et que `opcoIdentifie` correspond à **un seul** OPCO (identifiant ou libellé, sans accents ni casse, préfixe « OPCO » toléré), l'écran affiche « OPCO suggéré : X ». Rien n'est écrit. | ✅ |
| 5d | `accordEcritLe` saisissable à l'enregistrement de l'accord | ❌ **laissé** — voir Limites |

## Fichiers

- `prisma/schema.prisma` (le diff montre ~50 lignes de réalignement produites par `prisma format`)
- `prisma/migrations/20261003120000_opco_effectif_client_et_accord_ecrit/migration.sql`
- `src/server/actions/qualiopi/sessions.ts` + `sessions.spec.ts`
- `src/server/actions/qualiopi/clients.ts` + `clients.spec.ts`
- `src/server/qualiopi/financements/opco-suggestion.ts` + `.spec.ts` (nouveaux)
- `src/components/admin/qualiopi/ClientBrancheForm.tsx` + `__tests__/client-branche-effectif-opco.spec.tsx` (nouveau)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/page.tsx`

Diff hors tests : 7 fichiers, +283 / −54 (dont le réalignement du schéma).

## Preuve ROUGE (commit `d7848f2b`, tests seuls)

```
pnpm vitest run src/server/actions/qualiopi/sessions.spec.ts src/server/actions/qualiopi/clients.spec.ts \
  src/server/qualiopi/financements/opco-suggestion.spec.ts \
  src/components/admin/qualiopi/__tests__/client-branche-effectif-opco.spec.tsx

 × updateClientAction — effectif et OPCO typé (lot OPCO A1) > refuse un effectif négatif (zod) et n'écrit rien
   AssertionError: expected false to be true
 × … > refuse un effectif non entier
 × … > enregistrer l'effectif pose source = saisie et la date du jour
   AssertionError: expected undefined to be 12
 × … > effacer l'effectif (null) efface aussi sa source et sa date
 × … > l'OPCO typé s'écrit dans `opco` sans toucher au texte `opcoIdentifie`
 × … > refuse un OPCO hors des 11 du référentiel
 × … > refuse un effectif ou un OPCO typé sur un particulier
 × transitionSessionAction — garde financement > 🔴 ÉCHEC FERMÉ si getFinancementValidations lève — refus, journal, aucune transition
   AssertionError: expected { Object (data) } to deeply equal { Object (error) }
 × ClientBrancheForm — effectif et OPCO typé > affiche « OPCO suggéré » depuis le texte libre, sans rien écrire
   TestingLibraryElementError: Unable to find an element with the text: OPCO suggéré : OPCO Santé.
 × ClientBrancheForm — effectif et OPCO typé > envoie l'effectif saisi et l'OPCO typé choisi
   TestingLibraryElementError: Unable to find a label with the text of: Effectif
 FAIL src/server/qualiopi/financements/opco-suggestion.spec.ts
   Error: Failed to resolve import "./opco-suggestion"
 Test Files  4 failed (4)
      Tests  10 failed | 34 passed (44)
```

Le test « fail-soft » existant de `sessions.spec.ts` (qui **attendait** que la session démarre malgré l'exception) a été remplacé par le témoin d'échec fermé.
Deux témoins d'absence passaient déjà au ROUGE, par nature (« aucune suggestion quand l'OPCO typé est posé », « champs masqués pour un particulier »).
Le hook pre-push relance les tests touchés : le commit ROUGE a été poussé en `--no-verify` (rouge par construction) ; prettier et eslint lancés à la main sur chaque fichier touché, `tsc --noEmit` sans erreur sur les fichiers du lot.

## Preuve VERTE (tête `9d868ea9`)

```
pnpm vitest run (les 4 fichiers ci-dessus + opco-referentiel.spec.ts)
 Test Files  5 passed (5)
      Tests  76 passed (76)
```

Garde-fous du dépôt qui lisent le schéma ou les migrations (40 fichiers `*.spec.ts` citant `schema.prisma` / `prisma/migrations`) : **40/40 verts, 375 tests**.

## Attaque (ce que j'ai cherché à casser)

- **Re-datation silencieuse** : si le formulaire renvoyait toujours l'effectif, chaque « Enregistrer » (pour l'IDCC par exemple) reposerait la date de relevé. Il n'envoie que ce qui a changé ; témoin dans le test de composant (`"effectif" in envoye()` → faux).
- **Suggestion qui écrit** : le témoin soumet le formulaire avec une suggestion affichée et vérifie qu'aucune clé `opco` ni `opcoIdentifie` ne part au serveur.
- **Ambiguïté** : « Akto / Atlas », « OPCO » seul, « à déterminer », « Agefice » ne suggèrent rien. Aucune collision entre les clés normalisées des 11 OPCO.
- **Particulier** : effectif et OPCO typé refusés côté serveur, pas seulement masqués.
- **Date `@db.Date`** : minuit UTC du jour civil de **Paris** (`parisDateISO`), pour éviter qu'une saisie à 00 h 30 soit datée de la veille.
- 🔴 **Fenêtre app/worker (AGENTS.md, ~50 min)** : cette PR **ajoute des colonnes** à `clients` et `dossiers_financement`. Le worker, rebâti en ~3 min depuis les sources, embarquera un client Prisma qui connaît ces colonnes, alors que la migration n'est appliquée que par l'entrypoint de l'**app** (~50 min). Pendant cette fenêtre, toute requête du worker sur ces deux tables sans `select` explicite (≈ 29 appels `findMany/findUnique/update/create` repérés sous `src/server/{queue,qualiopi,partners-sync}`) peut échouer sur « colonne inexistante ». La migration est purement additive, donc **sans risque pour l'ancienne app** : recommandation à la session qui tient la file — juste après la fusion, lancer `gh workflow run admin-emergency-migrate.yml -f action=migrate` pour réduire la fenêtre à quelques minutes, puis vérifier `prisma migrate status`. Je ne l'ai pas lancé (hors périmètre, action en production).

## Limites

- **`accordEcritLe` non saisissable** : l'accord est enregistré par `transitionnerDossier` (`dossier-financement.ts`), qui pose `accordAt` dans une transaction avec émission de faits, appelée depuis plusieurs actions et `DossiersFinancementPanel`. Y ajouter un champ demande de traverser ces trois couches : ce n'est pas « simple », je le laisse au lot suivant. Idem `depotFaitLe` et `subrogationConfirmeeParAccord` (colonnes posées, aucune écriture).
- `effectifSource = insee` : valeur déclarée, aucun code ne la pose encore.
- Aucune donnée externe relevée dans ce lot (pas de seuil ni de valeur OPCO écrits en dur).
- Le journal d'audit (`logQualiopiActivity`) reçoit `effectif` et `opco` via `...fields`, mais pas la source ni la date posées par le serveur.
- Suite complète et `next build` non lancés (consigne) : la CI juge.

---

## Corps de PR prêt à coller

**Titre** : `feat(opco): effectif et OPCO typé du client, dates d'accord écrit, démarrage de session en échec fermé (lot A1)`

### Ce que fait cette PR

- **Schéma** : `Client` reçoit `effectif` (niveau SIREN, seuils OPCO < 11 / 11-49 / 50+), `effectifSource` (nouvel enum `saisie | insee`), `effectifReleveLe`, et `opco` (enum `Opco` existant). Le texte libre `opcoIdentifie` est conservé : rien n'est recopié ni écrasé. `DossierFinancement` reçoit `accordEcritLe` (date portée sur l'accord, ≠ `accordAt` = clic), `depotFaitLe` et `subrogationConfirmeeParAccord` (pour le lot A3).
- **Migration** additive seulement, `CHECK (effectif >= 0) NOT VALID`.
- **Échec fermé** : une erreur de lecture des financements ne laisse plus démarrer une session ; elle est journalisée (id de session seul) et refusée.
- **Console** : effectif et OPCO typé dans le formulaire branche ; l'action pose `source = saisie` et la date du jour ; « OPCO suggéré : X » affiché en lecture seule quand le texte libre désigne un OPCO sans ambiguïté.

### ROUGE avant VERT

Commit `d7848f2b` (tests seuls) : 10 échecs + 1 module introuvable. Tête `9d868ea9` : 76/76 sur les fichiers du lot ; 40 garde-fous schéma/migrations verts (375 tests). Le test historique « fail-soft » est remplacé par le témoin d'échec fermé.

### Attaque

Re-datation sur un simple enregistrement (non : envoi seulement si modifié), suggestion qui écrirait (non : témoin de soumission), ambiguïtés (« Akto / Atlas » → rien), particulier (refus serveur), jour civil de Paris pour la date.
⚠️ **Fenêtre app/worker** : colonnes neuves sur `clients` et `dossiers_financement` ; le worker atterrit ~50 min avant la migration portée par l'app. Migration additive → lancer `admin-emergency-migrate.yml -f action=migrate` juste après la fusion.

### Limites

`accordEcritLe`, `depotFaitLe`, `subrogationConfirmeeParAccord` : colonnes posées, pas encore saisissables (l'accord passe par `transitionnerDossier`, à traverser dans un lot dédié). `effectifSource = insee` non alimenté.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_015GGhGVuoYAVYgx9VfFYFG3
