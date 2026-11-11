# Plan — preuve d'accord « en attente » → « confirmée » → « non vérifiée, à l'écart »

> Statut : **CONCEPTION** (aucun code). Base : `main` @ `0139fc1f` (11/11/2026).
> Destinataire : un développeur (Sonnet) qui exécute fiche par fiche.
> Règles de Williams : **aucune suppression de données de personnes** (mise à l'écart seulement) ;
> **un « stop » l'emporte toujours** ; **rien de personnel dans les journaux**.

## 1. Le problème, mesuré dans le code

Sur la page « Recevoir le guide », l'accord (case unique) est écrit comme **acquis** dès l'envoi du
formulaire, alors que l'adresse n'est à ce moment qu'une **saisie** que n'importe qui peut faire :

- `src/server/guides-reseau/page-confirmation.ts:349-358` : `recordConsentEvent({ action: "consent",
formRef: FORM_REF_PAGE_GUIDE, … })` dans le `after()` du POST — aucune notion d'adresse vérifiée.
- Le lot S3 a déjà tiré la conséquence **pour le CRM** (l'événement part au clic, `verifie: true`,
  `src/server/guides-reseau/synchro-v3.ts:137-144`, `src/server/crm-sync/lettre-guide.ts:337-388`)
  mais **pas pour le registre de preuve du site**, qui dit « accord » pour une adresse jamais vérifiée.
- La « vérification » (premier clic sur le bouton du lien du guide) existe déjà :
  `src/app/api/guide-ia/telecharger/route.ts:140-150` pose `first_click_at` (POST seulement, jamais au
  GET). Mais la seule chose qui s'y accroche est `transmettreClicGuide` (`route.ts:178`), qui **sort
  immédiatement si `CRM_SYNC_GUIDE_ENABLED` est fermé** (`lettre-guide.ts:288`). La preuve ne doit pas
  dépendre d'un interrupteur du CRM.
- `contacts_guide_reseau` (`prisma/schema.prisma:18188-18220`) ne porte aucun état de preuve ;
  `merci_statut` sert déjà à la mise à l'écart de l'effacement (`src/lib/rgpd-erase.ts:1277-1298`) et au
  remerciement S4 (non livré) : ne pas le surcharger.
- `consent_events.action` est un `VARCHAR(16)` sans contrainte `CHECK`
  (`prisma/schema.prisma:13054`, migration `20260814120000_consents_v2_vivier_registre`) ; le type
  TypeScript est `ConsentAction` (`src/lib/consents/index.ts:52`).
- La purge de rétention ne touche **pas** les preuves de la page : `FORM_REFS_PREUVE_LETTRE_GUIDE`
  (`src/server/newsletter/retention.ts:166-170`) ne contient pas `guide-reseau-page`. À garder ainsi.
- Le guide peut être renvoyé par le rattrapage **jusqu'à 7 jours** (`HORIZON_RATTRAPAGE_MS`,
  `src/server/guide-ia/config.ts:72`) : une personne peut recevoir son lien au 7ᵉ jour.
- `src/server/guides-reseau/clic-page-guide.ts:65-69` lit le **premier** contact d'une demande
  (`orderBy: createdAt asc`) : si la personne a utilisé la page deux fois pour le même guide, le second
  accord n'est jamais regardé. La confirmation ci-dessous traite **tous** les contacts liés.

## 2. Ce qu'on veut à la fin

Trois états, portés par chaque ligne `contacts_guide_reseau` (sauf les MARQUES d'adresse opposée,
`page-confirmation.ts:96-103`, qui ne portent aucune donnée de personne) :

| État           | Quand                                                           | Ligne ajoutée au registre `consent_events` |
| -------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `en_attente`   | POST de la page (case cochée, demande enregistrée)              | `consent_attente` (15 car.)                |
| `confirmee`    | premier POST du bouton du lien du guide **après** `consenti_le` | `consent_confirme` (16 car.)               |
| `non_verifiee` | **N jours** après `consenti_le` sans clic — **mise à l'écart**  | `consent_ecarte` (14 car.)                 |

