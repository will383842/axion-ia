VERDICT: À CORRIGER

# Relecture de la PR #2361 : challenges d'apporteurs (invitation libre), lots 3, 5 et 8 du plan #2261

Branche relue : `origin/feat/apporteurs-challenges-v2` (tête `20f51f193`), diff contre `origin/main` (`1abd8256d`) : 30 fichiers, +2185 / −1.
Aucun plan « challenge » dans `docs/plans/` : la relecture s'appuie sur la description de PR (`.pr/feat/apporteurs-challenges-v2.md`) et sur la section « DEUX conteneurs » d'AGENTS.md.

Pourquoi « À CORRIGER » : la sécurité et le contrôle d'accès sont bons, mais deux points demandés explicitement ne sont pas garantis :

- les garanties de la couche données (règle figée, chevauchement sérialisable, version relue) ne sont mordues par **aucun** test ;
- le filtre de formules de pression laisse passer les formules d'objectif imposé, qui sont précisément le risque de requalification en salariat.

Les deux se corrigent en quelques heures, sans changer la conception.

## Ce qui a été lancé

| Commande                                                                                                                                                                                                                                                                                         | Résultat                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `pnpm prisma:generate`                                                                                                                                                                                                                                                                           | OK                              |
| `NODE_OPTIONS=--max-old-space-size=12000 pnpm typecheck`                                                                                                                                                                                                                                         | **vert**                        |
| `pnpm vitest run` sur les 3 specs `apporteurs-reseau/__tests__/challenge*`, `src/app/apporteur/dossier/[id]/[jeton]/challenge`, `src/lib/admin-nav.test.ts`, `tests/unit/ci/apporteurs-challenges-migration-additive.spec.ts`, `tests/unit/ci/contacts-guide-reseau-origine-optionnelle.spec.ts` | **7 fichiers, 136 tests verts** |
| `pnpm-lock.yaml`                                                                                                                                                                                                                                                                                 | identique à `main`              |

## Ce qui est conforme

