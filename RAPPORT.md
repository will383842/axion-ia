# Rapport — lot A5 « état des fonds OPCO »

Branche de code : `opco/a5-etat-des-fonds` (depuis `origin/main` `a84f003d`, qui
contient A1 et A2). Tête de branche : **`d8cff06b`**. Aucune PR ouverte (le corps est
prêt plus bas).

## Ce qui a été fait

1. **Schéma + migration** `20261004110000_etat_fonds_opco` — ajouts seuls : enum
   `StatutFondsOpco { ouvert reduit suspendu }`, table `etats_fonds_opco` (modèle
   `EtatFondsOpco`), index `(opco, idcc, releve_le)`, `CHECK (idcc ~ '^[0-9]{4}$')`.
   DDL identique à celui que génère `prisma migrate diff` depuis le schéma.
2. **Données de départ** dans la même migration, en deux `INSERT … SELECT … FROM (VALUES …)
   WHERE NOT EXISTS` (enums castés, `id` = `gen_random_uuid()`, `updated_at` =
   `CURRENT_TIMESTAMP`) :
   - AKTO `suspendu`, relevé le 2026-10-04, source la brève akto.fr du 22/09/2026, note
     verbatim, périmètre « <branche> — entreprises de moins de 50 salariés », pour les
     dix IDCC : 2149, 2583, 0573, 3243, 3218, 7520, 2002, 1516, 2147, 0158 ;
   - OPCO entiers (`idcc` NULL, `ouvert`) : OPCO Commerce 30/11/2026, Atlas 30/12/2026,
     Mobilités 31/12/2026, avec leurs notes et sources.
3. **Résolution pure** `etatFondsPour({ opco, idcc, effectif, aLaDate, releves })`
   (`src/server/qualiopi/financements/etat-fonds-opco.ts`) : branche > OPCO entier ;
   dernier relevé (`releveLe` puis `createdAt`) ; un relevé postérieur à `aLaDate` est
   ignoré ; suspension « moins de 50 salariés » ignorée si effectif ≥ 50 (on retombe sur
   la ligne de l'OPCO entier s'il y en a une) ; effectif inconnu → la suspension
   s'affiche ; `depasse` calculé au jour civil de Paris. IDCC du client normalisé
   (« 573 », « IDCC 0573 » → « 0573 »). Rend `{ statut, dateLimiteDepot, depasse,
   source, releveLe, note }`.
4. **Lecture base** `etat-fonds-opco-lecture.ts` : stub-aware (`[]`/`null` en panne ou
   au build), requêtes bornées (`take`), aucune fonction de modification ni de suppression.
5. **Page console** `qualiopi/etat-des-fonds` sur le patron de `qualiopi/baremes-opco` :
   `gardePage("consultation")`, `AccesRefuse`, `force-dynamic`, aucune requête au niveau
   module ; 3 tuiles, formulaire d'ajout, tableau des relevés en vigueur. Entrée de
   navigation à côté des barèmes (masquée sous « Catalogue », comme eux).
6. **Action serveur** `ajouterReleveEtatFondsAction` : `requireAdminWrite` d'abord, zod
   (`releveEtatFondsSchema`, source **https** obligatoire, IDCC à 4 chiffres),
   `create` seulement, journalisée (`qualiopi.etat_fonds_opco.ajout`).
7. **Bandeau** `BandeauEtatFonds` (Server Component) sur `qualiopi/clients/[id]` et
   `qualiopi/devis/[id]` : rouge « Financement suspendu pour cette branche (relevé du
   JJ/MM/AAAA) » + note + lien source ; orange « Dépôt avant le JJ/MM/AAAA » ou « Date
   limite dépassée (dépôt avant le …) » ; orange aussi pour `reduit` ; rien sinon.
8. **Alerte** `etat_fonds_perime` (catalogue `important`, `resolutionAuto`, guichet
   direction ; règle dans `evaluateur.ts`) : une requête `findFirst` sur le relevé le
   plus récent ; levée au-delà de 31 jours civils ; cible `EtatFondsOpco` (libellé ajouté
   dans `libelle-cible.ts`) ; aucune donnée personnelle.

## Fichiers

- `prisma/schema.prisma`, `prisma/migrations/20261004110000_etat_fonds_opco/migration.sql`
- `src/server/qualiopi/financements/etat-fonds-opco.ts` (+ `.spec.ts`)
- `src/server/qualiopi/financements/etat-fonds-opco-lecture.ts`
- `src/server/actions/qualiopi/etat-fonds-opco.ts` (+ `.spec.ts`)
- `src/components/admin/qualiopi/EtatFondsOpcoForm.tsx`, `BandeauEtatFonds.tsx`
  (+ `__tests__/le-bandeau-etat-des-fonds-dit-rouge-orange-ou-rien.spec.tsx`)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/etat-des-fonds/page.tsx`
- `…/qualiopi/clients/[id]/page.tsx`, `…/qualiopi/devis/[id]/page.tsx` (+7 lignes chacun)
- `src/lib/admin-nav.ts` (+ `admin-nav.test.ts` : compteurs 169→170, 31→32, 20→21,
  inventaire des href, recherche ⌘K « État des fonds »)
- `src/server/qualiopi/alertes/catalogue.ts`, `evaluateur.ts`, `libelle-cible.ts`
  (+ `catalogue.spec.ts`, `evaluateur.spec.ts`)

## ROUGE → VERT

| Témoin | ROUGE constaté | VERT |
| --- | --- | --- |
| Résolution, bandeau, schéma, seed (`etat-fonds-opco.spec.ts`) | module absent → échec d'import | 15/15 |
| Action (`actions/qualiopi/etat-fonds-opco.spec.ts`) | module absent → échec d'import | 4/4 |
| Alerte (`evaluateur.spec.ts` + `catalogue.spec.ts`) | `expected [] to have a length of 1` ; catalogue 121 ≠ 122 codes | 289 + 1 todo |
| Navigation (`admin-nav.test.ts`) | 3 compteurs (170≠169, 32≠31, 21≠20) | 53/53 avec le lexique |
| Bandeau rendu (`le-bandeau-…spec.tsx`) | écrit après le composant (pas de ROUGE observé) | 4/4 |

Témoins couverts : priorité branche > OPCO ; dernier relevé fait foi (y compris même jour,
`createdAt`) ; effectif 50 → suspension ignorée, 49 → appliquée, inconnu → appliquée ; date
dépassée le lendemain et pas le jour même (Paris) ; seed idempotent (le test lit le SQL :
autant de `WHERE NOT EXISTS` que d'`INSERT`, ni `UPDATE`, ni `DELETE`, ni `DROP`) ; action
refuse `http://`, `javascript:`, source vide, IDCC à 3 chiffres ; bandeau rouge / orange /
absent ; aucune action de modification ni de suppression exportée.

