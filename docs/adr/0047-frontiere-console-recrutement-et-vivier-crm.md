# ADR 0047 — Recrutement : où s'arrête la console, où commence le CRM Pro

- **Statut** : **ACCEPTÉ — les trois arbitrages du §4 ont été tranchés par Will le 2026-09-04**
- **Date** : 2026-09-03
- **Auteur** : Claude, en fermant le lot 6 du chantier « pilotage du recrutement »
- **Référence** : `src/server/vivier/`, `src/server/crm-sync/`, `prisma/schema.prisma` (`JobApplication`, l. 8320-8470), `src/server/auth/habilitations.ts`, PR #952 / #955 / #959 / #961 / #966 / #968

## Pourquoi cet ADR existe

La frontière entre la console du site et le CRM Pro **est déjà implémentée** : deux
drapeaux d'environnement, une fenêtre d'opposition de trente jours, une version de
consentement couplée à une taxonomie qui vit dans un autre dépôt. Elle n'est
documentée **nulle part**. `AGENTS.md` ne contient ni « CRM » ni « vivier » ; les
seules occurrences de « vivier » dans `docs/` parlent du vivier des **apporteurs
d'affaires**, qui n'a rien à voir.

Autrement dit : le comportement le plus délicat du dossier — celui qui envoie des
données personnelles de candidats vers un système tiers — repose sur une décision
qu'aucun document ne porte. C'est le trou que cet ADR ferme.

⚠️ Cet ADR ne décide pas la frontière : **Will l'a déjà tranchée** (décision D1,
`_REPRISE-CHANTIER-RECRUTEMENT.md` §1). Il l'écrit, en nomme les conséquences
vérifiées, et pose les trois questions que la candidature spontanée fait surgir et
que personne n'a encore arbitrées.

## 1. L'état vérifié

### La console porte le recrutement ACTIF

Ce qui vit dans `axion-ia`, et nulle part ailleurs :

