# Audit : peut-on paramétrer dès maintenant des campagnes de ~100 contenus par jour ?

Audit du 2026-11-27, branche `docs/audit-campagnes-100-par-jour`. Lecture du code seulement : aucun code modifié, aucun test lancé (voir « Limites de l'audit »). Il réunit trois sous-audits (paramétrage et diversité ; anti-doublon, qualité et appels à l'action ; coût, cadence et indexation), puis une contre-vérification de leurs affirmations dans le code (section « Vérifications »).

## Réponse courte

**Pour 100 contenus par jour : non, pas maintenant. Pour une campagne propre à ~15-20 contenus par jour : oui, mais seulement après une poignée de correctifs (P0 ci-dessous).**

- **Le code bloque lui-même les 100 par jour.** Un plafond global de génération est fixé à 20 par jour (15 en production d'après le commentaire du code). Les dépenses Claude ne peuvent pas dépasser **20 $/jour ni 300 $/mois**, quoi qu'on saisisse en base.
- **Le budget décidé ne suffit pas.** 200 $/mois font **~6,67 $ par jour en moyenne**. Équipe éditoriale complète (~1,05 $ par article) : **~5-6 articles/jour**. Génération seule (~0,33 $ par article) : **~19-20 articles/jour**. 100 par jour coûteraient **×5** (génération seule, ~990 $/mois) à **×16** (équipe complète, ~3 150 $/mois) le budget.
- ⚠️ **Ces coûts par article sont des ESTIMATIONS, pas des mesures.** Ils sont reconstitués à partir des plafonds de jetons lus dans le code. La requête SQL qui mesure le coût réel est fournie plus bas : il faut la lancer avant toute décision chiffrée.
- **Même avec le budget, la qualité ne tiendrait pas à 100 par jour.** Le vivier de mots-clés s'épuise en quelques jours, les fenêtres anti-doublon sont trop courtes, le fact-check passe après la mise en ligne, et les appels à l'action se contredisent (« Réserver un appel » vers une page de réservation, alors que la règle est une prise de contact humaine).
- **Recommandation :** corriger les P0, démarrer à 5 par jour, puis monter par paliers (5 → 10 → 20) selon l'indexation constatée dans la Search Console.

## Ce qui est prêt

| Élément                                                                                                   | Où                                                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Assistant de création de campagne (volume, % activité, % intention, % types, villes, durée)               | `src/server/actions/content-gen/campaign-wizard.ts:94-140`                    |
| Alternance des types de contenu (plus grand reste)                                                        | `src/server/content-gen/scheduler/type-sequence.ts`                           |
| Rotation des mots-clés, réservation atomique, verrou Redis par mot-clé                                    | `keyword-selector.ts:200-223`, `content-gen-worker.ts:579-609`                |
| Blocage avant l'appel au modèle des titres quasi identiques (Levenshtein ≥ 0,85)                          | `quality/dedup-guard.ts:113-114`                                              |
| Interdits rejoués à la génération **et** à la publication (ville interdite, frais, faux témoignage, etc.) | `content-gen-worker.ts:1372-1400`, `content-publish-worker.ts:395-404`        |
| Porte budgétaire Claude bloquante avant dépense (jour, mois, réservation sous verrou de base)             | `providers/blog-claude.ts:108-118`, `providers/blog-claude-ledger.ts:270-286` |
| Plafond de coût par article en circuit équipe (3 $, 2 renvois au plus)                                    | `equipe/redacteur-en-chef.ts:47-48`                                           |
| Structure citable : réponse directe 40-80 mots, FAQ, passages citables, JSON-LD                           | `generators/blog-article.ts:81`, `quality/passages-citables.ts:8-10`          |
| IndexNow et sitemap du blog                                                                               | `indexing/enqueue.ts:177-200`, `app/sitemap-blog.xml/route.ts:40`             |
| Offre Journée IA jamais publiée sans humain                                                               | `content-gen-worker.ts:1565-1572`                                             |

## Ce qui manque, est partiel ou absent

| Constat                                                                                                                 | État       | Où                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Plafond global de génération : 20/jour par défaut, 15 en production. Aucun écran ne le lit ni ne le règle               | Bloquant   | `scheduler/anti-burst.ts:107-119`, `content-orchestrator-worker.ts:827-847` et `:1114-1119`               |
| L'assistant propose « 1 à 1000 contenus par jour » sans signaler ce plafond                                             | Trompeur   | `campaigns/new/_v2/CampaignWizardV2.tsx:844-853`                                                          |
| Bornes de garde du code : 20 $/jour et 300 $/mois                                                                       | Bloquant   | `providers/blog-claude-ledger.ts:26-27`, `providers/blog-claude-plafonds.ts:11-12`                        |
| Plafond de publication : rampe de 150/jour sous 1 000 articles publiés, donc aucune protection pour un site jeune       | À caler    | `content-publish-worker.ts:139-149`                                                                       |
| « Plafond de contenus par ville » saisi dans l'assistant mais jamais enregistré                                         | Absent     | `campaign-wizard.ts:103` (validé), absent de `prisma.coverageCampaign.create` (`:185-216`)                |
| Date de début ignorée : la campagne est créée `running` ou `draft`, jamais `scheduled`                                  | Partiel    | `campaign-wizard.ts:188`, `content-gen-scheduler-worker.ts:23-27`                                         |
| Mode « manuel » (quotas absolus) enregistré, jamais lu par l'orchestrateur                                              | Absent     | `campaign-wizard.ts:108` ; aucune occurrence de `mixMode` dans `content-orchestrator-worker.ts`           |
| File globale des villes limitée aux 200 premières (sur ~2 157 villes décrites)                                          | Partiel    | `content-orchestrator-worker.ts:483-488`                                                                  |
| Tirage des axes sur un cycle de 100 : intention, audience, activité, secteur dépendent tous du même compteur            | Partiel    | `content-orchestrator-worker.ts:152-172`, `:208-237`, `:638-650`                                          |
| L'intention propre du mot-clé ne prime jamais (défauts globaux 50/25/15/5/5 toujours présents)                          | Partiel    | `intent-distribution-schema.ts:130-136,168`, `content-orchestrator-worker.ts:953-958`                     |
| Variante de gabarit (`templateVariant`) jamais transmise aux générateurs                                                | Absent     | aucun producteur dans `src/server` ; `blog-from-keywords.ts:121` retombe sur « transversal »              |
| `blog_from_rss` proposé par l'assistant alors qu'il est interdit dans le mélange éditorial                              | Incohérent | `campaign-wizard-constants.ts:22`, `editorial-mix-rules.ts:26` (vérifié seulement dans `coverage.ts:376`) |
| Action `createCampaign` (séquentiel, cron, département/région) : plus aucun appelant                                    | Code mort  | `src/server/actions/content-gen/coverage.ts:363`                                                          |
| Comparaison sémantique par embeddings : le gardien reçoit des voisins vides                                             | Absent     | `content-gen-worker.ts:840` (`voisins: async () => []`)                                                   |
| Empreinte de sujet avant l'appel au modèle : calculée puis jetée                                                        | Absent     | `quality/dedup-guard.ts:196-202` (`void fingerprint`)                                                     |
| Fenêtres anti-doublon trop courtes pour 3 000 contenus/mois (plagiat 200, plan 1 000, titres 5 000, surveillance 2 000) | Partiel    | `content-gen-worker.ts:205`, `dedup-guard.ts:114` et `:267`, `content-similarity-monitor-worker.ts:70`    |
| Empreinte sémantique absente (clé Voyage manquante ou erreur) : contrôle sauté sans trace                               | Partiel    | `content-gen-worker.ts:1614-1617`                                                                         |
| Fact-check après publication ; sources non enregistrées                                                                 | Partiel    | `content-fact-check-worker.ts:1-20`, `:271-288` (`sourceUrl` jamais rempli)                               |
| Fact-check Claude bloquant : prêt, mais éteint (3 drapeaux)                                                             | Éteint     | `fact-check/fact-check-claude-drapeau.ts:10-18`                                                           |
| Un job refusé pour plafond de coût n'est jamais relancé (classé « inconnu » = permanent)                                | Partiel    | `providers/blog-claude-ledger.ts:275-279`, `recovery/failure-classifier.ts:106-116`                       |
| Rythme de l'équipe (`equipe_articles_max_jour`) appliqué aux mises à jour seulement, pas aux nouveaux articles          | Partiel    | `scheduler/anti-burst.ts:155-221`, seul appelant `equipe/mise-a-jour.ts:159`                              |
| Aucun écran pour ajouter des mots-clés au vivier ni les rattacher à une campagne                                        | Absent     | colonne `campaign_id` (`prisma/schema.prisma:3579`) sans écran                                            |
| `llms.txt` ne cite pas le blog ni les guides                                                                            | Partiel    | `src/app/llms.txt/route.ts:114`                                                                           |
| Aucun relecteur humain déclaré sur les articles                                                                         | Absent     | `blog/[slug]/page.tsx:427-470`                                                                            |

## Risques

| Risque                                            | Ce qui se passe                                                                                                                                                                                                                                                                                                                                                                     | Où                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doublons**                                      | Vivier d'environ 1 750 mots-clés (≈ 270-340 par activité) : une campagne mono-activité à 100/jour en fait le tour en 3-4 jours. Un mot-clé citant une grande ville peut tomber sur un job ancré ailleurs (aucun filtre ville dans la sélection). Le code cite un précédent de 73 % de rejets.                                                                                       | `src/content/keywords/*`, `keyword-selector.ts:157-167`, `:200-223`                                                                                 |
| **Pénalité Google « contenu de masse »**          | Publication automatique de tout ce qui passe les barrières (`factoryAutoPublishAllBlogTypes` vrai par défaut). C'est le schéma visé par la règle anti-spam sur le contenu produit en masse, désormais appliquée aussi aux réponses génératives (sources en fin de document).                                                                                                        | `content-gen-worker.ts:1918-1920`                                                                                                                   |
| **Coût**                                          | La réservation se fait au coût maximal (30 000 jetons supposés par recherche web) : avec 5 jobs en parallèle, le plafond du jour peut se déclencher bien avant la dépense réelle, et les jobs refusés sont perdus.                                                                                                                                                                  | `clients/claude-search.ts:38`, `:150-166`                                                                                                           |
| **CTA contradictoires**                           | Le prompt demande « Diagnostic IA 45 min, page contact, aucun lien de réservation ». Le code injecte pourtant « Réserver un appel avec Axion-IA » vers `/appel` (widget Calendly) pour l'intention transactionnelle. La regex des interdits ne rattrape pas ce libellé. Le bloc de fin de page ne propose que la Journée IA, et le maillage envoie « diagnostic IA » vers `/audit`. | `quality/intent-enforcement.ts:67-68,189-190`, `brand/positionnement.ts:29`, `blog/[slug]/page.tsx:839-851`, `links/internal-link-catalog.ts:33-40` |
| **Fact-check après publication**                  | Un chiffre faux reste en ligne jusqu'au passage de Perplexity, puis est corrigé en place.                                                                                                                                                                                                                                                                                           | `content-fact-check-worker.ts:312-358`                                                                                                              |
| **Correction auto sans recontrôle des interdits** | Le texte réécrit par le modèle n'est contrôlé que pour la Journée IA (`exigeRelectureHumaine`). Ni la ville interdite, ni les frais, ni les faux témoignages ne sont recontrôlés, et il n'y a pas d'import de `detecterInterditsSurface`.                                                                                                                                           | `content-fact-check-worker.ts:326-336`                                                                                                              |
| **Date de modification**                          | `dateModified` vient de `updatedAt` : elle bouge quand le score de fact-check ou le niveau change, sans que le contenu change. La page annonce aussi un cycle de mise à jour de 90 jours que personne n'applique.                                                                                                                                                                   | `prisma/schema.prisma:1019`, `content-fact-check-worker.ts:299`, `blog/[slug]/page.tsx:777`                                                         |
| **Ville interdite non exclue comme ancrage**      | Une ville interdite par la doctrine est dans la liste des villes pilotes et n'est retirée ni de la file ni par l'orchestrateur. Le prompt d'ancrage impose de citer la ville : chaque job ancré sur elle est **produit et payé, puis bloqué** en relecture.                                                                                                                         | `actions/content-gen/city-coverage.ts:79`, `content-orchestrator-worker.ts:461-492`, `local/local-anchor.ts:112`                                    |
| **Jobs produits puis bloqués**                    | Même mécanisme pour les doublons de plan, de plagiat ou de sujet : ils sont détectés **après** l'appel au modèle, donc payés. Seuls les titres sont arrêtés avant.                                                                                                                                                                                                                  | `content-gen-worker.ts:1271-1278`, `:1343-1368`, `:1614-1638`                                                                                       |
| **Auteur**                                        | Persona IA « Manon », déclarée comme `Organization` avec un portrait IA. C'est transparent, mais sans relecteur humain visible.                                                                                                                                                                                                                                                     | `lib/seo-content-gen-factories.ts:55-71`                                                                                                            |

## Coût : estimations et mesure

| Circuit (estimé)           | Coût/article | 100/jour coûte          | Dans 200 $/mois (6,67 $/j) | Dans les bornes du code (300 $/mois) |
| -------------------------- | ------------ | ----------------------- | -------------------------- | ------------------------------------ |
| Équipe éditoriale complète | ~1,05 $      | ~105 $/j, ~3 150 $/mois | **~5-6/jour**              | ~9/jour                              |
| Génération Claude seule    | ~0,33 $      | ~33 $/j, ~990 $/mois    | **~19-20/jour**            | ~30/jour                             |

Ces estimations s'appuient sur les tarifs déclarés dans le code (Sonnet 5.5 : 2 $ / 10 $ par million de jetons, `providers/anthropic.ts:64-69` ; Opus 5.5 : 4 $ / 20 $, `:58-63`) et sur la recherche web à 10 $ les 1 000 (`clients/claude-search.ts:30`). Les volumes de jetons par étape sont supposés. Le pilotage SEO/GEO prend en plus jusqu'à 2 $/jour et 30 $/mois sur la même enveloppe (`docs/pilotage-seo-geo/PLAN.md:263-271`).

**Mesurer avant de décider** (lecture seule, base de production) :

```sql
SELECT j."contentType", COUNT(DISTINCT j.id) AS jobs,
       SUM(l."costUsd") / COUNT(DISTINCT j.id) AS usd_par_job,
       SUM(l."tokensInput") AS jetons_entree, SUM(l."tokensOutput") AS jetons_sortie
FROM cost_ledger l JOIN content_gen_jobs j ON j.id = l."jobId"
WHERE l.provider::text = 'anthropic' AND l."timestamp" > now() - interval '30 days'
GROUP BY 1;
```

Le journal de l'équipe éditoriale enregistre aussi le coût total de chaque article (`content-gen-worker.ts:1254-1263`).

## Indexation et montée progressive

Tout ce qui est publié est forcé en « indexable » (`content-publish-worker.ts:871`). Sur un site jeune, qui fait environ 428 impressions par semaine (`docs/pilotage-seo-geo/PLAN.md:71`), un grand nombre de pages « découvertes, non indexées » envoie à Google un signal de qualité faible.

**Paliers proposés : 5 → 10 → 20 → 35 → 60 → 100 par jour**, chacun tenu 2 à 3 semaines.

Pour passer au palier suivant, il faut **tout** cela à la fois :

1. plus de 70 % des URL du palier indexées sous 14 jours dans la Search Console ;
2. une part des pages « découvertes, non indexées » qui n'augmente pas ;
3. moins de 10 % des jobs en relecture pour doublon, ville interdite ou CTA ;
4. un coût réel mesuré (requête ci-dessus) compatible avec le palier suivant.

**Plafond de publication :** poser `MAX_PUBLISH_PER_DAY` en base (clé `ContentGenConfig`, lue à `content-publish-worker.ts:143`) **égal au palier**. Sans cela, la rampe par défaut à 150/jour s'applique. Le plafond de génération (`daily_generation_cap`) se règle lui aussi en base, à palier + ~20 % (marge pour les rejets).

Avec 200 $/mois, la montée s'arrête de fait vers 20 par jour en génération seule. Au-delà, il faut décider du budget **et** relever les bornes du code (PR P3).

## Découpage en petites PR

Taille : S < 1/2 journée, M ≈ 1 journée, L > 1 journée.

### P0 : sécurité, coût, cohérence

| #    | Titre                                                                                                                                                                                                   | Fichiers                                                                                                                                  | Taille | Dépend de | App ↔ worker                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | --------------------------------------------------------------------------------------------------- |
| P0-1 | Exclure la ville interdite de toute file d'ancrage (orchestrateur + amorçage de la file)                                                                                                                | `content-orchestrator-worker.ts` (`resolveVilleAnchors`), `scripts/seed-city-generation-order.ts`, `actions/content-gen/city-coverage.ts` | S      | —         | Worker seul : sans contrat partagé                                                                  |
| P0-2 | Remplacer le CTA de repli « Réserver un appel » `/appel` par « Diagnostic IA 45 min » vers la page contact (prise de contact humaine) ; étendre la regex `reservation-paiement` à « réserver un appel » | `quality/intent-enforcement.ts`, `lib/contenu/interdits-publication.ts`                                                                   | S      | —         | La regex est lue par l'app **et** le worker : tolérant dans les deux sens (elle ne fait que durcir) |
| P0-3 | Recontrôler les interdits après la correction automatique du fact-check (sinon : relecture, pas de réécriture)                                                                                          | `content-fact-check-worker.ts`                                                                                                            | S      | —         | Worker seul                                                                                         |
| P0-4 | Assistant : retirer `blog_from_rss` du mélange, appliquer `assertEditorialKeys`, afficher le plafond global réel à côté du « contenus par jour »                                                        | `campaign-wizard.ts`, `campaign-wizard-constants.ts`, `CampaignWizardV2.tsx`                                                              | S      | —         | App seule                                                                                           |
| P0-5 | Relance des jobs refusés pour plafond (`plafond_jour` → reporté au lendemain, pas perdu)                                                                                                                | `recovery/failure-classifier.ts`, `providers/blog-claude-ledger.ts`                                                                       | S      | —         | Worker seul                                                                                         |
| P0-6 | Écran « plafonds » : lire et régler `daily_generation_cap` et `MAX_PUBLISH_PER_DAY`                                                                                                                     | page admin `content-gen/settings`, action serveur                                                                                         | M      | —         | Valeurs en base, lues par le worker : borner la saisie à ce que le worker accepte déjà              |

### P1 : qualité, doublons

| #    | Titre                                                                                          | Fichiers                                                                              | Taille | Dépend de        | App ↔ worker                                              |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ | ---------------- | --------------------------------------------------------- |
| P1-1 | Journaliser et alerter quand l'empreinte sémantique vaut `null`                                | `content-gen-worker.ts`, `dedup/topic-fingerprint.ts`                                 | S      | —                | Worker seul                                               |
| P1-2 | Brancher les voisins par embeddings dans le gardien (au lieu de `[]`) et recalibrer les seuils | `content-gen-worker.ts:840`, `dedup/nearest-articles.ts`, `dedup/embedding-*`         | M      | P1-1             | Worker seul                                               |
| P1-3 | Élargir les corpus anti-doublon (plagiat, plan, accroche) par une recherche indexée            | `content-gen-worker.ts`, `quality/dedup-guard.ts`, `anti-redite-accroche.ts`          | M      | P1-2             | Worker seul                                               |
| P1-4 | Fact-check avant publication : enregistrer `sourceUrl` et la date ; option bloquante           | `content-fact-check-worker.ts`, drapeaux fact-check Claude                            | M      | Décision de Will | Drapeau d'environnement à poser **sur le worker d'abord** |
| P1-5 | `dateModified` sur changement de contenu seulement ; retirer ou tenir la promesse des 90 jours | `lib/seo-content-gen-factories.ts`, `blog/[slug]/page.tsx`, schéma (colonne nullable) | M      | —                | Nouvelle colonne **nullable** (règle symétrique)          |
| P1-6 | Contrôle de présence du CTA attendu (Diagnostic 45 min ou Journée IA, vers contact)            | `quality/intent-enforcement.ts`, `quality/barrieres-publication.ts`                   | S      | P0-2             | Worker seul                                               |
| P1-7 | CTA « Diagnostic IA 45 min » dans le gabarit de fin d'article, à côté de la Journée IA         | `blog/[slug]/page.tsx`                                                                | S      | Décision CTA     | App seule                                                 |

### P2 : diversité, stock

| #    | Titre                                                                              | Fichiers                                                                  | Taille | Dépend de | App ↔ worker                                                                  |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ | --------- | ----------------------------------------------------------------------------- |
| P2-1 | Tirages indépendants par axe (hachage du slot par axe au lieu d'un même `mod 100`) | `content-orchestrator-worker.ts:152-237`                                  | S      | —         | Worker seul                                                                   |
| P2-2 | Transmettre `templateVariant` (activité) aux générateurs                           | `content-gen-worker.ts`                                                   | S      | —         | Worker seul                                                                   |
| P2-3 | Laisser primer l'intention du mot-clé ; retirer `navigational` du repli            | `content-orchestrator-worker.ts:953-958`, `intent-distribution-schema.ts` | S      | —         | Worker seul                                                                   |
| P2-4 | Filtrer les mots-clés géo sans rapport avec la ville d'ancrage                     | `keyword-selector.ts`                                                     | S      | —         | Worker seul                                                                   |
| P2-5 | Enregistrer et appliquer « plafond par ville » et la date de début (`scheduled`)   | `campaign-wizard.ts`, schéma, orchestrateur                               | M      | —         | Colonne nullable ; **worker capable de lire d'abord**, puis l'app qui l'écrit |
| P2-6 | Écran d'ajout de mots-clés au vivier, alerte d'épuisement par activité             | page admin, action, `keyword-selector.ts`                                 | L      | —         | App d'abord (écriture), worker ensuite (alerte)                               |
| P2-7 | File globale au-delà de 200 villes, en rotation                                    | `content-orchestrator-worker.ts:483-488`                                  | S      | P0-1      | Worker seul                                                                   |

### P3 : montée en charge

| #    | Titre                                                                                                                                                      | Fichiers                                 | Taille | Dépend de       | App ↔ worker                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P3-1 | Mesure réelle du coût par article et par étape (tableau de bord à partir de `cost_ledger`)                                                                 | page admin, requête                      | M      | —               | App seule                                                                                                                               |
| P3-2 | Réservation de coût moins pessimiste (jetons par recherche, sortie maximale)                                                                               | `clients/claude-search.ts`               | S      | P3-1            | Worker seul                                                                                                                             |
| P3-3 | Relever les bornes 20 $/300 $ (**PR worker d'abord** : `blog-claude-ledger.ts`, `blog-claude.ts` ; **puis** PR app : `blog-claude-plafonds.ts` et l'écran) | voir titre                               | S + S  | Décision budget | **Règle symétrique** : si l'app accepte une valeur que le worker refuse encore, tous les appels Claude sont refusés (`config_invalide`) |
| P3-4 | API Batch (−50 % sur les jetons) pour les formats courts                                                                                                   | `providers/anthropic.ts`, pipeline       | L      | P3-1            | Forme de job modifiée : le worker doit lire l'ancienne et la nouvelle forme                                                             |
| P3-5 | Appliquer le rythme de l'équipe aux nouveaux articles                                                                                                      | `scheduler/anti-burst.ts`, orchestrateur | S      | —               | Worker seul                                                                                                                             |

## Décisions pour Will

1. **Budget.** « Acceptez-vous de passer à **300 $/mois**, le maximum que le code autorise aujourd'hui, pour viser environ **30 articles/jour en génération seule** ? » Pour 35 articles/jour, il faudrait environ 350 $/mois et une modification du code (P3-3).
2. **Circuit.** « Préférez-vous **6 articles/jour vérifiés par l'équipe complète** (≈ 1,05 $ chacun), ou **20 articles/jour en génération seule** (≈ 0,33 $), ou un mélange, par exemple 3 piliers en équipe et 15 courts en génération seule ? »
3. **Fact-check bloquant.** « Allume-t-on la vérification Claude avant publication ? Exemple : un article qui annonce “40 % des PME utilisent l'IA” ne part pas tant que le chiffre n'a pas une source datée. » Cela coûte plus cher par article.
4. **Qui relit ?** « Un humain relit-il chaque article avant la mise en ligne pendant les deux premiers paliers ? Exemple : 5 articles par jour, environ 10 minutes chacun. »
5. **CTA unique.** « Chaque article se termine-t-il par **un seul** appel : “Diagnostic IA gratuit de 45 min, un conseiller vous rappelle” vers la page contact, avec la Journée IA en lien secondaire ? » (Plus aucun lien « Réserver un appel » vers une page de réservation.)
6. **Auteur.** « Signe-t-on avec un **nom d'auteur humain réel** qui relit, ou garde-t-on la persona IA “Manon” en la déclarant comme telle ? Exemple : “Rédigé avec l'IA, relu par [prénom nom]”. »
7. **Montée progressive.** « Validez-vous les paliers 5 → 10 → 20, avec passage seulement si plus de 70 % des pages sont indexées sous 14 jours ? »
8. **Mesure d'abord.** « Peut-on lancer la requête de coût réel sur la base de production avant de fixer les chiffres ? »

## Vérifications

Les affirmations des trois sous-audits ont été rouvertes dans le code, à la ligne citée.

**61 affirmations vérifiées ; 4 corrigées ; 1 nuancée ; 6 non vérifiables ici.**

Vérifiées et confirmées :

- **Plafonds :** plafond global de 20 par jour (15 en production d'après le commentaire), appliqué puis `break` ; part de 50 % pour la reprise ; aucun écran ne règle cette clé ; assistant « 1 à 1000 » ; rampe de publication à 150/jour, de 8 h à 22 h.
- **Paramétrage des campagnes :** `createCampaign` sans appelant ; cible forcée à `dailyArticles × 30` ; `targetPerCity` validé mais non enregistré ; `mixMode` jamais lu ; `take: 200` ; date de début ignorée ; date de fin respectée ; `blog_from_rss` proposé malgré l'interdiction.
- **Diversité :** cycle `mod 100` (décalages 73/91/53) ; défauts d'intention 50/25/15/5/5 ; `allowKeywordIntent` toujours faux ; variante de gabarit jamais passée ; `templateVariant` sans producteur.
- **Anti-doublon :** voisins par embeddings vides ; `verdictPourVoisinLePlusProche` sans appelant ; `void fingerprint` ; corpus 200 / 1 000 / 5 000 / 50 000 / 2 000 ; empreinte `null` sautée sans trace.
- **Publication et fact-check :** niveau `tier_1_indexable` forcé ; fact-check après publication ; correction en place sans contrôle des interdits ; `sourceUrl` non rempli ; 3 drapeaux pour le fact-check Claude.
- **CTA :** repli `/appel` « Réserver un appel » ; regex `reservation-paiement` qui ne couvre pas ce libellé ; regex de CTA trop large ; consigne Diagnostic 45 min ; bloc de fin Journée IA seul ; « diagnostic IA » lié à `/audit` ; `/appel` avec Calendly ; `llms.txt` sans blog.
- **Fraîcheur, auteur, publication automatique :** `updatedAt @updatedAt` ; cycle de 90 jours affiché ; Manon déclarée `Organization` ; publication automatique complète vraie par défaut.
- **Coût :** bornes 20/300 ; défauts 10/200 ; modèles Sonnet et Opus 5.5, avec leurs tarifs dans le code ; recherche web à 10 $/1 000 et 30 000 jetons supposés par recherche ; 3 $ et 2 renvois par article ; 0,30 $ et 2 passes ; refus pour plafond en `UnrecoverableError` non relancé ; concurrence 5 et 10/min.
- **Ville interdite et garde-fous :** ville interdite dans les villes pilotes et non exclue des ancrages ; ancrage qui impose la ville ; blocage en relecture ; rythme de l'équipe appliqué aux mises à jour seulement.
- **Stock et code dormant :** stock de mots-clés ; 42 villes avec données économiques ; 40 villes indexables ; `assertWithinPhaseQuotas` et `computeNextVillePhase` sans appelant ; sous-plafond du pilotage de 2 $/30 $.

Corrigées :

1. **Villes décrites :** 2 157 et non 2 158 (`src/content/villes/data`).
2. **Mots-clés étiquetés :** 1 749 et non 1 747 (337 + 273 + 325 + 321 + 270 + 223).
3. **Bornes de garde côté app :** `blog-claude-plafonds.ts:11-12`, et non `:23-24`.
4. **Valeurs par défaut 10 $ / 200 $ :** `blog-claude-plafonds.ts:126-127`, et non `:139-140`.

Nuancée :

- « Une ville de la file globale reçoit toujours la même combinaison ». Le compteur vaut `generatedCount + i` (`content-orchestrator-worker.ts:638`). L'effet est réel tant que ce compteur avance d'un pas par créneau ; un saut (job non créé) décale la combinaison. C'est une **tendance déduite du code**, pas une certitude mesurée.

Non vérifiables ici :

- les coûts par étape (estimations du sous-audit c) ;
- le prix de Haiku 5.5 et sa compatibilité avec la recherche web ;
- les valeurs réelles en production ;
- les mises à jour anti-spam d'août et de septembre 2026, rapportées par la presse SEO (voir les sources) ;
- la présence de la ville interdite dans le top 200 de la file en base ;
- le palier de débit Anthropic du compte.

## Limites de l'audit

- **Variables de production non vues** : `daily_generation_cap`, `MAX_PUBLISH_PER_DAY`, plafonds Claude en base, `CONTENT_EQUIPE_EDITORIALE`, `CONTENT_GEN_FACTCHECK_CLAUDE`, `VOYAGE_API_KEY`, `OPENAI_EMBEDDINGS_ENABLED`, `QUALITY_PROFILES_ENABLED`, `RESERVATION_DIRECTE_ACTIVE`, contenu de `city_generation_order`, nombre réel de mots-clés en base.
- **Tests non exécutés** : `node_modules` est absent de la session ; aucune suite Vitest ni Playwright n'a tourné. Les constats sont des lectures de code.
- **Coûts non mesurés** : aucune donnée de `cost_ledger` lue ; d'où la requête fournie.
- **Search Console** non consultée : taux d'indexation actuel inconnu.
- Gabarits autres que le blog (actualités, guides, comparatifs) : CTA non audités en détail.

## Sources web

Consultées par les sous-audits ; dates de publication indiquées quand elles sont connues, consultation en novembre 2026.

- Google, _Spam policies for Google Web Search_ (règle « scaled content abuse ») : https://developers.google.com/search/docs/essentials/spam-policies
- Google, _Guidance on using generative AI content_ : https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Google Search Central Blog, _March 2024 core update and new spam policies_ (mars 2024) : https://developers.google.com/search/blog/2024/03/core-update-spam-policies
- Google Search Central Blog, _Top ways to ensure your content performs well in Google's AI experiences on Search_ (mai 2025) : https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search
- Google, _AI features and your website_ : https://developers.google.com/search/docs/appearance/ai-features
- Google, _Creating helpful, reliable, people-first content_ : https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google, _Large site owner's guide to managing your crawl budget_ : https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- PPC Land, _Google spam policies now officially cover AI Overviews and AI Mode_ (2026, presse, non recoupé) : https://ppc.land/google-spam-policies-now-officially-cover-ai-overviews-and-ai-mode-in-search
- GSQi, _August 2026 Google spam update, case studies_ (2026, presse, non recoupé) : https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/
- Search Engine Roundtable, « Crawled / Discovered – currently not indexed » et qualité : https://www.seroundtable.com/google-crawled-discovered-currently-not-indexed-42507.html
- Anthropic, tarifs de l'API : https://docs.claude.com/en/docs/about-claude/pricing
