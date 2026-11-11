# Plan — l'origine complète arrive au CRM, aussi pour une adresse tapée dans la conversation, et les origines suivantes suivent

> Statut : **CONCEPTION** (aucun code). Base : `main` @ `0139fc1f` (11/11/2026).
> Destinataire : un développeur (Sonnet), fiche par fiche (sous-fiches **S** ou **M**).
> Règles de Williams : **aucune suppression de données de personnes** (mise à l'écart seulement) ;
> **un « stop » l'emporte toujours** ; **rien de personnel dans les journaux**.
> Décision en vigueur, non rediscutée : **D1 du lot S3 — rien au CRM avant le clic du lien du guide**
> (adresse vérifiée). Ce plan ne fait partir des origines qu'**après** un clic de la personne.

## 1. Le problème, mesuré dans le code

Deux chemins livrent un guide venu d'un réseau :

- **Page « Recevoir le guide »** (`page-confirmation.ts`) : l'origine est écrite dans
  `guide_reseau_origines` (`page-confirmation.ts:319-347`) et part au CRM **au clic** dans le bloc v3
  (`lettre-guide.ts:369-388` → `clic-page-guide.ts:58-110`).
- **Adresse tapée dans la conversation** (Studio → `traiterDemande`, `traitement.ts:215-288`) :
  l'origine v3 est écrite (`traitement.ts:250`) mais **n'arrive jamais au CRM**.

Pourquoi, ligne par ligne :

1. **Chemin conversation → « sans_contact » → événement v1 sans origine.** Au clic,
   `evenementDuClicPageGuide` cherche un `contacts_guide_reseau` (`clic-page-guide.ts:65-70`) ; le chemin
   conversation n'en crée jamais → `sans_contact` → `lettre-guide.ts:389-391` émet l'événement v1 avec
   la source `guide-reseau` **mais sans `payload.origines`**. Le CRM sait « venu d'un réseau », pas
   d'où (post, canal, compte, mot, version du texte).
2. **Origines suivantes jamais transmises.**
   - Une fois la demande transmise (`crm_emitted_at` posé), tout clic suivant sort par
     `lettre-guide.ts:311-314` (« deja-transmise ») : une nouvelle origine (autre post, autre réseau,
     second dépôt de la page) ne part jamais.
   - Même au premier clic, la page ne lit que l'origine **écrite à la seconde de la case**
     (`clic-page-guide.ts:73-81`, filtre `occurredAt` exact) et du **premier** contact
     (`clic-page-guide.ts:65-69`, `orderBy: createdAt asc`).
   - `noterOrigineAvec(…, versLeCrm = false)` : plus aucun appelant ne passe `true`
     (`traitement.ts:153`, `page-confirmation.ts:346`) ; `transmettreOriginesV3`
     (`synchro-v3.ts:104-135`) n'est donc jamais appelé en production.
3. **Une demande née ailleurs n'est jamais « réseau ».** `viaReseau` exige
   `demande.origine === "message_prive"` (`lettre-guide.ts:337`) ; or `retrouverOuCreerDemande` ne
   réécrit l'origine que d'une ligne née d'un envoi console (`traitement.ts:90`). Une personne qui a
   d'abord demandé le guide sur `/guide-ia` puis via un réseau garde `origine = formulaire` : son
   origine réseau ne part jamais.
4. **Plafond incohérent.** Jusqu'à **50** origines actives par personne (`origines.ts:18`) mais une
   charge en refuse plus de **20** (`synchro-v3.ts:20`, `:72`) : envoyer « toutes les actives » ferait
   échouer la charge (`too_many_origines`). Il faut prendre **les 20 plus récentes**.
5. **Chemin v1 du Studio** : `traitement.ts:250` n'écrit l'origine que pour `schemaVersion === 3` ;
   une demande v1 n'a aucune ligne d'origine (voir D4).
6. Commentaire faux à corriger au passage : `prisma/schema.prisma:18151` dit que la clé de
   dédoublonnage contient la date ; le code l'a retirée (`origines.ts:97-107`).

Ce qui est déjà juste et qu'on réutilise : la forme de charge v3 **sans consentement ni prénom** est
celle que le CRM a acceptée en test (fixture `src/server/guides-reseau/__tests__/fixtures/charge-crm-v3.json`,
`synchro-v3.ts:4-7`) ; « la plus récente gagne » est porté par `origine_contenu` (`synchro-v3.ts:44-45`).

## 2. Ce qu'on veut à la fin

1. **Premier clic, chemin conversation** : l'événement `lead_magnet_requested` (même `event_id` que
   la demande, `eventIdDemandeGuide`) porte la charge v3 complète — `origine_contenu` + `origines`
   (20 plus récentes, actives, de cette personne pour ce guide) — **sans** `consentements` ni
   `first_name` (aucune case cochée : l'information M1 seulement).
2. **Premier clic, chemin page** : idem, mais toutes les origines actives (pas seulement celle de la
   seconde de la case), avec le bloc de consentement comme aujourd'hui.
3. **Origines suivantes** : toute origine écrite **après** la transmission de la demande part au CRM,
   en charge **cumulative** (les 20 plus récentes), dès son écriture si la personne a déjà cliqué une
   fois, sinon au premier clic (point 1/2). Jamais avant un clic (D1 du lot S3).
4. Chaque origine sait si elle est partie : colonnes `crm_statut` / `crm_traitee_le` — un rattrapage
   reprend celles restées en route.
5. Une adresse **opposée** ou **exclue** : rien ne part, les origines passent `crm_statut = 'ecartee'`
   (mise à l'écart, aucune suppression), et ne sont plus reproposées.

## 3. Principe : charge cumulative, identifiants déterministes

- Chaque événement « origines suivantes » porte **les 20 origines actives les plus récentes** de la
  personne pour le guide : il se suffit à lui-même. Un événement perdu, rejoué ou arrivé dans le
  désordre ne fausse rien : le CRM fait l'union des `origines` et garde `origine_contenu` le plus récent
  par date (règle du contrat v3, à **confirmer côté CRM Pro** : D2).
- `event_id` = `eventIdDeterministe("origine-v3:o-" + cle_dedoublonnage)` de l'origine **déclenchante**
  ; `subject_ref` = `site:guide-reseau:o-<cle_dedoublonnage[0..40]>` (même famille que
  `transmettreOriginesV3`, `synchro-v3.ts:126`). Rejouer = même identifiant = pas de doublon
  (`crm_sync_outbox.event_id` est unique, cf. `lettre-guide.ts:414-417`).
- Écriture de la ligne d'outbox **et** passage `crm_statut = 'transmise'` dans **une** transaction,
  avec le contrôle d'opposition **dans** la transaction (modèle `lettre-guide.ts:369-376`). Mise en
  file Redis après le commit, jamais attendue (`mettreEnFileCrm`).

## 4. Interrupteurs

- Tout reste derrière `SYNCHRO_CRM_V3` (existant, éteint) **et** les verrous habituels
  (`CRM_SYNC_ENABLED`, `CRM_SYNC_GUIDE_ENABLED`).
- **Nouveau** `SYNCHRO_CRM_V3_ORIGINES_SUIVANTES` (exactement `"true"`, app **et** worker, lu à
  l'exécution, **éteint par défaut**) pour les fiches O4-O5. Éteint : seul le premier clic change (O2-O3).

## 5. Sous-fiches

Ordre imposé par la fenêtre app↔worker (AGENTS.md) : la migration (O1) atterrit **seule** avant
tout code qui lit ses colonnes ; le worker (rattrapage, O5) tolère une colonne absente.

### O1 (S) — Migration : état CRM de chaque origine

Fichiers : `prisma/schema.prisma` (modèle `GuideReseauOrigine` ; corriger aussi le commentaire
l. 18151), `prisma/migrations/2026111xxxxxxx_guide_reseau_origines_crm/migration.sql`.

```sql
ALTER TABLE "guide_reseau_origines"
  ADD COLUMN "crm_statut"     VARCHAR(16),   -- NULL | 'transmise' | 'ecartee'
  ADD COLUMN "crm_traitee_le" TIMESTAMPTZ(3);
CREATE INDEX "guide_reseau_origines_crm_a_faire_idx"
  ON "guide_reseau_origines" ("created_at") WHERE "crm_statut" IS NULL;
```

Aucune reprise de données : les origines existantes restent `NULL` (« pas encore partie »). Ce que le
rattrapage en fera à l'allumage est la décision **D3**. Retour arrière : aucun `DROP` (le code
précédent ignore les colonnes). Test : `prisma validate` + garde de schéma (colonnes nullables).

### O2 (S) — Lecture des origines d'une personne pour un guide (fonction pure + requête)

Fichiers : `src/server/guides-reseau/origines.ts` (nouvelle `lireOriginesActives(db, emailKey, guide)`
: `archiveeLe: null`, `orderBy: occurredAt desc`, `take: MAX_ORIGINES_PAR_CHARGE`),
`src/server/guides-reseau/synchro-v3.ts` (nouvelle fonction pure `evenementConversationV3` : même
sortie que `evenementPageGuideV3` **sans** `consentements` ni `person.first_name`, avec
`guides_recus`, `payload = { ...payloadV1, ...charge, verifie: true }`, `source_slug: guide-reseau`).

Tests rouges (`__tests__/origines-cumulatives.spec.ts`, `__tests__/evenement-conversation-v3.spec.ts`) :

- 25 origines actives → la charge en porte 20, les plus récentes, triées par date croissante ;
  `origine_contenu` = la plus récente ;
- origines archivées et d'un autre guide exclues ;
- `evenementConversationV3` : pas de clé `consentements`, pas de `first_name`, `event_id` =
  `eventIdDemandeGuide(demandeId)`, `subject_ref` = `site:guide_request:<id>` ; compte/post_ref hors
  format CRM → erreur `origine_invalide` (comme la page) ;
- la charge ne contient ni `commentaire_ref_hmac`, ni `conv_ref`, ni texte libre (garde existante de
  `synchro-v3.ts:9-10`) — comparer à la fixture `charge-crm-v3.json` étendue.

### O3 (M) — Premier clic : l'origine complète part pour les deux chemins

Fichiers : `src/server/guides-reseau/clic-page-guide.ts`, `src/server/crm-sync/lettre-guide.ts`
(l. 369-391 seulement), `src/server/guides-reseau/__tests__/…`, `src/server/crm-sync/__tests__/clic-page-guide-v3.spec.ts`.

1. `evenementDuClicPageGuide` : remplacer la lecture « à la seconde de la case » (l. 73-97) par
   `lireOriginesActives` ; si **aucun contact** (`sans_contact`) **et** au moins une origine →
   `evenementConversationV3` au lieu de rendre `sans_contact`. Sans origine du tout → `sans_contact`
   (comportement actuel : v1 tel quel).
2. Dans la même transaction que la réservation (`lettre-guide.ts:362-388`), après l'écriture de la
   ligne d'outbox : `updateMany` des origines **lues** (`id in …`, `crm_statut: null`) →
   `'transmise'`, `crm_traitee_le = maintenant`. Opposition relue dans la transaction (existant,
   l. 373) → les origines passent `'ecartee'`, rien d'autre.
3. `viaReseau` (`lettre-guide.ts:337`) : **ajouter** « ou la personne a au moins une origine active
   pour ce guide » (point 3 du §1) — derrière `SYNCHRO_CRM_V3` (voir D5).

Tests rouges :

- conversation + clic → outbox `lead_magnet_requested` v3, `payload.origines` non vide, pas de
  `consentements` ; origines `transmise` ;
- page + deux origines (deux posts) → les deux dans la charge ;
- **rejeu** (second clic) → `deja-transmise`, aucune seconde ligne d'outbox ;
- **concurrence** clic/rattrapage CRM → une seule ligne (réservation `crm_emitted_at`, existant) ;
- **stop** entre la lecture et la transaction → aucune ligne d'outbox, origines `ecartee`, demande
  traitée, **aucune suppression** ;
- exclusion (`CRM_SYNC_EXCLUSIONS_SHA256`) → rien, origines inchangées (comme aujourd'hui : retirer
  l'empreinte rend la demande au rattrapage) ;
- `SYNCHRO_CRM_V3` éteint → charge v1 identique à `main` (test d'égalité sur la fixture).

### O4 (M) — Origines suivantes, à l'écriture

Fichiers : `src/server/guides-reseau/synchro-v3.ts` (nouvelle `transmettreOriginesSuivantes(emailKey,
email, guide, declenchante)`), `src/server/guides-reseau/traitement.ts` (l. 146-201 :
`noterOrigineAvec` appelle cette fonction **après** `enregistrerOrigine`, à la place du paramètre mort
`versLeCrm`), `src/server/guides-reseau/page-confirmation.ts` (l. 321-347 : même appel).

Règles, dans l'ordre :

1. Interrupteurs (`SYNCHRO_CRM_V3` + `SYNCHRO_CRM_V3_ORIGINES_SUIVANTES` + verrous CRM) sinon rien.
2. Exclusion → rien (l'origine reste `NULL`).
3. **La personne a-t-elle déjà cliqué ?** Il faut une `guide_requests` de cette empreinte et de ce
   guide avec `first_click_at` **et** `crm_emitted_at` non nuls. Sinon rien : la charge partira au
   premier clic (O3). C'est D1 du lot S3 : jamais avant un clic.
4. Transaction : verrou `pg_advisory_xact_lock(hashtext('origines:' + emailKey))` (le même que
   `origines.ts:116`) ; `estOpposee(email, tx)` → si opposée : origines `NULL` de la personne →
   `'ecartee'`, fin ; sinon lire les 20 actives, écrire l'outbox (`enqueueCrmSyncEvent(…, { tx,
mettreEnFile: false })`, identifiants §3), passer **toutes** les origines lues encore `NULL` à
   `'transmise'`.
5. Après commit : `mettreEnFileCrm(id)` sans attendre. Ne lève jamais (la personne attend son guide).
6. Journal agrégé seulement : `{ event: "guides_reseau_origines_crm", resultat, n }` — jamais
   d'adresse, d'empreinte, de `post_ref` ni de `cle_dedoublonnage`.

Tests rouges (`__tests__/origines-suivantes.spec.ts`) :

- personne déjà transmise + nouvelle origine → **une** ligne d'outbox cumulative (ancienne + nouvelle),
  `origine_contenu` = la nouvelle ;
- personne jamais cliquée → **aucune** ligne (D1) ;
- **rejeu** de la même demande Studio (même `cleIdempotence`) → `createMany skipDuplicates` ne crée
  rien, aucune seconde ligne d'outbox (même `event_id`) ;
- **désordre** : origine datée d'hier écrite après celle d'aujourd'hui → la charge garde
  `origine_contenu` = aujourd'hui ;
- **stop** déjà posé → aucune ligne d'outbox, origines `ecartee` ; **stop** posé pendant la
  transaction (simulé dans `tx`) → idem ;
- **panne** outbox (exception) → transaction annulée, origines restent `NULL` (le rattrapage O5 les
  reprendra), la demande du guide et son e-mail ne sont pas affectés ;
- interrupteur `ORIGINES_SUIVANTES` éteint → aucune requête vers l'outbox ;
- aucun `console.*` ne contient `@`, l'empreinte ou le `post_ref`.

### O5 (S) — Rattrapage des origines restées en route

Fichiers : `src/server/crm-sync/rattrapage-lettre-guide.ts` (un passage de plus, lots de
`TAILLE_LOT = 500`, `rattrapage-lettre-guide.ts:48`), son test.

- Sélection : origines `crm_statut IS NULL`, `archivee_le IS NULL`, `created_at < maintenant - 10 min`
  (laisser finir le chemin direct), dont la personne a cliqué (règle 3 d'O4) ; groupées par
  (empreinte, guide) → **une** transmission par groupe via `transmettreOriginesSuivantes`.
- Le passage ne lit la colonne que si elle existe : `P2022` → journal `colonne_absente`, sortie.
- Tests : origine `NULL` depuis 1 h d'une personne cliquée → transmise ; depuis 2 min → ignorée ;
  personne opposée → `ecartee` ; deux passes → une seule ligne d'outbox.

### O6 (S) — Documentation

`docs/guides-reseau-interrupteurs.md` : remplacer la l. 69 (« Le chemin “adresse tapée dans la
conversation” n'envoie plus rien au CRM à la réception ») par la règle complète : rien à la
réception, l'origine complète au premier clic, les suivantes après, interrupteur et ordre d'allumage
(`SYNCHRO_CRM_V3` d'abord, une charge cumulative de test acceptée en 2xx par le CRM, puis
`SYNCHRO_CRM_V3_ORIGINES_SUIVANTES`).

## 6. Rejeu, doublon, désordre, panne (récapitulatif)

| Cas                                   | Ce qui l'absorbe                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Studio rejoue la même demande         | journal d'idempotence (`reception.ts:1-40`) + `cle_dedoublonnage` + `event_id` déterministe |
| Deux clics, clic + rattrapage         | réservation `crm_emitted_at` (existant) ; `crm_statut` conditionnel (`NULL` seulement)      |
| Origines arrivées dans le désordre    | charge cumulative + `origine_contenu` par date (CRM : D2)                                   |
| Événement perdu / file Redis en panne | ligne d'outbox écrite en transaction ; balayage CRM existant (`crm-sync-sweep-cron`)        |
| Outbox en panne                       | transaction annulée, origines `NULL`, rattrapage O5                                         |
| « Stop » à tout moment                | `estOpposee` lu **dans** la transaction ; origines `ecartee` ; jamais supprimées            |
| Plus de 20 origines                   | les 20 plus récentes ; les plus anciennes déjà transmises par une charge précédente         |
| Fenêtre app↔worker (~50 min)          | O1 seul d'abord ; `P2022` toléré ; interrupteurs éteints jusqu'à l'atterrissage             |

## 7. Migration et retour arrière

- Une migration additive (O1), aucune reprise de données, aucun `DROP` au retour arrière.
- Retour arrière fonctionnel : éteindre `SYNCHRO_CRM_V3_ORIGINES_SUIVANTES` (O4-O5) ; éteindre
  `SYNCHRO_CRM_V3` (O3, retour au v1). Ce qui est déjà parti au CRM y reste (copie) ; les colonnes
  `crm_statut` gardent la trace.
- Une origine `ecartee` ne se « dé-écarte » que par décision de Williams (requête documentée).

## 8. Décisions à demander à Williams

- **D1** — Une personne venue par la **conversation** n'a coché aucune case : on transmet son origine
  **sans** consentement ni prénom (base : information M1 / intérêt légitime, comme le v1 actuel).
  D'accord ?
- **D2** — **À confirmer côté CRM Pro (autre dépôt)** : accepte-t-il (a) un `lead_magnet_requested`
  v3 **sans** `consentements` avec `source_slug: guide-reseau` et `subject_ref` `site:guide_request:…` ;
  (b) plusieurs événements v3 pour la même personne (origines suivantes) sans compter un nouveau
  « guide demandé » ; (c) l'union des `origines` et « la plus récente gagne » par date, quel que soit
  l'ordre d'arrivée ; (d) le format `site:guide-reseau:o-<40 hex>` ? Sinon, faut-il un type
  d'événement dédié (`origine_ajoutee`) ?
- **D3** — À l'allumage d'O5, que faire des origines **antérieures** (`crm_statut` NULL) des personnes
  déjà transmises ? Recommandé : les envoyer, en lots (une charge cumulative par personne et par guide).
  Alternative : une date de coupure en configuration (`ORIGINES_SUIVANTES_DEPUIS`) — les origines plus
  anciennes ne sont jamais envoyées et restent `NULL` (aucune fausse marque `transmise`).
- **D4** — Demandes **v1** du Studio (sans `post_ref`, canal, compte) : écrire quand même une origine
  minimale (mot, réseau, guide) pour qu'elle parte au CRM ? Recommandé : oui (`construireOrigine` sait
  déjà le faire, `origines.ts:77-95`).
- **D5** — Une demande née du formulaire `/guide-ia` puis redemandée par un réseau : la traiter comme
  « réseau » au clic (source `guide-reseau`) ou garder la source du formulaire et n'envoyer que les
  origines ? Recommandé : garder `source_slug` du formulaire (première source) et envoyer les origines.