Autres vérifications : `tsc --noEmit` du projet propre ; eslint + prettier sur chaque
fichier touché ; tests existants de la fiche client (`clients/[id]/__tests__`, 15) verts ;
migration appliquée **puis rejouée** sur un PostgreSQL 16 jetable → 13 lignes, aucune en
double ; la contrainte refuse `idcc = '123'`.

## Limites

- **« Exploitations forestières et scieries agricoles » n'est PAS insérée** : la branche
  est faite de conventions régionales (pas d'IDCC unique). Une suspension pour une
  entreprise de cette branche **ne s'affichera pas** ; la saisir à la main par IDCC
  régional si un client en relève.
- **Seuil « moins de 50 salariés » lu dans le libellé `perimetre`** (expression
  `moins de 50 salari`), faute de colonne dédiée dans le modèle demandé. Le formulaire
  le dit à l'opérateur. Une colonne `effectifMax` serait plus robuste (lot ultérieur).
- **Atlas au 30/12/2026** (consigne) alors que `OPCO_FICHES.atlas.dateLimiteDepot2026`
  (A2) porte 2026-12-31 : les deux sources de vérité divergent d'un jour, à trancher.
- **Dates limites hors Mobilités** : la note « 15/01/2027 si la formation débute entre le
  15 et le 31/12 » est affichée telle quelle ; le bandeau, lui, ne connaît que le 31/12.
- **Volume** : ~900 lignes de code de production (dont 240 pour le formulaire, calqué
  sur `BaremeOpcoForm`), ~580 de tests, ~95 de migration — au-delà des ~600 visés.
- **Conflits probables avec A4** (`opco/a4-baremes-branche`, non fusionnée) : hunks
  voisins dans `prisma/schema.prisma` (juste après `model BaremeOpco`) et peut-être dans
  `evaluateur.spec.ts`. Ordre de migration : A4 `20261003233000` < A5 `20261004110000`,
  sans dépendance.
- **Effet de la fenêtre app/worker** : aucun — ni forme de job, ni énumération lue par le
  worker. L'alerte est évaluée par le balayage, qui tourne côté worker : pendant ~50 min
  après la fusion, il peut lire une table pas encore migrée ; `dernierReleveEtatFonds`
  attrape l'erreur et rend `null` (aucune alerte), sans casser le balayage.
- Réseau vers les OPCO bloqué : aucune donnée relue en ligne, celles de la consigne sont
  reprises telles quelles.
- Tests ciblés seulement ; ni suite complète ni `next build`.

## Corps de PR prêt à coller

**Titre** : `feat(opco): état des fonds OPCO — suspensions par branche, dates limites, bandeau et veille (chantier OPCO A5)`

```markdown
## Pourquoi
Les enveloppes OPCO s'épuisent en cours d'année : AKTO a suspendu le 22/09/2026 le plan
de développement des compétences des moins de 50 salariés pour dix branches, et chaque
OPCO a sa date limite de dépôt. La console ne le savait pas.

## Ce que fait la PR
- Modèle `EtatFondsOpco` versionné par AJOUT (le dernier relevé d'un couple OPCO × IDCC
  fait foi ; rien n'est modifié ni supprimé) ; migration d'ajouts seuls avec données de
  départ idempotentes (AKTO × 10 IDCC suspendus ; dates limites OPCO Commerce, Atlas,
  Mobilités).
- Résolution pure `etatFondsPour` : branche > OPCO entier ; suspension « moins de 50 »
  ignorée à partir de 50 salariés ; date dépassée au jour civil de Paris.
- Page console **État des fonds OPCO** (patron des barèmes, `force-dynamic`), ajout d'un
  relevé par action serveur zod, source https obligatoire, journalisée.
- Bandeau sur les fiches client et devis : rouge (suspension), orange (date limite), rien
  sans relevé.
- Alerte `etat_fonds_perime` : dernier relevé > 31 jours (veille mensuelle).

## Ce qui ne change pas
Aucun texte public. Aucune forme de job ni énumération lue par le worker.

## Limites
- « Exploitations forestières et scieries agricoles » non insérée (conventions régionales).
- Seuil « moins de 50 » lu dans le libellé du périmètre.
- Atlas : 30/12 ici, 31/12 dans `OPCO_FICHES` — à trancher.

## Vérifications
Tests ciblés verts (résolution, action, alerte, catalogue, navigation, bandeau, fiche
client) ; `tsc` propre ; migration appliquée et rejouée sur PostgreSQL 16 (13 lignes,
aucun doublon).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PCvBXDbgc2QJwRiqvwK72i
```

---

Sha de tête de `opco/a5-etat-des-fonds` : **`d8cff06b2622c99c9dabff04a5fd7873f2f282db`**