- **N proposé : 14 jours** (décision D1). Raison : le guide peut partir jusqu'à J+7 (rattrapage) ;
  14 laisse au moins 7 jours de lecture après le dernier envoi possible, sans garder indéfiniment un
  accord jamais vérifié. Constante unique `JOURS_AVANT_ECART_PREUVE = 14` dans
  `src/server/guides-reseau/config.ts`.
- « À l'écart » veut dire : **rien n'est supprimé** (prénom chiffré, empreinte du texte, dates
  restent) ; la ligne n'est plus jamais traitée comme un accord : pas de remerciement S4, pas
  d'événement CRM (déjà vrai : sans clic, `first_click_at` est vide), et le registre le dit.
- Le registre reste **append-only** : les anciennes lignes `consent` (écrites depuis S2) ne sont pas
  réécrites ; elles se lisent « accord saisi, avant la distinction en attente/confirmé ».
- Un **« stop »** (opposition) l'emporte : il ne change pas l'état de preuve (c'est un fait passé),
  mais aucune transition ne déclenche jamais d'envoi, et le CRM reste bloqué par `estOpposee`
  (`lettre-guide.ts:318-324`, `:373-376`). Voir D3.

## 3. Fichiers autorisés

- `prisma/schema.prisma` (modèle `ContactGuideReseau` seulement) + **une** migration neuve
  `prisma/migrations/2026111xxxxxxx_contacts_guide_reseau_preuve_statut/migration.sql`
- `src/lib/consents/index.ts` (élargir `ConsentAction` : `consent_attente`, `consent_confirme`,
  `consent_ecarte` — rien d'autre)
- `src/server/guides-reseau/page-confirmation.ts` (l. 229-244 et 349-358)
- **nouveau** `src/server/guides-reseau/preuve-page-guide.ts` (confirmer, écarter, constantes d'état)
- `src/server/guides-reseau/config.ts` (constante N + interrupteur)
- `src/app/api/guide-ia/telecharger/route.ts` (un appel après l. 150, hors CRM)
- `src/server/queue/queues.ts` (bloc `guideIaCronsQueue`, l. 1368-1389 : un répétable de plus),
  `src/server/queue/types.ts:271` (`GuideIaCronJobType`), `src/server/queue/workers/guide-ia-crons-worker.ts`
- `src/lib/rgpd-guide-reseau.ts` (export art. 15 : ajouter l'état et ses dates)
- `docs/guides-reseau-interrupteurs.md`
- Tests neufs sous `src/server/guides-reseau/__tests__/` (noms §6)

Interdits : toute instruction `DELETE`/`deleteMany` ; `merci_statut` ; `src/lib/rgpd-erase.ts` ;
`retention.ts` ; le CRM (`src/server/crm-sync/**`) ; `consent_events` existants (aucun `UPDATE`).

## 4. Migration (fiche P1, PR à part, posée AVANT tout code qui la lit)

Même discipline que `20261108140000_contacts_guide_reseau` (« table posée AVANT tout code qui la
lit ») et que la fenêtre app↔worker d'AGENTS.md : c'est l'**app** qui migre, le **worker** (qui fera
l'écart) peut tourner du code plus récent pendant ~50 min.

```sql
ALTER TABLE "contacts_guide_reseau"
  ADD COLUMN "preuve_statut"       VARCHAR(16),
  ADD COLUMN "preuve_confirmee_le" TIMESTAMPTZ(3),
  ADD COLUMN "preuve_ecartee_le"   TIMESTAMPTZ(3);
CREATE INDEX "contacts_guide_reseau_preuve_statut_consenti_le_idx"
  ON "contacts_guide_reseau" ("preuve_statut", "consenti_le");

-- Reprise de l'existant (aucune suppression) :
-- 1) MARQUES (adresse opposée, aucune donnée de personne) → 'sans_objet'
UPDATE "contacts_guide_reseau" SET "preuve_statut" = 'sans_objet'
 WHERE "email_key" = '-' AND "preuve_statut" IS NULL;
-- 2) Un clic connu APRÈS l'accord → 'confirmee' (date : premier clic connu ≥ consenti_le)
UPDATE "contacts_guide_reseau" c
   SET "preuve_statut" = 'confirmee',
       "preuve_confirmee_le" = CASE WHEN g."first_click_at" >= c."consenti_le"
                                    THEN g."first_click_at" ELSE g."last_click_at" END
  FROM "guide_requests" g
 WHERE c."guide_request_id" = g."id" AND c."preuve_statut" IS NULL
   AND g."last_click_at" IS NOT NULL AND g."last_click_at" >= c."consenti_le";
-- 3) Le reste → 'en_attente' (l'écart, plus tard, suivra la règle des N jours)
UPDATE "contacts_guide_reseau" SET "preuve_statut" = 'en_attente' WHERE "preuve_statut" IS NULL;
```

- Colonnes **nullables** : l'ancien code (qui ne les écrit pas) continue de tourner ; le nouveau code
  lit `NULL` comme `en_attente`.
- La reprise n'écrit **pas** de lignes `consent_events` (le registre ne s'invente pas de passé) ; elle
  est consignée dans le commentaire de la migration.
- **Retour arrière** : aucun `DROP`. Revenir au code précédent suffit (il ignore les colonnes).
  Supprimer les colonnes détruirait des dates de preuve : interdit sans décision de Williams.

## 5. Étapes (fiches)

### P1 (S) — Migration seule

Schéma + migration §4. Test : `prisma validate` ; un test d'intégrité de schéma (`preuve_statut`
nullable, index présent). Fusion, puis **vérifier l'atterrissage du schéma** (procédure AGENTS.md :
`prisma migrate status` dans le conteneur app) **avant** P2.

### P2 (S) — « En attente » au POST de la page

1. Tests rouges P2.
2. `page-confirmation.ts:232-243` : `preuveStatut: "en_attente"` dans le `create` du contact (dans la
   transaction existante). La MARQUE (l. 214-225) : `preuveStatut: "sans_objet"`.
3. `page-confirmation.ts:350-358` : `action: "consent_attente"` au lieu de `"consent"` (même
   `formRef`, même version, même `occurredAt` = instant de la case, IP/agent hachés comme avant).
4. `ConsentAction` élargi. Vérifier que les lecteurs du registre (`src/server/newsletter/console.ts:307`,
   `src/app/api/gdpr-export/route.ts:277`) affichent une valeur inconnue sans planter.

### P3 (M) — « Confirmée » au clic, indépendante du CRM

1. Tests rouges P3.
2. `preuve-page-guide.ts` → `confirmerPreuvesAuClic(guideRequestId, clicLe)` :
   - `updateMany({ where: { guideRequestId, OR: [{ preuveStatut: "en_attente" }, { preuveStatut: null }],
consentiLe: { lte: clicLe } }, data: { preuveStatut: "confirmee", preuveConfirmeeLe: clicLe } })`
     — **conditionnel** : seul le passage qui change l'état écrit le registre (⚠️ Prisma : `in`
     n'accepte pas `null`, d'où le `OR`) ;
   - pour chaque ligne réellement passée (relire par `preuveConfirmeeLe = clicLe` et
     `guideRequestId`) : `recordConsentEvent({ action: "consent_confirme", occurredAt: clicLe, … })`
     — l'adresse vient de `guide_requests.email` (jamais du journal) ;
   - ne lève jamais (même discipline que `recordConsentEvent`) ; journal sans donnée :
     `{ event: "guides_reseau_preuve", transition: "confirmee", lignes: n }`.
