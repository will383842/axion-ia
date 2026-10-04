# Rapport — INT-T65-A : convention sous condition suspensive OPCO

**Branche livrée :** `opco/int-t65-a-condition-suspensive`
**Tête :** `c0a8d80618ed0633a3e2f8e443f642a39922ffae`
**Base :** `origin/main` fusionnée (`9df6687e`, commit de fusion `6c4fd528`, merge et non rebase).
**Signal :** rattrapage 105 fusionné (axion-apporteurs#656, commentaire 5979459198).
**PR :** non ouverte, conformément à la consigne (c'est vous qui l'ouvrez). Rien n'a été fusionné.

Cahier des charges relu à la source : `docs/tasks.json` de `main` d'axion-apporteurs (entrée `INT-T65-A`, `acceptance` et `paths`), clause 5978462914, remarque de la juriste 5979338659 et chemins 5978362684 de l'issue #656.

---

## 1. Ce qui est livré

| Point imposé | Livré | Où |
|---|---|---|
| 1. Forme d'A02 telle quelle | `conditionSuspensiveOpco Boolean @default(false)`, `seuilConditionBps Int?`, `seuilConditionCents Int?`, `dateLimiteCondition DateTime? @db.Timestamptz(3)` sur `DocumentGenere` (la convention). Les trois CHECK nommés. L'état fermé `{en_attente, active, caduque}` est conservé. | `prisma/schema.prisma`, `prisma/migrations/20261004220000_convention_condition_suspensive_opco/` |
| 2. Date limite = jour civil de Paris | On stocke l'instant de 00:00 (heure de Paris) du jour limite. La borne est la **fin** de ce jour civil (minuit exclusif, heure de Paris), en été comme en hiver. | `src/server/qualiopi/financements/condition-suspensive.ts` (`finDuJourLimite`, `dateLimiteDepassee`) |
| 3. Défaut 50 % dans la SSOT | `SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS = 5000` (déjà posé par la préparation). Il est **posé à l'écran** au moment de cocher et reste modifiable convention par convention. Il n'y a **jamais** de DEFAULT en base (vérifié contre Postgres). | `config/financing.ts`, `ConditionSuspensiveOpcoChamps.tsx` |
| 4. Clause mot pour mot | Elle figure dans `convention.tsx` **et** `convention-tripartite.tsx`, en section « 5 bis. », et n'est imprimée que si la case est cochée. Paramètres : `{opco}`, `{dateLimite}` (jj/mm/aaaa, jour de Paris) et `{seuil}` (« 50 % du prix toutes taxes comprises de la présente convention » ou « 3 000,00 € »). `GABARIT_VERSIONS` passe de 4 à 5 pour les deux conventions, avec une ligne d'historique. La v4 est archivée et les empreintes sont reportées. | `templates/convention*.tsx`, `gabarit-versions.ts`, `archives/*.v4.tsx`, `gabarit-empreinte.spec.ts` |
| 5. Écran | Console admin, fiche session, section Documents : une case par convention (bipartite **et** tripartite). Une fois cochée, elle propose un seuil prérempli à 50 % (lu depuis la SSOT), une bascule %/€ et une date limite requise. Les euros saisis sont convertis en centimes entiers sans passer par un flottant. Suivi d'une convention générée : état, « Constater l'état de la condition », « Votre client renonce à la condition ». Pas de mode sombre. | `ConditionSuspensiveOpcoChamps.tsx`, `DocumentsSection.tsx`, `sessions/[id]/page.tsx` |
| 5. Server action | `requireAdminWrite` est conservé, en tête des quatre actions. L'entrée est validée par zod en mode **strict**, avec des entiers seulement, exactement un seuil, un jour réel et une date limite qui n'est pas déjà passée. | `src/server/actions/qualiopi/documents.ts` |
| 6. Renonciation / après défaillance | Une renonciation (C. civ. 1304-4) enregistrée avant que la condition soit accomplie ou défaillie fait passer la convention à `active`, avec effet à sa **date de signature**. Après une défaillance, elle est refusée. Aucune transition ne sort de `active` ou de `caduque` : un accord tardif appelle une **nouvelle** convention. | `condition-suspensive.ts`, `condition-suspensive-service.ts`, `renoncerConditionSuspensiveAction` |
| 6. Rappel J-7 | Il passe par le mécanisme **existant** des alertes Qualiopi, sans nouvelle file BullMQ. Le code `condition_suspensive_opco` est dû à partir de 00:00 (heure de Paris) le J-7. | `alertes/regle-condition-suspensive-opco.ts`, `catalogue.ts`, `evaluateur.ts` |

### Transitions journalisées

- **Constat** (`constaterConditionSuspensiveAction`) : l'action lit l'accord écrit (`accordEcritLe` + `montantAccordeCents`) et le refus (`refuseAt`) sur les dossiers de financement OPCO/mixte de la session et du client de la convention, puis évalue la condition et applique `en_attente → active | caduque`.
- **Écriture** : un `updateMany` gardé par `etatConditionSuspensive = 'en_attente'` et la ligne `activity_logs` (`qualiopi.convention.condition_suspensive.{active|caduque|renonciation}`, avec de, vers, cause, date, date d'effet) sont écrits **dans la même transaction**. En cas de course entre deux admins, rien n'est écrit, pas même le journal.
- **Base du pourcentage** : le prix TTC de la convention est **figé** à la génération (`metadata.conditionSuspensiveOpco.prixTtcCents`, calculé par `computeTotauxFacture` au régime de TVA configuré). Un changement de régime ultérieur ne déplace donc pas le seuil.

### Garde-fou « aucune exécution avant l'accord » (point 5 de la clause)

**Ce qui est appliqué :** une alerte **critique**. Elle se déclenche quand la session commence dans 7 jours ou moins, ou a déjà commencé, alors que la condition est encore `en_attente`. Son texte : « Aucune action ne doit être exécutée avant l'accord ou la renonciation écrite du client : reportez la session, ou enregistrez l'accord ou la renonciation. »

**Ce qui n'est PAS appliqué :** aucun **blocage dur**. Rien n'empêche aujourd'hui d'émettre une convocation, d'ouvrir l'émargement ou de démarrer la session. Je n'ai pas posé ce blocage pour deux raisons : il touche des circuits hors des `paths` de la tâche (convocations, émargement, worker des jalons), et il demande d'arbitrer ce qui compte comme « action exécutée ». C'est à décider avant de l'imposer (voir § 6).

---

## 2. Écarts à la préparation, et pourquoi

| Préparation (`adc182ed`) | Livré | Raison |
|---|---|---|
| Enum `SeuilConditionSuspensiveType` + colonne `seuil_type` | **Supprimés** | Ils font double emploi avec A02. Le type se déduit de la colonne de seuil non nulle (`num_nonnulls = 1`). |
| `seuil_bps`, `seuil_cents` | `seuil_condition_bps`, `seuil_condition_cents` | Noms d'A02 tels quels. |
| `date_limite DATE` | `date_limite_condition TIMESTAMPTZ(3)` | Forme d'A02. La borne est la fin du jour civil de Paris (remarque A07). |
| CHECK `documents_generes_condition_suspensive_seuil_check` | `convention_condition_coherente`, `convention_seuil_bps_borne`, `convention_seuil_cents_positif` (+ `convention_condition_etat_coherent`) | Noms d'A02. Le CHECK d'état est un **ajout**, qui lie l'état fermé à la case. |
| Migration `20261004210000_…` | **Retirée**, remplacée par `20261004220000_…` | Elle n'était jamais passée en production. Le nouvel horodatage est supérieur à toute migration de `main` (dernière : `20261004190000`). |
| Témoin d'états avec `dateLimite: "2026-12-15"` (chaîne) | `dateLimite: Date` (instant de 00:00 Paris) | Il est aligné sur la colonne Timestamptz. Le témoin à deux faces 23h59 / 00h00 est ajouté en **hiver et en été**, comme demandé. |
| Témoin de clause (comparaison sans espaces) | + comparaison à espaces réduits | La comparaison sans espaces ne voyait pas deux mots collés. |
| Témoins « 🔴 ROUGE » | En-têtes mis à jour | Ils sont passés au vert. |

---

## 3. Migration et CHECK

`prisma/migrations/20261004220000_convention_condition_suspensive_opco/migration.sql` :

- **additive et idempotente** : `CREATE TYPE` dans un `DO … EXCEPTION duplicate_object`, `ADD COLUMN IF NOT EXISTS`, CHECK posés seulement s'ils sont absents. Aucun DROP, RENAME, ALTER TYPE ni recopie ;
- colonnes **nullables**, case `NOT NULL DEFAULT false`, **aucun DEFAULT de seuil** ;
- CHECK posés `NOT VALID` puis `VALIDATE` : les colonnes neuves sont vides sur les lignes existantes, donc rien n'est réécrit, sous un verrou SHARE UPDATE EXCLUSIVE ;
- `convention_condition_coherente` : si la case n'est pas cochée, seuils et date sont NULL. Si elle est cochée, `num_nonnulls(seuil_condition_bps, seuil_condition_cents) = 1` et la date limite est NON NULL ;
- `convention_seuil_bps_borne` : `BETWEEN 1 AND 10000` ;
- `convention_seuil_cents_positif` : `>= 1` ;
- `convention_condition_etat_coherent` (ajout) : l'état est présent si et seulement si la case est cochée.

**Fenêtre app/worker (~50 min, AGENTS.md).**

- L'**ancienne app** écrit ses conventions sans les colonnes neuves : la case prend `false` par DEFAULT et le reste vaut NULL, ce qu'acceptent les quatre CHECK. Un témoin le vérifie (« une convention existante reste intacte »).
- Le **nouveau worker** tourne avant que l'app ne migre. La règle d'alerte neuve peut échouer pendant cette fenêtre (colonnes absentes), mais l'évaluateur isole chaque règle (`reglesEnEchec`) : les autres alertes ne sont pas touchées.
- **Risque résiduel, signalé et non corrigé.** Trois `documentGenere.update` sans `select` relisent toutes les colonnes : `documents-service.ts` (contre-trace de rectification, déjà fail-soft) et deux dans `document-signature-service.ts` (circuit de signature, côté app). S'ils tournaient dans le worker pendant la fenêtre, ils échoueraient.
  - J'ai tenté d'ajouter `select: { id: true }` à celui de `documents-service.ts`. Cela fige l'appel attendu par deux témoins existants (`documents-service.spec.ts`), donc je l'ai retiré : c'est hors périmètre.
  - Aucune énumération existante n'est modifiée, et aucune forme de tâche BullMQ ne change.

**Vérifié contre un Postgres 16 neuf** (local, avec pgvector) : `prisma migrate deploy` applique toutes les migrations ; la migration se **rejoue** sans erreur ; `prisma migrate diff` ne montre **aucune dérive** sur `documents_generes`. Le seul écart affiché, un index de `trainer_statements`, préexiste à cette PR.

---

## 4. Témoins et résultat

| Témoin | Ce qu'il fixe | Résultat |
|---|---|---|
| `financements/__tests__/condition-suspensive.spec.ts` (REQ-JUR-061) | Machine d'états, ordre chronologique, renonciation, accord après refus ou après la date, seuil en entiers (BigInt), **jour civil de Paris : 23h59 dans le délai / 00h00 hors délai, hiver ET été**, rappel J-7, transitions fermées, conversion de saisie sans flottant | **31/31 vert** |
| `financements/__tests__/condition-suspensive-service.spec.ts` | Un accord écrit daté du jour limite est dans le délai ; daté du lendemain, il est hors délai ; un accord sans montant n'est pas compté | **3/3 vert** |
| `templates/__tests__/condition-suspensive-opco-clause.spec.tsx` | Clause **mot pour mot** dans les deux conventions (% et €), une seule fois, rien si la case n'est pas cochée | **8/8 vert** |
| `templates/__tests__/les-deux-conventions-portent-le-meme-socle.spec.ts` | + bloc source de la clause **identique** dans les deux gabarits | **vert** |
| `templates/gabarit-empreinte.spec.ts` | v5 + empreintes des archives v4 | **10/10 vert** |
| `templates/__tests__/pieces-signees-restent-reproductibles.spec.tsx` | + exemplaires **v4** rejoués **à l'octet**. Empreintes relevées sur le code d'avant la retouche (worktree de `6c4fd528`). | **vert** |
| `components/admin/qualiopi/__tests__/condition-suspensive-opco-champs.spec.tsx` | Case décochée par défaut, 50 % lu de la SSOT, date requise, bascule %/€, centimes entiers, vouvoiement, entrée envoyée à l'action | **10/10 vert** |
| `actions/qualiopi/__tests__/condition-suspensive-opco-action.spec.ts` (sécurité) | Le refus de `requireAdminWrite` arrête les 4 actions avant toute lecture ; zod refuse flottants, deux seuils ou aucun, 0 et 10 001 pb, 0 centime, jour inexistant, clé inattendue, date passée ; constat et renonciation journalisés ; aucune résurrection d'une convention caduque | **21/21 vert** |
| `alertes/regle-condition-suspensive-opco.spec.ts` | J-7 à 00:00 Paris, état à constater, accord d'un autre client ignoré, garde-fou critique, une alerte par session | **8/8 vert** |
| `tests/integration/condition-suspensive/convention-condition-check.spec.ts` (**Postgres réel**, ajouté à Gate D) | Case cochée sans seuil, avec deux seuils ou sans date : refusée ; 0 et 10 001 pb refusés ; 0 et −1 centime refusés ; case non cochée avec seuil ou date : refusée ; état ⇔ case ; convention existante intacte ; aucun DEFAULT de seuil ; Timestamptz(3) | **10/10 vert** (local, PG 16) |

---

## 5. Tests lancés (chiffres)

- `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144), projet entier : **0 erreur** (après la dernière retouche).
- `eslint` sur tous les fichiers modifiés ou créés : **0 problème**. `prettier --check` : **conforme**.
- `vitest run src/server/qualiopi src/server/actions/qualiopi src/components/admin/qualiopi src/features/admin-qualiopi tests/unit/ci` : **661 fichiers, 9 514 tests verts, 1 rouge**.
  - Le rouge venait de `parcours/__tests__/les-gestes-citent-des-boutons-reels.spec.ts` : le libellé littéral « Générer : Convention de formation » avait disparu avec le paramétrage du bouton. Il est **corrigé** (libellé littéral rétabli).
  - Les suites touchées ont été relancées : `parcours` + `components/admin/qualiopi` + `features/admin-qualiopi` donnent **54 fichiers / 668 tests verts**.
- Suites ciblées complémentaires : `documents` **73 fichiers / 953 tests verts** ; `alertes` **34 fichiers / 935 tests verts (1 todo)**.
- Intégration (Postgres réel) : **10/10**.
- Le hook de pré-commit n'a pas été exécuté (`--no-verify`, autorisé). Les contrôles qu'il porte ont été lancés à la main ci-dessus.
- `next build` n'a **pas** été lancé, conformément à la consigne.

---

## 6. Ce qui reste (à trancher ou à faire)

1. **Garde-fou dur « aucune exécution avant l'accord ».** Aujourd'hui il n'y a qu'une alerte critique. Faut-il bloquer la convocation, l'émargement ou le passage de la session à « en cours » tant qu'une convention sous condition est `en_attente` ? Il faut une décision (périmètre et exceptions) et une tâche dédiée hors des `paths` actuels.
2. **Rendu de `{seuil}` en pourcentage** : « 50 % du prix toutes taxes comprises de la présente convention ». La base TTC a été choisie par la préparation. **À confirmer par A07.** La convention imprime un « Prix total HT », et la cohérence de la base avec la pratique des OPCO (HT/TTC selon le régime TVA du 1/10) relève de la juriste.
3. **Articulation avec le § 5 général** des deux conventions. Ce paragraphe dit qu'en cas de refus du financeur les sommes restent dues ; la clause dit le contraire (caducité, rien n'est dû). La clause spéciale déroge au § 5 (« 5 bis », placée juste après), mais **aucun renvoi explicite** n'est écrit, car je n'ai pas retouché un texte hors de la clause validée. À soumettre à A07 : faut-il un « Sous réserve de la clause 5 bis » ?
4. **Constat automatique.** Les transitions ne s'appliquent qu'au clic « Constater » ou « Renonciation », pour qu'elles soient journalisées avec un auteur. L'alerte signale qu'un constat est dû. Une constatation automatique nocturne est possible (cron `formation-crons`) si vous la souhaitez.
5. **Refus déclaré par l'entreprise** (`opco_suivi_entreprise.refus_declare_le`, lot A8) : il n'est **pas** lu comme refus de l'OPCO. Seul `DossierFinancement.refuseAt` (constaté par l'admin) l'est. C'est voulu (la clause parle d'un refus « notifié »), mais c'est à valider.
6. **Fenêtre app/worker** : voir § 3, risque résiduel des `update` sans `select` (hors périmètre).
7. Gate D : l'étape « Condition suspensive OPCO — CHECK (Postgres réel) » est ajoutée à `.github/workflows/ci.yml`. Elle sera **mesurée en CI au premier run de la PR**.

---

**Tête de `opco/int-t65-a-condition-suspensive` : `c0a8d80618ed0633a3e2f8e443f642a39922ffae`**