- **Migration additive, compatible app/worker** : `CREATE TABLE IF NOT EXISTS` plus un index, sans clé étrangère, sans énumération, sans `UPDATE`, `DELETE` ni `DROP`. Les CHECK portent sur la nouvelle table seulement. Le rollback renomme la table, il ne la supprime pas. Le worker ne lit pas la table, donc aucun contrat app↔worker n'est en jeu, dans un sens comme dans l'autre (D8b).
- **Interrupteurs** : `process.env.X === "true"` lu à chaque appel, absent = éteint. Les deux sont déclarés dans `src/env.ts` (schéma et `runtimeEnv`) et dans la liste fermée de `.github/workflows/coolify-drapeau.yml` (commit `20f51f193`). La console est vérifiée deux fois (pages et actions), l'espace aussi (lecture de l'encart et page du règlement).
- **Écritures console** : `sessionArgent()` contrôle, dans cet ordre, l'interrupteur, la session puis `peutEngager(role, "facturer")`, avant chaque création, modification, publication ou archivage. Les trois cases sont revérifiées côté serveur (`every(... === "oui")`), l'archivage exige `confirmer=oui`, et chaque geste réussi est tracé dans `activityLog`. Les lectures utilisent `gardePage("consultation")` et n'affichent aucune donnée d'apporteur.
- **Espace apporteur** : composants serveur, aucune donnée personnelle. `VueEncartChallenge` et `VueReglementChallenge` ne portent que la règle publiée : pas de classement, de compteur, de barre ni de relance (`challenges-invitation-libre.spec.ts` garde l'absence d'import d'envoi et de champ rang ou participants).
- **Contrôle d'accès `/apporteur/dossier/[id]/[jeton]/challenge/reglement`** : interrupteur, dossier d'exemple → 404, puis `lireDossierParLien` (UUID bien formé, jeton HMAC sur `versionLien`, résilié ou retiré → restreint ou null), `restreint` → 404, `etatDeLaPage !== "signe"` → 404. Aucun identifiant de challenge dans l'URL, et la lecture est globale (pas propre à un apporteur) : **pas d'IDOR**. L'encart n'est rendu que dans la branche `signe`, après le retour anticipé du mode restreint.
- **Mutations qui mordent** (mutation appliquée, specs relancés, fichier restauré) : retrait de `peutEngager` (4 échecs), `every` → `some` sur les cases (1), interrupteur console `!== undefined` (3), retrait du contrôle `restreint` (1), retrait du contrôle `signe` (2), retrait d'une formule du filtre (1).

## Constats

1. **`src/features/apporteurs-reseau/challenge-donnees.ts:174`, `:201`, `:207-216`, `:236` · gravité MOYENNE (tests qui ne mordent pas sur les garanties centrales).**
   Quatre mutations **survivent** (75/75 verts) :
   - `where: { id, statut: "brouillon" }` → `where: { id }` dans `modifierBrouillon` : une règle publiée redevient modifiable ;
   - `isolationLevel: "Serializable"` retiré ;
   - contrôle de `version` (`majAt`) neutralisé ;
   - test de chevauchement neutralisé (`false && periodesSeChevauchent(...)`).

   Le spec console bouchonne tout `challenge-donnees`, et aucun spec n'exerce cette couche. Or c'est là, et seulement là (pas de déclencheur SQL, la PR le dit), que la règle est figée.

   **Correctif** : ajouter `challenge-donnees.spec.ts` avec un `prisma` bouchonné qui enregistre les arguments. Ce spec doit vérifier :
   - le filtre `statut: "brouillon"` de `updateMany` (modification et publication) ;
   - `{ isolationLevel: "Serializable" }` passé à `$transaction` ;
   - le refus quand `version` ne correspond pas ;
   - le refus quand un publié du même produit chevauche (bornes incluses) ;
   - `reglementSha256 === empreinteReglement(reglement)`.

   Idéalement, ajouter aussi un test d'intégration Postgres de deux publications concurrentes.

2. **`src/features/apporteurs-reseau/challenge-textes-interdits.ts:12-31` · gravité MOYENNE (risque de requalification en salariat).**
   Mesuré avec `formulesInterdites(...)` → `[]` pour chacun de ces textes :
   - « Votre objectif : dix Journées. »
   - « Vous devez atteindre ce seuil. »
   - « Classement publié chaque semaine. »
   - « Il ne vous reste que trois jours. »
   - « Plus qu’une semaine » (apostrophe typographique)
   - « Super prime ！ » (point d'exclamation pleine chasse)

   Le filtre attrape le compte à rebours, mais pas l'**objectif imposé** ni l'**obligation**, qui sont le cœur du risque.

   **Correctif** : ajouter des formules et non des mots isolés, pour garder « aucun objectif » et « aucun classement » :
   - `\b(votre|vos|ton|tes) objectifs?\b`, `\bobjectif (de|à atteindre|fixé)`, `\bvous devez\b`, `\bvous êtes tenu`, `\bobligatoire\b`, `\bclassement (publié|hebdomadaire|mensuel)|\b(1er|premier|top) du classement` ;
   - `\bne vous reste\b`, `\bplus qu['’]\s*(une?|\d+)`, `[!！]`.

   Ajouter ces cas au `it.each` de `challenge-regles.spec.ts`. Normaliser `’` en `'` et NBSP en espace avant le test.

3. **`src/features/apporteurs-reseau/challenge-donnees.ts:74` et `:243` · gravité MOYENNE (preuve contractuelle).**
   `archiverChallenge` passe le statut à `archive`, et `lireReglementChallenge` ne lit que `statut: "publie"`. Un challenge archivé, y compris pendant ou après sa période, fait donc disparaître le règlement de l'espace, alors que la console affirme que « les droits déjà nés restent acquis ». L'apporteur perd l'accès au texte qui fonde sa prime au moment où il peut en avoir besoin (lot 7, contestation).

   **Correctif** : garder le règlement lisible pour `statut IN ('publie','archive')` avec `publieAt` non nul (seul l'encart disparaît). Sinon, assumer explicitement le contraire dans le texte de la console et du règlement type. Ajouter un test.

4. **`src/app/apporteur/dossier/[id]/[jeton]/challenge/l-espace-ne-montre-que-la-regle.spec.tsx:97`, `:153` · gravité FAIBLE (test).**
   Seul le cas « absent » de l'interrupteur espace est testé. La mutation `=== "true"` → `!== undefined` dans `interrupteur-challenges-espace.ts:10` survit.

   **Correctif** : reprendre le `it.each(["TRUE", "1", " true "])` du spec console pour l'espace (encart null et règlement 404).

5. **`src/features/apporteurs-reseau/challenge-donnees.ts:196-226` · gravité FAIBLE (règle).**
   La publication n'empêche pas de publier un challenge dont la période est déjà commencée ou **terminée** (`finLe < aujourd'hui`). Cela crée une prime rétroactive, publiée d'un coup dans la liste « Passés », et le règlement devient lisible immédiatement.

   **Correctif** : à la publication, refuser `finLe < jourParis(now)`. Pour `debutLe < aujourd'hui`, soit refuser, soit afficher un avertissement à cocher, selon la décision de Will.

6. **`src/features/apporteurs-reseau/challenge-donnees.ts:226` · gravité FAIBLE (« figée par empreinte »).**
   L'empreinte SHA-256 ne couvre que le texte du règlement. Le titre, les dates, le seuil, la prime et le critère (ce que l'encart affiche et ce que le lot 7 calculera) ne sont pas couverts. L'empreinte n'est par ailleurs jamais revérifiée à la lecture. L'immutabilité ne repose que sur le code (`updateMany ... statut: "brouillon"`), d'où l'importance du constat 1.

   **Correctif** : hacher une forme canonique de la règle complète (`JSON.stringify` ordonné de titre, debutLe, finLe, paiementJusquAu, produit, critere, seuil, primeHtCents, reglement), et la revérifier au lot 7 avant tout calcul. Ou poser le déclencheur SQL d'immutabilité annoncé « à reprendre avec le lot 7 ».

7. **`src/features/apporteurs-reseau/challenge-donnees.ts:207` · gravité FAIBLE (à trancher avant le lot 7).**
   Le contrôle de chevauchement ignore les challenges `archive`. C'est le chemin de correction documenté (« archivez-le et créez-en un nouveau »), mais il permet deux règles sur la même période. Si les droits du premier « restent acquis », un apporteur pourrait cumuler deux primes pour les mêmes Journées.

   **Correctif** : soit inclure les archivés dans le contrôle de chevauchement, soit décider et écrire la règle de non-cumul avant le lot 7.

8. **`src/app/[locale]/(admin)/[adminPrefix]/apporteurs/challenges/[id]/page.tsx:61`, `:66` (et `challenges/page.tsx`) · gravité FAIBLE (injection de contenu).**
   `?retour=` et `?erreur=` sont affichés tels quels, dans la limite de 300 caractères. React échappe le texte, donc il n'y a pas de XSS. Mais un lien forgé peut afficher à un administrateur un faux message de succès ou une consigne, par exemple « Challenge publié… ».

   **Correctif** : passer un code (`?retour=publie`) traduit par une table fermée côté page, ou ne pas afficher de message libre. Le motif est déjà répandu dans la console : ne pas bloquer la PR pour cela.

9. **`.github/workflows/coolify-drapeau.yml:117-118` · gravité NIT.**
   Les deux interrupteurs sont commentés « cible : le site », mais l'étape « Valider la valeur » ne refuse pas `cible=worker` ou `les-deux`, contrairement aux `GUIDES_*`.

   **Correctif** : ajouter `[[ "$CLE" =~ ^APPORTEUR_CHALLENGES_(CONSOLE|ESPACE)_ENABLED$ ]] && [ "$CIBLE" != "site" ]` → erreur. Sans conséquence aujourd'hui : poser le drapeau sur le worker est inoffensif.

## Pour fusionner

Corriger les constats 1 et 2 (bloquants), trancher le 3, puis relancer `pnpm vitest run` sur les specs ci-dessus. Les constats 4 à 9 peuvent suivre dans la même PR ou dans le lot 7. La PR reste en brouillon tant que #2268 et #2271 ne sont pas fusionnées (dépendances déclarées).
