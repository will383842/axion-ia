# Rapport — lot A4 « barèmes OPCO par branche et par taille »

Branche de code : `opco/a4-baremes-branche` (depuis `origin/main` `c22f9f34`).
Tête de branche : **`a5398e43`**. Aucune PR ouverte (le corps est prêt plus bas).

## ⛔ À lire d'abord : AUCUN barème de départ n'a été inséré

Les six pages sources ont été demandées le 2026-10-03 (WebFetch puis `curl`) :
**toutes refusées par le proxy de sortie de l'environnement** (`403` au `CONNECT`,
« Access to www.akto.fr is blocked by the network egress proxy »). Hôtes refusés :
`www.akto.fr`, `www.opcomobilites.fr`, `www.lopcommerce.com`, `www.opco-sante.fr`,
`www.constructys.fr`.

Conformément à la consigne (« si la page ne confirme pas, ne l'insère pas »), **aucune
valeur n'est insérée**. Un moteur de recherche a renvoyé un extrait d'akto.fr qui
**contredit** l'énoncé pour l'IDCC 1516 (il prête à cette page 2 500 € / 4 000 €, les
chiffres annoncés pour l'interprofession) — une raison de plus de ne rien poser sans
relecture de la page.

La migration du lot ne contient donc aucun `INSERT`, et le test
`tests/unit/ci/le-bareme-opco-se-resout-par-branche.spec.ts` exige que toute insertion
future dans ce fichier soit gardée par `WHERE NOT EXISTS`.

## Ce qui a été fait

1. **Schéma** — `BaremeOpco.idcc Char(4)` (CHECK `^[0-9]{4}$` en `NOT VALID`),
   `BaremeOpco.trancheEffectif TrancheEffectifOpco @default(tous)` (nouvel enum
   `moins_11 | de_11_a_49 | tous`), index `(opco, idcc, trancheEffectif, dateEffet)`.
   Sur `Devis` : `opcoEstimationOrigine` (enum `OrigineEstimationOpco`) et
   `opcoEstimationAvertissement` (texte), pour pouvoir **afficher** l'origine dans la
   console. Migration `20261003233000_bareme_opco_branche_tranche` : uniquement des ajouts.
2. **Résolution** — `resolveBaremeOpco(opco, asOf, { idcc?, effectif? })` : branche +
   tranche exacte > branche + `tous` > OPCO + tranche exacte > OPCO + `tous` ; effectif
   inconnu → seulement `tous`. Logique pure dans `bareme-opco-branche.ts`. Sans critère,
   le comportement historique est conservé (barèmes existants = `idcc` null, `tous`).
3. **Versionnement** — `creerVersionBaremeOpco` clôt désormais les versions ouvertes du
   même **périmètre** (OPCO × IDCC × tranche) et non plus de tout l'OPCO : sinon saisir
   un barème de branche aurait fermé celui de l'OPCO. `listBaremesEnVigueur` garde un
   barème par périmètre (l'alerte de péremption voit aussi les barèmes de branche).
4. **Estimation** — `estimateOpcoCoverage` rend `origine` et `avertissement` :
   - barème trouvé → `bareme` ;
   - aucun barème (ou pas d'OPCO) → **même montant qu'avant** (réglages `opco_atlas_*`),
     `reglage_par_defaut` + « Estimation indicative : aucun barème relevé pour cet OPCO
     et cette branche, à confirmer auprès de l'OPCO. » ;
   - effectif connu ≥ 50 → 0 €, `hors_fonds_legaux` + avertissement (art. L6332-17).
5. **Action devis** — passe l'IDCC du client (uniquement s'il fait exactement 4
   chiffres), l'effectif s'il existe, et l'enveloppe : saisie > `Client.opcoEnveloppeAnnuelleCents`
   > plafond annuel. Persiste origine + avertissement ; la révision d'un devis les recopie.
6. **Console** — fiche devis : ligne « Origine : … » + avertissement ; liste des devis :
   mention « (indicatif) » / « (hors fonds légaux) » avec l'avertissement en infobulle.
7. **Alerte `aucun_bareme_opco`** (important, résolution auto, guichet direction) :
   devis OPCO `brouillon`/`envoye` estimé sur réglages par défaut ; session OPCO
   `planifiee` à venir (subrogation ou dossier de financement) dont le client a un OPCO
   identifié, moins de 50 salariés ou effectif inconnu, et aucun barème applicable à la
   date de début.

### `Client.effectif` (PR parallèle `opco/a1-schema-effectif-opco`)

Le champ n'existe pas sur `main`. Point d'extension : `effectifDuClient(client)` dans
`src/server/qualiopi/financements/bareme-opco-branche.ts`, qui lit `effectif` **s'il est
présent** sur l'objet. L'action et l'alerte lisent le client **sans `select`** (tous les
scalaires) : le code compile avant et après A1, et l'effectif est pris en compte dès que
A1 est fusionnée, sans autre modification. À vérifier après A1 : le nom exact du champ
(`effectif`, entier).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `prisma/schema.prisma` | enums `TrancheEffectifOpco`, `OrigineEstimationOpco` ; champs + index |
| `prisma/migrations/20261003233000_bareme_opco_branche_tranche/migration.sql` | ajouts seuls |
| `src/server/qualiopi/financements/bareme-opco-branche.ts` (nouveau) | tranche, IDCC, effectif, ordre de priorité |
| `src/server/qualiopi/financements/bareme-opco.ts` | résolution par critère ; dédup par périmètre |
| `src/server/qualiopi/financements/bareme-opco-service.ts` | versionnement borné au périmètre |
| `src/server/qualiopi/crm/devis.ts` | `origine`, `avertissement`, hors fonds légaux |
| `src/server/actions/qualiopi/devis.ts` | IDCC, effectif, enveloppe client ; persistance |
| `src/server/qualiopi/alertes/catalogue.ts`, `evaluateur.ts` | alerte `aucun_bareme_opco` |
| `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/[id]/page.tsx`, `devis/page.tsx` | affichage |
| tests : `bareme-opco-branche.spec.ts` (nouveau), `bareme-opco.spec.ts`, `bareme-opco-service.spec.ts`, `devis-opco.spec.ts`, `evaluateur.spec.ts`, `catalogue.spec.ts`, `tests/unit/ci/le-bareme-opco-se-resout-par-branche.spec.ts` (nouveau) | |

Diff : 18 fichiers, +790 / −74 (dont ~450 lignes de tests et ~40 de réalignement par `prisma format`).

## Preuve ROUGE puis VERTE

ROUGE 1 — commit `b6e6f6df` (tests seuls) :

```
pnpm vitest run src/server/qualiopi/financements/bareme-opco-branche.spec.ts \
  src/server/qualiopi/financements/bareme-opco.spec.ts src/server/qualiopi/crm/devis-opco.spec.ts \
  src/server/qualiopi/alertes/evaluateur.spec.ts src/server/qualiopi/alertes/catalogue.spec.ts \
  tests/unit/ci/le-bareme-opco-se-resout-par-branche.spec.ts
 FAIL  src/server/qualiopi/financements/bareme-opco-branche.spec.ts
Error: Failed to resolve import "./bareme-opco-branche" …
⎯⎯⎯ Failed Tests 17 ⎯⎯⎯
 FAIL catalogue.spec.ts > contient exactement les codes attendus — expected [ …(121) ] to deeply equal [ …(122) ]
 FAIL evaluateur.spec.ts > aucun_bareme_opco > lève l'alerte pour une session … — expected [] to have a length of 1
 FAIL devis-opco.spec.ts > effectif 50 → 0 € … — expected 40000 to be +0
 FAIL devis-opco.spec.ts > aucun barème → … — expected undefined to be 'reglage_par_defaut'
 FAIL bareme-opco.spec.ts > interroge les versions en vigueur … — expected undefined to be 'b1'
 FAIL le-bareme-opco-se-resout-par-branche.spec.ts > existe une seule fois … (4 tests)
```

ROUGE 2 — commit `5cfd4cac` (versionnement par périmètre) :

```
pnpm vitest run src/server/qualiopi/financements/bareme-opco-service.spec.ts
   × lot A4 — une version de branche ne clôt QUE son périmètre (OPCO × IDCC × tranche)
      Tests  3 failed | 3 passed (6)
```

VERT — tête `a5398e43` :

```
pnpm vitest run <les 7 fichiers ci-dessus> \
  src/server/actions/qualiopi/__tests__/une-collision-de-numero-ne-laisse-aucune-trace-orpheline.spec.ts \
  src/server/visio/__tests__/les-codes-d-alerte-du-circuit-sont-au-catalogue.spec.ts \
  tests/unit/ci/le-defaut-declare-et-celui-de-la-base-ne-divergent-pas.spec.ts
 Test Files  10 passed (10)
      Tests  351 passed | 1 todo (352)
pnpm vitest run src/server/qualiopi/alertes   →   Tests  837 passed | 1 todo (838)
pnpm tsc --noEmit -p tsconfig.json            →   exit 0, 0 erreur
```

Témoins demandés, tous couverts : branche prioritaire sur OPCO ; tranche 11-49
appliquée ; effectif inconnu → `tous` seulement ; aucun barème → `reglage_par_defaut` +
avertissement + montant inchangé (28 000 ¢, identique au calcul d'avant) ; effectif 50 →
0 et `hors_fonds_legaux` ; alerte levée (session et devis). Double exécution du seed :
**sans objet** (aucun seed), le test verrouille la garde `WHERE NOT EXISTS` pour la suite.

## Barèmes de départ

| Barème demandé | Valeurs annoncées | Source | Statut |
| --- | --- | --- | --- |
| AKTO interprofession | 2 500 € (<11), 4 000 € (11-49), inter 30 €/h | https://www.akto.fr/regles-de-prise-en-charge-interprofession/ | **non inséré** — page injoignable (proxy 403) |
| AKTO organismes de formation, IDCC 1516 | 4 500 € (<11), 5 600 € (11-49), 60 €/h ; financement suspendu 2026 | page candidate : https://www.akto.fr/regles-de-prise-en-charge-organisme-de-formation/ ; brève https://www.akto.fr/breve/entreprises-moins-50-salaries-suspension-financement-formations-pdc/ | **non inséré** — injoignable ; extrait de recherche contradictoire (2 500 / 4 000) |
| Opcommerce bureau et numérique « Compétences+ » | 3 000 € HT/an | lopcommerce.com (URL et IDCC non trouvés) | **non inséré** — injoignable |
| OPCO Mobilités | 1 500 € (<11), 1 800 € (11-49, détail par sous-tranche) | opcomobilites.fr | **non inséré** — injoignable |
| Opco Santé hors branche | 2 500 €/an | opco-sante.fr | **non inséré** — injoignable |
| Constructys Bâtiment | 19 €/h depuis le 01/06/2026 (11 à < 300) | constructys.fr | **non inséré** — injoignable |

Pour la session qui reprendra avec un accès réseau : une migration **à part**
(`AAAAMMJJHHMMSS_baremes_opco_depart`), une ligne par valeur relue, sur ce modèle :

```sql
INSERT INTO "baremes_opco" ("id", "opco", "perimetre", "idcc", "tranche_effectif",
  "plafond_annuel_cents", "source_url", "releve_le", "date_effet", "note", "created_by_id", "updated_at")
SELECT gen_random_uuid(), 'akto', '…', NULL, 'moins_11', <centimes>, '<url>',
  '<AAAA-MM-JJ>', '<date d''effet>', 'Inséré par migration, chantier OPCO, vérifié le <AAAA-MM-JJ>', NULL, now()
WHERE NOT EXISTS (
  SELECT 1 FROM "baremes_opco"
  WHERE "opco" = 'akto' AND "idcc" IS NULL AND "tranche_effectif" = 'moins_11' AND "date_effet" = '<date d''effet>'
);
```

## Limites

- **Aucun barème inséré** (voir plus haut) : tant qu'un barème n'est pas saisi, toute
  estimation OPCO sort en `reglage_par_defaut` avec l'avertissement, et l'alerte
  `aucun_bareme_opco` se lèvera sur les devis/sessions OPCO ouverts. C'est le
  comportement voulu, mais le premier passage du balayage peut en produire plusieurs.
- **Gabarit PDF du devis non modifié** (consigne) : l'avertissement n'est pas imprimé, et
  pour un client de 50 salariés ou plus le PDF peut afficher « Prise en charge estimée :
  0,00 € » si l'estimation est présentable (régime de certification). À traiter dans un
  lot dédié.
- **Écran `qualiopi/baremes-opco` non modifié** : le formulaire ne permet pas encore de
  saisir l'IDCC ni la tranche (le service les accepte). Saisie possible par migration ou
  en complétant le formulaire dans un lot suivant.
- Origine `bareme` dès qu'une ligne s'applique, même si un plafond précis (horaire de la
  modalité) n'y est pas relevé et que le réglage par défaut comble ce champ (repli champ
  par champ du lot 5, conservé).
- Les réglages `opco_atlas_*` (40/25/15 €/h, 8 000 €) restent **sans source** : ce lot les
  signale comme indicatifs, il ne les corrige pas.
- Effectif : dépend de la PR A1 (cf. point d'extension). Sans elle, l'effectif est
  toujours « inconnu » : jamais de `hors_fonds_legaux`, seulement des barèmes `tous`.
- Les devis déjà émis gardent `opcoEstimationOrigine` NULL (aucun recalcul rétroactif) ;
  l'alerte ne les vise pas.

## Corps de PR prêt à coller

```markdown
## Ce que fait cette PR

Les plafonds OPCO varient par **branche** (IDCC) et par **taille** d'entreprise. Jusqu'ici,
tout OPCO sans barème retombait **silencieusement** sur les réglages « Atlas ».

- `BaremeOpco` porte `idcc` (4 chiffres, CHECK `NOT VALID`) et `trancheEffectif`
  (`moins_11 | de_11_a_49 | tous`, défaut `tous`) ; migration d'ajouts seuls.
- `resolveBaremeOpco(opco, asOf, { idcc, effectif })` : branche + tranche > branche +
  tous > OPCO + tranche > OPCO + tous ; effectif inconnu → `tous` seulement.
- Le versionnement d'un barème est borné à son périmètre (OPCO × IDCC × tranche).
- `estimateOpcoCoverage` rend `origine` (`bareme` | `reglage_par_defaut` |
  `hors_fonds_legaux`) et un avertissement ; sans barème, le **montant est inchangé** ;
  à 50 salariés ou plus, 0 € (art. L6332-17 C. trav.).
- Le devis enregistre et affiche (console) l'origine et l'avertissement.
- Nouvelle alerte `aucun_bareme_opco` (devis ou session OPCO à venir sans barème).

Aucun texte public ne change. Aucun barème de départ n'est inséré (sources injoignables
depuis l'environnement — cf. Limites).

## ROUGE avant VERT

- `b6e6f6df` tests seuls : 17 échecs + 1 fichier non résolu.
- `5cfd4cac` versionnement par périmètre : 3 échecs.
- Tête `a5398e43` : 10 fichiers, 351 tests verts ; `src/server/qualiopi/alertes` 837 verts ;
  `tsc --noEmit` sans erreur.

## Attaque

- Un barème de branche saisi après celui de l'OPCO ne le clôt plus (testé).
- `Client.idcc` libre : « IDCC 1516 », « 516 », « 15160 » sont ignorés (testé).
- Effectif lu sans exiger le champ : compile avant et après la PR A1.
- **Fenêtre app/worker (~50 min, AGENTS.md)** : le balayage d'alertes tourne dans le
  worker (`synchroniserAlertes`, `qualiopi-formation-crons-worker.ts`), qui atterrit
  AVANT que l'app ne migre. Pendant cette fenêtre : la règle `aucun_bareme_opco` lit
  `opco_estimation_origine` → échoue → le moteur la consigne et **suspend la résolution
  automatique du tour** (aucune alerte n'est fermée à tort) ; `listBaremesEnVigueur`
  (sans `select`) rend `[]` en fail-soft, sans effet grâce à cette suspension. Aucune
  forme de job BullMQ ni énumération lue par l'ancienne app n'est modifiée. Transitoire,
  se résorbe à la migration de l'app.
- Contrat `stub.invalid` : aucune lecture au build ; lectures fail-soft inchangées.

## Limites

- Aucun barème de départ inséré (pages OPCO bloquées par le proxy de l'environnement).
- PDF du devis non modifié (avertissement non imprimé ; 0 € possible à ≥ 50 salariés).
- Formulaire `baremes-opco` sans champs IDCC / tranche.
- Réglages `opco_atlas_*` toujours sans source.
```

Sha de tête de la branche de code : **`a5398e43`**