| Objet                                                   | Où                                                                   | Depuis       |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ------------ |
| Le dossier de candidature, identité chiffrée, CV, photo | `JobApplication`, `prisma/schema.prisma:8320`                        | origine      |
| Le journal du candidat, en ajout seul                   | `journal.ts`, `timeline.ts`                                          | lot 1 (#959) |
| Les entretiens, les rappels J-1 / H-1                   | `interview-actions.ts`, `rappels-entretien.ts`                       | lot 2 (#961) |
| La décision, son motif obligatoire, son auteur          | `actions.ts`, contrainte SQL `job_applications_motif_coherent_check` | lot 3 (#966) |
| Le pilotage du stock, les dossiers en sommeil, l'export | `pilotage/`, `dossiers-en-sommeil.ts`, `export-csv.ts`               | lot 4 (#968) |
| La provenance du canal (UTM)                            | `provenance.ts`, `provenance-stats.ts`                               | lot 5        |

### Le CRM Pro porte le VIVIER LONG TERME

Et il ne le porte qu'à trois conditions, toutes vérifiables dans le code :

1. **Deux drapeaux, tous deux fermés par défaut.** `CRM_SYNC_ENABLED`
   (`crm-sync-worker.ts`) et `CRM_SYNC_CANDIDATES_ENABLED`
   (`job-application/actions.ts`). Sans eux, rien ne sort.
2. **Une fenêtre d'opposition de trente jours** avant toute intégration —
   `VIVIER_OPPOSITION_WINDOW_DAYS = 30` (`vivier/config.ts`), assortie dans le
   fichier lui-même de l'interdiction explicite de la raccourcir.
3. **Une version de consentement qui doit correspondre à celle du CRM.**
   `VIVIER_STOCK_CONSENT_VERSION = "vivier-stock-2026-08-14"`, couplée à
   `Taxonomy::CANDIDATE_CONSENT_VERSIONS_V2` **dans l'autre dépôt**. Le CRM répond
   **422** sur toute version hors v2 — et les 71 candidatures du stock portent
   encore `careers-v1-2026-06-09`.

🔑 **Une opposition posée APRÈS l'intégration reste vraie.** Le schéma le dit
(`prisma/schema.prisma:8381-8398`) : c'est le CRM qui reçoit alors un `opt_out`,
et **on ne réécrit jamais l'histoire côté site**. C'est la propriété qui rend la
frontière tenable — le site reste la source de vérité du consentement, même pour
une donnée déjà partie.

## 2. La décision — la ligne de partage

> **La console du site pilote le recrutement actif. Le CRM Pro garde le vivier
> long terme.** (Décision D1 de Will.)

Trois corollaires, dont deux sont déjà acquis :

1. **Aucune purge automatique d'un dossier `hired`.** Acquis par la PR #952 :
   la purge RGPD n'efface plus les dossiers des personnes recrutées. On ne
   supprime jamais un dossier tout seul (décision D4 de Will).
2. **Le CRM ne décide rien.** Aucun statut, aucun motif, aucun entretien n'y est
   saisi. Le CRM reçoit ; il ne renvoie pas d'arbitrage dans le dossier.
3. **La console n'implémente pas de vivier.** Elle marque un consentement
   (`consentVivierAt`) et une opposition (`vivierOpposedAt`) ; la conservation
   longue est le métier du CRM.

## 3. ⚠️ Ce que cette décision coûte, et qu'il faut assumer

- **Deux systèmes voient la même personne.** Un effacement demandé au titre de
  l'article 17 doit être joué des deux côtés. `crm-sync/gdpr.ts` existe pour ça ;
  il n'est éprouvé par aucun test de bout en bout.
- **Un couplage inter-dépôts non versionné.** `candidateFamilyForOffer` produit une
  valeur qui doit exister dans un `CHECK` SQL **du CRM**. Une famille ajoutée ici
  sans migration là-bas fait refuser **toutes** les candidatures concernées, pas
  seulement les nouvelles. Ce couplage n'a ni contrat, ni test de compatibilité.
- **Le consentement v1 du stock est un cul-de-sac.** Les 71 candidatures
  `careers-v1-2026-06-09` ne franchiront jamais la frontière sans un
  re-consentement explicite. Ce n'est pas un défaut : c'est le RGPD qui le veut.

## 4. ✅ Les trois arbitrages, TRANCHÉS par Will le 2026-09-04

> **Décisions prises**, après présentation des options et de leurs conséquences :
>
> | Arbitrage                            | Décision de Will                                | État du code               |
> | ------------------------------------ | ----------------------------------------------- | -------------------------- |
> | 1 · Une spontanée va-t-elle au CRM ? | **NON — elle reste dans la console** (option C) | ✅ déjà en place (PR #975) |
> | 2 · `sourceSlug` du payload          | **sans objet** tant que 1 vaut C                | —                          |
> | 3 · Une porte, ou deux ?             | **UNE seule** (option A)                        | ✅ les 4 liens rebranchés  |
>
> ⚠️ **Pour revenir sur l'arbitrage 1** : ajouter d'abord la famille dans le
> `CHECK` SQL du CRM Pro, **puis** activer l'émission. Dans l'autre ordre, le CRM
> refuse _toutes_ les fiches portant cette famille, pas seulement les nouvelles.
> `reconcile.ts` sait rattraper le stock non émis.

### Le détail des options, conservé pour la trace

Ils n'ont jamais été posés, parce que la candidature spontanée n'existe pas encore
comme objet : aujourd'hui elle est une `Submission` du formulaire de contact
(sujet « recrutement »), et le message Telegram annonce **« Candidature
spontanée »** pour un dossier qui n'apparaît dans aucun écran de recrutement.

### Arbitrage 1 — une spontanée franchit-elle la frontière ?

Elle n'a pas d'offre, donc pas de `offer_slug` dans le contrat CRM.

| Option                                               | Conséquence                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Famille dédiée côté CRM** (`candidat_spontane`) | Exige une **migration du `CHECK` SQL distant AVANT** tout envoi. Un envoi anticipé fait échouer toutes les candidatures de cette famille.   |
| **B. `candidat_autre` assumé**                       | Aucune migration distante. On perd la distinction à la lecture du CRM. C'est déjà ce que ferait le `default:` de `candidateFamilyForOffer`. |
| **C. Les spontanées ne sortent pas**                 | Le vivier long terme ne les voit jamais. Simple, réversible, et cohérent avec « le CRM garde ce qui a été qualifié ».                       |

**Recommandation : C d'abord, B ensuite si le besoin apparaît.** Une spontanée
non qualifiée n'a rien à faire dans un vivier long terme tant que personne ne l'a
lue. C'est aussi la seule option qui ne dépende pas d'un déploiement dans l'autre
dépôt.

### Arbitrage 2 — le `sourceSlug` du payload

Aujourd'hui `"site-candidature-offre"`, écrit en dur. Une spontanée devrait-elle
porter `"site-candidature-spontanee"` ? **Même mine que l'arbitrage 1** : les deux
listes bougent avec le CRM. Sans réponse à l'arbitrage 1, celui-ci ne se pose pas.

### Arbitrage 3 — une porte, ou deux ?

Le formulaire de contact garde-t-il sa ligne « recrutement » une fois la page de
candidature spontanée ouverte ?

| Option                                                                 | Conséquence                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Une seule porte** — la ligne « recrutement » disparaît du contact | Un seul chemin, un seul objet, un seul écran. Les liens externes existants vers `/contact` restent valides mais ne trient plus.                                              |
| **B. Deux portes**                                                     | Le même geste produit deux objets différents selon la porte empruntée — une `Submission` ici, une `JobApplication` là. **C'est le motif que ce dépôt paie le plus souvent.** |

**Recommandation : A.**

## 4 bis. 🛑 ORDRE PERMANENT — `VIVIER_STOCK_ENABLED` reste FERMÉ

**Décision de Will, 2026-09-04 : rien ne part au CRM sans sa validation
explicite.** Le drapeau `VIVIER_STOCK_ENABLED` n'est posé nulle part en
production et ne doit pas l'être — ni pour une recette, ni « pour voir passer un
e-mail ».

**État mesuré le 2026-09-05**, sur les deux conteneurs de production (app et
worker) :

| Drapeau                       | Valeur en production | Effet                                             |
| ----------------------------- | -------------------- | ------------------------------------------------- |
| `VIVIER_STOCK_ENABLED`        | **non définie**      | 🛑 la campagne d'information REFUSE de s'exécuter |
| `CRM_SYNC_CANDIDATES_ENABLED` | `true`               | ouvert — sans effet tant que le premier est fermé |
| `CRM_SYNC_ENABLED`            | `true`               | ouvert — sans effet tant que le premier est fermé |

⚠️ **Le piège de lecture est là, et il est exactement à l'envers de l'intuition.**
Les deux drapeaux `CRM_SYNC_*` sont **ouverts**. Qui les lit d'abord conclut que
le canal l'est aussi — c'est faux : c'est `VIVIER_STOCK_ENABLED` qui déclenche
l'envoi, et lui seul. Le risque symétrique est pire : poser ce drapeau « puisque
les deux autres sont déjà ouverts » ouvre le canal pour de bon.

🔑 **Et l'ouverture ne se referme pas comme elle s'ouvre.** Le § 5 ci-dessous
décrit une fermeture propre et une réouverture coûteuse. Il manque le sens qui
compte ici : une fois le drapeau POSÉ et la campagne partie, le refermer arrête
les envois suivants mais ne rappelle aucun e-mail et ne remet à zéro aucun
`vivierInfoSentAt` — donc il ne rejoue pas la fenêtre d'opposition de 30 jours
qui vient de démarrer pour ces candidats. « On rouvrira si ça ne va pas » n'est
pas une sortie.

L'ordre est également écrit **à côté du drapeau lui-même**, dans
`src/server/vivier/config.ts` — un journal que personne ne relit ne protège rien.

## 5. Comment revenir sur cette décision

La frontière est portée par deux drapeaux d'environnement. La fermer se fait sans
déploiement : `CRM_SYNC_CANDIDATES_ENABLED=false` suffit à arrêter les envois, et
les oppositions déjà posées restent vraies côté site. **La rouvrir, en revanche,
n'est pas symétrique** : les dossiers créés pendant la fermeture n'auront pas été
émis, et `crm-sync/reconcile.ts` est le seul chemin qui les rattraperait. Il n'est
éprouvé par aucun test sur ce cas précis.