3. `telecharger/route.ts` : appeler `confirmerPreuvesAuClic(demande.id, maintenant)` **à chaque POST**
   (pas seulement au premier : un second dépôt sur la même demande se confirme au clic suivant), borné
   par le même `auPlus(…)` que le CRM, **avant** `transmettreClicGuide`, hors de tout interrupteur CRM.
   Un GET ne confirme jamais.
4. Clic tardif sur une ligne `non_verifiee` : voir **D2** (recommandé : la confirmer aussi, en ajoutant
   `{ preuveStatut: "non_verifiee" }` au `OR` — le clic est le geste de la personne elle-même).

### P4 (M) — « Non vérifiée, à l'écart » après N jours

1. Tests rouges P4.
2. `preuve-page-guide.ts` → `ecarterPreuvesNonVerifiees(maintenant)` :
   - lots de 500, curseur sur `(consentiLe, id)` ;
   - `updateMany({ where: { id: { in: lot }, OR: [{ preuveStatut: "en_attente" }, { preuveStatut: null }],
consentiLe: { lt: maintenant - N jours } }, data: { preuveStatut: "non_verifiee",
preuveEcarteeLe: maintenant } })` ;
   - registre : `consent_ecarte` pour chaque ligne passée (adresse lue via `guide_requests` ; ligne
     sans demande liée → pas de ligne de registre, l'état suffit, compteur `sans_adresse`) ;
   - journal agrégé seulement : `{ event: "guides_reseau_preuve", transition: "non_verifiee",
lignes, sans_adresse }`.
3. Répétable quotidien `guide-ia-crons` type `"preuves"`, motif `"23 4 * * *"`, `jobId`
   `"guides-reseau-preuves-cron"` (même bloc `removeRepeatable` + `add` que `queues.ts:1368-1389`).
4. **Interrupteur `PREUVE_PAGE_GUIDE_ECART_ENABLED`** (exactement `"true"`, conteneur **worker**, lu à
   l'exécution, **éteint par défaut**). Éteint : le job sort sans lire la base. Il ne s'allume
   qu'après l'atterrissage de P1 **et** de P3 (sinon on écarterait des personnes qui ont cliqué
   pendant que le clic ne confirmait pas encore).
5. Garde : le worker attrape une colonne absente (Prisma `P2022`) → journal `colonne_absente`, aucun
   effet (fenêtre app↔worker).

### P5 (S) — Export art. 15 et documentation

`src/lib/rgpd-guide-reseau.ts:55-102` : ajouter `preuve` (`en_attente` | `confirmee` |
`non_verifiee` | `sans_objet`) et ses deux dates. `docs/guides-reseau-interrupteurs.md` : section
« Preuve de l'accord », N, interrupteur, ordre d'allumage. Signaler au lot S4 qu'il ne doit envoyer le
remerciement qu'à `preuve_statut = 'confirmee'` (fiche S4, pas ici).

## 6. Tests rouges à écrire AVANT le code

`src/server/guides-reseau/__tests__/preuve-en-attente.spec.ts` (P2) :

- POST valide → contact `preuveStatut: "en_attente"` ; registre `consent_attente`, **plus aucune**
  ligne `consent` ; `occurredAt` = instant de la case ;
- adresse opposée → MARQUE `sans_objet`, **aucune** ligne de registre (M1 inchangé, même réponse) ;
- jeton rejoué (P2002 sur `jeton_empreinte`) → rien écrit, réponse neutre (inchangé).

`preuve-confirmee-au-clic.spec.ts` (P3) :

- clic (POST) après la case → `confirmee`, `preuveConfirmeeLe = clic`, **un** `consent_confirme` ;
- **rejeu** : second POST → aucune nouvelle ligne de registre (`updateMany` count 0) ;
- **concurrence** : deux POST simultanés → une seule transition, un seul `consent_confirme` ;
- **désordre** : clic dont l'instant précède `consenti_le` (bouton d'un ancien e-mail de la même
  demande, puis nouveau dépôt) → la ligne reste `en_attente` ;
- deux contacts liés à la même demande → les deux confirmés ;
- **`CRM_SYNC_GUIDE_ENABLED` fermé** → la confirmation a lieu quand même ;
- GET du lien → aucune transition ;
- adresse opposée entre la case et le clic → confirmation écrite (fait), aucun envoi, CRM « opposee »
  (selon D3) ;
- panne de base pendant la confirmation → la redirection vers le PDF part quand même (ne lève pas).

`preuve-ecartee-apres-n-jours.spec.ts` (P4) :

- `en_attente` à J+13 j 23 h → inchangée ; à J+14 → `non_verifiee`, `preuveEcarteeLe`, un
  `consent_ecarte` ;
- **aucune** suppression : espionner `deleteMany`/`delete` sur tous les modèles → jamais appelés ;
  prénom chiffré, `consent_empreinte`, `consenti_le` intacts ;
- `confirmee` et `sans_objet` jamais touchées ; rejouer le job → aucun effet (idempotent) ;
- interrupteur éteint → aucune requête ;
- course clic/écart : le clic passe le premier → `confirmee` reste ; l'écart passe le premier → selon
  D2 ;
- journaux : aucune adresse, aucun prénom, aucune empreinte (espion `console.*`, recherche de `@`
  et de l'empreinte).

`config.spec.ts` (existant, à compléter) : `JOURS_AVANT_ECART_PREUVE === 14` et
`> HORIZON_RATTRAPAGE_MS / jour` (garde : l'écart ne peut pas précéder le dernier envoi possible).

## 7. Rejeu, doublon, désordre, panne

- **Rejeu** : transitions par `updateMany` conditionnels ; le registre n'est écrit que si `count > 0`.
- **Doublon** : deux dépôts de la page pour le même guide → deux contacts, deux preuves, toutes deux
  confirmées par un clic postérieur à chacune.
- **Désordre** : clic antérieur à la case → n'est pas une vérification de CET accord ; écart et clic
  simultanés → le premier `updateMany` gagne, l'autre ne trouve plus l'état attendu.
- **Panne** : `recordConsentEvent` est best-effort (ne lève pas) ; si l'état est passé mais la ligne de
  registre a échoué, la fiche P4 ajoute une **réparation** : pour les lignes `confirmee` /
  `non_verifiee` des 30 derniers jours sans ligne de registre correspondante (même `personKey`,
  `formRef`, `action`, `occurredAt`), l'écrire. Base en panne au clic → la personne a son PDF ; la ligne
  reste `en_attente` et sera confirmée au clic suivant, sinon écartée à N jours (conséquence assumée).

## 8. Retour arrière

- P2 : revenir au code précédent → `consent` réapparaît, colonnes ignorées. Les lignes déjà écrites
  restent (append-only).
- P3 : idem ; les états déjà posés restent vrais.
- P4 : **éteindre `PREUVE_PAGE_GUIDE_ECART_ENABLED`**. Une mise à l'écart déjà posée ne se défait
  **que** par décision de Williams (une requête `UPDATE … SET preuve_statut = 'en_attente'` documentée,
  jamais un `DELETE`).

## 9. Décisions à demander à Williams

- **D1** — N = **14 jours** (proposé) ? (Plancher technique : > 7 jours, horizon du rattrapage.)
- **D2** — Clic **après** la mise à l'écart : la preuve redevient `confirmee` (recommandé, c'est le
  geste de la personne) ou reste `non_verifiee` ?
- **D3** — Clic d'une adresse **déjà opposée** : enregistrer quand même `consent_confirme` (recommandé :
  c'est une preuve du passé ; le « stop » continue de tout bloquer) ou ne rien écrire ?
- **D4** — Les lignes `consent` déjà écrites depuis S2 : les laisser telles quelles (recommandé,
  append-only) ou ajouter, une fois, une ligne `consent_attente` jumelle ?
- **D5** — Durée de conservation des preuves `non_verifiee` : aucune purge n'existe pour
  `guide-reseau-page` (retention.ts:166). Garder sans limite jusqu'à décision (recommandé, conforme à
  « aucune suppression ») ?
