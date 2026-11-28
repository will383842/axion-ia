# Pilotage SEO et GEO en continu : découpage en PR

> Petites PR, chacune testable seule et éteinte par défaut. Notation : **Pn**.
>
> Règles communes à toutes les PR :
>
> - Ouvrir en **brouillon**, et ne passer en « prête » qu'à la fin du lot (`AGENTS.md`, CI-LOT1).
> - Ne jamais toucher `src/**/journee-ia-commun.ts`, `legal.ts`, `pricing.ts` ou `positionnement.ts`. La **lecture** est permise (score de citabilité, cohérence des faits) ; l'écriture est interdite, et un test le verrouille (P13).
> - Ne jamais écrire « Grenoble » dans un contenu, un gabarit ou une question du panel.
> - Aucun composant client sur les pages publiques. Tout nouveau module serveur porte `import "server-only"` quand il est importable depuis `src/app`.
> - Respecter le contrat de build `stub.invalid`. Les écrans sont en `force-dynamic` et ne font aucun appel réseau au SSG.
> - Respecter la fenêtre app/worker dans les deux sens (D8b) :
>   - la file `seo-pilotage` est nouvelle, et sa charge reste `{ tache, tick }` ;
>   - le worker ignore toute tâche inconnue ;
>   - les colonnes nouvelles sont nullables ou ont une valeur par défaut ;
>   - le worker tolère une table absente (P2021) en sautant le passage.
> - Migrations **additives uniquement** : tables nouvelles, aucun `ALTER` destructif. Après chaque atterrissage d'une migration, vérifier `prisma migrate status` en production (l'entrypoint migre en best-effort).

## 1. Vue d'ensemble et ordre

```
Vague 0 (parallèle)  P0 porte de coût  ·  P0b plancher suivi  ·  P1 client GSC par lot  ·  P3 module pur données  ·  P7 moteur d'opportunités (pur)  ·  P12 score de citabilité (pur)
Vague 1              P2 migration « mesure »  ──►  P4 worker seo-pilotage + ingestion
Vague 2 (parallèle)  P5 inspection  ·  P6a recalcul SiteRoute/KeywordTracking  ·  P8 écran (observation)  ·  P9 rapport hebdo  ·  P10 GEO mesure  ·  P18 alerte indexation
Vague 3              P6b retrait des deux anciens crons (après rattrapage de l'historique + 7 jours de relevés concordants)  ·  P11 panel GEO (après P0 + P10)
— historique Search Console rattrapé (≥ 90 jours remplis, ou tout l'historique) + P13 livrée et testée —
Vague 4              P13 journal + retour arrière  ──►  P14 propositions + file de validation  ──►  P15 mesure d'effet + témoin  ──►  P16 automatique borné
Facultatif           P17 Bing Webmaster (après P4)
```

## 2. Liste des PR

### P0 · Porte de coût pour les appels hors génération, et deux défauts de l'équipe éditoriale

- **But** : rendre utilisables par le pilotage **et** par l'équipe éditoriale les appels Claude qui ne sont pas un job de génération (AUDIT § 5 bis 1 et 2).
- **Contenu** :
  - helper `creerJobPorteur({ origine, plafondJobUsd })`. Il crée une ligne `content_gen_jobs` d'un type existant autorisé, au statut terminal, avec `inputPayload.origine`. Le choix est expliqué dans PLAN § 6.
  - Vérifier que l'orchestrateur, les balayages de `content-gen/recovery` et le moniteur « chaîne à l'arrêt » ignorent ce job porteur.
  - `mise-a-jour-reel.ts` crée son job porteur au lieu de `maj-<id>`.
  - `edition-seo.ts` envoie un type d'énumération existant, et non `blog_edition_seo`.
  - Sous-plafonds `pilotage_cout_max_jour_usd` (2 $) et `pilotage_cout_max_mois_usd` (30 $), lus par le helper. Modèle imposé par la porte : Sonnet 5.5 ou Opus 5.5 (Haiku exclu).
- **Fichiers** :
  - `src/server/content-gen/providers/job-porteur.ts` (nouveau) ;
  - `equipe/mise-a-jour-reel.ts`, `equipe/edition-seo.ts` ;
  - `providers/blog-claude-plafonds.ts` (deux clés de plus).
- **Tests** :
  - la réservation passe avec le porteur et est refusée sans lui ;
  - le cumul commun 10 $/200 $ est respecté ;
  - un sous-plafond atteint donne un refus ;
  - le porteur est invisible pour l'orchestrateur et le recovery ;
  - `edition-seo` n'émet plus de type hors énumération (test sur `Object.values(ContentType)`).
- ⚠️ **Recouvrement** : `feat/equipe-ed-pr12-orchestration` (**non fusionnée**, 27/11) modifie `providers/blog-claude-ledger.ts` (`coutCumuleJobUsd`) et branche `editerSeo` dans `equipe/circuit-article.ts`. **P0 se rebase après la fusion de la PR 12**, ou se coordonne avec elle : la PR 12 doit elle aussi traiter le type `blog_edition_seo`.

### P0b · Plancher d'impressions dans `declencheursMiseAJour`

- **Fichiers** : `equipe/suivi-publication.ts` et son test.
- **Règle** : une baisse de position de 3 places ou plus ne déclenche une mise à jour que si la page a eu au moins 100 impressions sur 28 jours.
- **Tests** : 99 et 100 impressions, et des impressions absentes (`null`, donc aucun déclenchement).
- Recouvrement : fichier issu de la PR 14 de l'équipe éditoriale (fusionnée). La branche distante `feat/equipe-ed-pr14-suivi-publication` est périmée.

### P1 · Client Search Console par lot

- **Fichiers** : `src/server/content-gen/seo/gsc-client.ts`, plus ses tests (`seo/__tests__/`).
- **Contenu** :
  - `gscSearchAnalytics({ startDate, endDate, dimensions, aggregationType, dataState, startRow, rowLimit })`, avec pagination et `fetch` injectable ;
  - `gscDernierJourFinal()` ;
  - `gscSonde()`, qui rend `{ etat: "ok" | "identifiants_absents" | "refus" | "quota" | "erreur" }`, **jamais `null`** ;
  - gestion de 429 / `Retry-After` / `quotaExceeded` ;
  - variante de `gscPageMetricsForUrl` à **dates explicites**.
- Les fonctions existantes gardent leur signature : aucun appelant n'est cassé.
- **Tests** :
  - forme de la requête (`dataState: final`, `byPage`) ;
  - arrêt de la pagination ;
  - réessai sur 429, arrêt sur `quotaExceeded` ;
  - sonde dans les 5 états ;
  - aucun identifiant présent dans les messages d'erreur.

### P2 · Migration additive « mesure »

- **Fichiers** : `prisma/schema.prisma` et `prisma/migrations/<date>_pilotage_seo_mesure/`.
- **Tables nouvelles** :
  - `GscImportRun` ;
  - `GscPageJour` (unique `[date, typeRecherche, chemin]`) ;
  - `GscRequete` (dictionnaire) ;
  - `GscPageRequeteJour` (conservée 90 jours) ;
  - `GscPageRequeteSemaine` (conservée 25 mois) ;
  - `GscInspection` (ligne écrite seulement au changement) ;
  - `SeoOpportunite` (instantané hebdomadaire : détecteur, cible, priorité, état `ouverte|ecartee|traitee` en chaîne de caractères).
- `siteRouteId` est nullable et sans clé étrangère stricte. Les champs `categorie` et `typePage` sont figés à l'import.
- **Aucune table existante n'est modifiée.**
- **Pourquoi une migration** : `ContentGenConfig` (clé → JSON) ne permet ni requête par période, ni index, ni idempotence ligne à ligne. Redis est volatil et soumis à l'éviction.
- **Volumétrie** à mesurer la première semaine avant de figer les durées de conservation. Estimation : ≤ 2,2 M lignes par an pour `GscPageJour`, soit ~300 Mo avec les index, ce qui reste compatible avec les règles disque du VPS.
- **Tests** :
  - test de schéma (présence des `@@unique` et des index) ;
  - le Proxy du stub Prisma couvre `groupBy` et `aggregate` sur ces modèles ;
  - la migration ne contient ni `DROP` ni `ALTER … DROP` (test sur le texte SQL, à l'image des verrous CI existants).

### P3 · Module pur des données (`src/server/seo-pilotage/donnees/`)

- **Fonctions** : `normaliserChemin`, `typePageDepuisChemin` (table de correspondance par préfixe de chemin dans `types-page.ts`, car `categories.ts` n'a ni faq, ni guide, ni actualité ; testée contre `categories.ts` pour ne jamais diverger), `positionSum` et moyennes, `partAnonymisee`, cumul en semaine ISO, `filtrerDonneesPersonnelles`, `filtrerInterdits`.
  - `filtrerDonneesPersonnelles` filtre les e-mails, les téléphones, une liste de noms injectée. **Aucun seuil journalier d'impressions** (il viderait les détecteurs sur un site à ~428 impressions par semaine) : purge en texte des requêtes à moins de 3 impressions cumulées sur 90 jours.
- **Tests** :
  - variantes d'hôte, de slash, de query et de fragment ;
  - `/en/` ramené à FR ;
  - un type de page par section ;
  - frontière d'année ISO ;
  - un nom de personne connu n'est jamais conservé en texte ;
  - position nulle quand il n'y a aucune impression.
- Parallélisable avec P1 et P2.

### P4 · Worker `seo-pilotage` : ingestion, rattrapage, purge

- **Fichiers** :
  - `src/server/queue/workers/seo-pilotage-worker.ts` (nouveau) ;
  - `src/server/queue/queues.ts` (file et crons) ;
  - `src/server/queue/worker.ts` (démarrage) ;
  - `src/server/queue/types.ts` ;
  - `src/server/seo-pilotage/interrupteur.ts`.
- **Interrupteur** : `CONTENT_PILOTAGE_SEO="true"` exact. Mode lu dans `ContentGenConfig.pilotage_seo`, `observation` par défaut.
- **Tâches** : `ingestion-gsc` (appels A, B et C, idempotents), `rattrapage-gsc` (jusqu'à `JOURS_PAR_PASSAGE` = 30 jours par passage, pause entre les jours, arrêt au premier échec dont le quota 429 ; 16 mois remplis en environ 6 heures de passages), `purge` (par lots).
- **Tests** :
  - éteint : aucun appel et aucune écriture ;
  - stub : saut ;
  - table absente (P2021) : saut sans échec ;
  - rejouer un jour donne le même état ;
  - une tâche inconnue est journalisée et ignorée (verrou du défaut AUDIT § 5 bis-4) ;
  - les crons ne tombent pas à la même minute que `site-route-gsc` et `keyword-sync`.

### P5 · Inspection d'URL en rotation, sous quota partagé

- **Fichiers** :
  - `src/server/seo-pilotage/inspection/{rotation,quota}.ts` ;
  - tâche `inspection` du worker ;
  - `content-refresh-worker.ts` : le suivi après publication passe par le compteur partagé `gsc:inspection:quota:<jour>`.
- **Tests** :
  - découpage du quota 200 / 1 400 / 400 ;
  - refus au plafond ;
  - ordre de priorité 1 à 5 ;
  - une ligne n'est écrite qu'au changement ;
  - débit ≤ 300 par minute.
- ⚠️ `content-refresh-worker.ts` a été touché par les PR 14, 16 et 18 de l'équipe éditoriale (fusionnées). Faire un diff minimal, limité au compteur.

### P6a · Recalcul des champs existants depuis l'historique

- **Contenu** : `SiteRoute.gsc*` sur une fenêtre de 28 j homogène, `KeywordTracking` (compatibilité avec la carte des requêtes), et `tier-lifecycle` qui lit la table au lieu d'appeler l'API URL par URL. Tout cela uniquement si `CONTENT_PILOTAGE_SEO` est allumé et que l'historique couvre au moins 28 jours. Sinon, le comportement d'avant est conservé.
- **Fichiers** : `src/server/seo-pilotage/recalcul.ts`, `lifecycle/analytics-clients.ts`.
- **Tests** : mêmes chiffres que l'agrégat de page ; repli sur l'ancien chemin si l'historique est insuffisant.

### P6b · Retrait de `site-route-gsc` et `content-keyword-sync` de la planification

- **Fichiers** : `queues.ts` (crons retirés). Le code des workers est gardé une version, puis supprimé dans une PR ultérieure.
- **Condition** : historique rattrapé (`rattrapage-gsc` terminé) **et** 7 jours de relevés concordants entre l'ancien et le nouveau chemin (mêmes clics, impressions et positions par page), écran « Santé des données » vert. Remplace « au moins 2 semaines après P6a » (décision de Will du 28/11/2026).
- **Test** : verrou sur l'absence des deux `jobId` de cron.

### P7 · Moteur d'opportunités (pur) : `src/server/seo-pilotage/opportunites/`

- **Fichiers** : `detecteurs.ts` (a à f), `courbe-ctr.ts` (régression isotone, marque exclue), `wilson.ts`, `intention.ts` (règles FR, texte non trié, homonymes de villes), `score.ts`, `garde-fous.ts` (`CHEMINS_PROTEGES`, aucune variante « changer d'URL », filtre Grenoble).
- **Réutilise** : `construireCarte` et `normaliserUrl` (`strategie/carte-requetes.ts`), `evaluerSujetCible`, `detecterInterdits`.
- **Tests** : la liste du rapport « intentions » (PLAN § 4), en particulier :
  - bornes 4,9 / 5 / 20 / 20,1 ;
  - Wilson : 0/40 non signalé ;
  - saisonnalité absorbée ;
  - « tarif formation IA Lyon » classé transactionnel avec le drapeau local ;
  - test de propriété : aucune sortie avec « grenoble » ni `nouvelleUrl`.
- Parallélisable dès la vague 0, sur des données synthétiques. La lecture Prisma est branchée dans la tâche `opportunites` de P4 (petit ajout dans P8).

### P8 · Écran « Pilotage SEO & IA », mode observation

- **Fichiers** :
  - `src/app/[locale]/(admin)/[adminPrefix]/content-gen/pilotage/page.tsx` et `_v2/*` (composants serveur) ;
  - `src/server/actions/content-gen/pilotage.ts` (lectures seules) ;
  - entrée de menu dans la console ;
  - lien depuis `keyword-tracking`.
- **Onglets** : Vue d'ensemble (par type de page), Pages, Requêtes, Opportunités, Santé des données. Textes en français simple.
- **Tests** :
  - pilotage éteint : « Pilotage éteint » affiché ;
  - source indisponible : « indisponible », **jamais 0** ;
  - authentification admin requise ;
  - verrou d'absence d'import de `seo-pilotage` depuis `src/components` et les pages publiques.
- **Aucun effet sur le budget Web Vitals**. Le bucket admin du `bundle:check` doit rester sous son cliquet de 470 KB : à mesurer.

### P9 · Section « Pilotage » du rapport hebdomadaire

- **Fichiers** : `content-weekly-report-worker.ts`, `src/server/seo-pilotage/rapport.ts` (pur).
- **Tests** :
  - pilotage éteint : la section est absente ;
  - source indisponible : la phrase l'annonce ;
  - aucune donnée personnelle (aucune requête sous le plancher de 30 impressions sur 28 jours n'est citée).

### P10 · GEO, mesure gratuite

- **Contenu** :
  - extension de `visites-ia.ts` : page d'arrivée × IA, tendance sur 12 semaines ;
  - collecte quotidienne des robots d'IA via l'API GraphQL Analytics de Cloudflare, en agrégats, sans IP ni user-agent brut ;
  - **migration additive** `RobotIaJour` ;
  - onglet « Moteurs IA » de l'écran.
- **Fichiers** : `src/server/analytics/visites-ia.ts`, `src/server/seo-pilotage/geo/robots-cloudflare.ts`, `prisma/` (une table), écran.
- **Prérequis** : décision de Will sur le jeton Cloudflare `Analytics:Read`. Sans ce jeton, l'onglet affiche « indisponible ».
- **Tests** :
  - sans jeton ou avec le stub : « indisponible » ;
  - aucune IP dans l'agrégat ;
  - classement des robots par famille (recherche / entraînement / utilisateur) ;
  - `tracking-referer.ts` est inchangé (verrou existant `referents-ia.spec.ts`).

### P11 · Panel GEO (Claude + `web_search`)

- **Fichiers** :
  - `src/server/seo-pilotage/geo/panel-questions.ts` : 30 questions **versionnées**, **à valider par Will** ;
  - `geo/panel.ts` : **nouvelle fonction d'appel** (Sonnet 5.5 + `web_search`, `max_uses: 2`, sortie maximale ~1 000 jetons, `user_location` France). Elle reprend de `content-gen/clients/claude-search.ts` le motif HTTP et la réservation, pas le prompt de vérification de faits, et utilise le job porteur de P0. Le panel est étalé à 3 questions par jour ouvré ;
  - **migration additive** `GeoPanelReponse` : question, version, moteur, date, URL citées, présence et rang, domaines cités, **sans texte intégral** ;
  - tâche `panel-geo`.
- **Tests** :
  - liste figée (instantané) ;
  - aucune question avec « Grenoble » ni un nom de personne ;
  - réservation avant l'appel ;
  - plafond atteint : passage sauté (_fail-closed_) ;
  - reconnaissance d'`axion-ia.com` et de ses sous-domaines ;
  - aucun appel réseau en test.

### P12 · Score de citabilité et cohérence des faits (sans modèle)

- **Fichiers** :
  - `src/server/seo-pilotage/citabilite/{score,faits}.ts` (purs) ;
  - tâche hebdomadaire de calcul (fetch du HTML public) ;
  - remplacement du stub `scripts/seo-audit.ts` ;
  - correction de `docs/content-gen/seo-aeo-60-items-checklist.md` (le gate annoncé n'existe pas).
- **Faits canon** : **lus** depuis `pricing.ts` et `journee-ia-commun.ts`, jamais recopiés.
- **Tests** : un fixture HTML par critère et par pénalité, une page réelle en instantané, et la détection d'un prix divergent.
- Parallélisable dès la vague 0. ⚠️ Les critères doivent concorder avec les gabarits de `feat/gabarits-articles-conception` (voir § 3).

### P13 · Journal `SeoModification` et retour arrière (prérequis de toute action)

- **Fichiers** :
  - **migration additive** `SeoModification` (index unique partiel « une modification en cours par cible ») ;
  - `src/server/seo-pilotage/actions/{journal,annuler}.ts` ;
  - `equipe/mise-a-jour-reel.ts` : `enregistrer` écrit l'« avant » du corps dans le journal, dans la même transaction (comble l'absence de retour arrière), et pose la date sur `ArticleTranslation.updatedAt` (la date réellement publiée) au lieu de `Article.updatedAt` seul ;
  - Server Action « Annuler ».
- **Tests** :
  - écriture atomique ;
  - annulation refusée en cas de conflit de hash ;
  - restauration du corps et de l'`updatedAt` d'origine ;
  - verrou des 28 jours ;
  - **verrou de source** : aucun module de `seo-pilotage/actions` n'importe `pricing`, `legal`, `positionnement` ni `journee-ia-commun`, et aucun n'écrit de fichier.

### P14 · Propositions et file de validation (mode `proposition`)

- **Contenu** :
  - production des propositions à partir de `SeoOpportunite` : méta et FAQ des articles, FAQ de la table `FAQ`, insertion de liens internes contrôlée, briefs de nouvelles pages, recommandations pour les pages villes et institutionnelles ;
  - application **après validation** : liste blanche de champs, slug vérifié, `controlerConformite`, `updatedAt` d'origine conservé hors corps, revalidation et purge ciblée ;
  - onglets « Propositions » et « En mesure ».
- **Fichiers** : `src/server/seo-pilotage/actions/{proposer,appliquer}.ts`, `equipe/edition-seo.ts` (opération d'insertion de lien), écran.
- **Tests** :
  - matrice PLAN § 5.1 (offre et légal : interdits) ;
  - jetons de prix de la FAQ préservés à l'octet près ;
  - chiffre nouveau refusé ;
  - « Grenoble » refusé ;
  - plafond de 10 propositions ouvertes ;
  - expiration à 14 jours ;
  - `mode=observation` : aucune proposition.
- ⚠️ **Recouvrement** : la PR 12 de l'équipe éditoriale (`circuit-article.ts`) et `feat/gabarits-articles-conception` (format FAQ).

### P15 · Mesure d'effet, groupe témoin, retour arrière automatique

- **Fichiers** : `src/server/seo-pilotage/actions/mesure.ts` (pur : différence de différences, verdicts), tâche `mesure-effets`.
- **Tests** :
  - tirage du témoin déterministe ;
  - « non concluant » sous 300 impressions ;
  - deux relevés consécutifs exigés ;
  - retour automatique seulement si `retour_auto=true`.

### P16 · Mode automatique borné

- **Contenu** : application sans validation des seuls champs de `auto_champs`, en commençant par `metaDescription` des articles. Condition : 20 validations sans retour arrière sur ce champ. Quota `pilotage_modifs_max_jour`.
- **Tests** :
  - champ hors liste : passe en proposition ;
  - compteur des 20 validations ;
  - kill switch lu avant chaque écriture.

### P17 (facultatif) · Bing Webmaster Tools

- **Contenu** : brancher `bing-wmt-client.ts` (code mort aujourd'hui), ajouter les lectures par page et par requête (noms à vérifier), table additive `BingPageSemaine`.
- **Condition** : clé fournie par Will. La clé ne doit jamais apparaître dans un journal.

### P18 · Alerte « indexation stagnante » réparée

- **Contenu** : `checkIndexationStagnant` lit la table `GscPageJour` (vrais chiffres), avec une règle anti-répétition Redis de 30 jours par slug. Le cron passe de toutes les heures à une fois par semaine pour cette veille.
- **Fichiers** : `content-monitoring-worker.ts`, `content-gen/shared/content-gen-alerts.ts` (lecture).
- **Tests** :
  - plus aucun zéro codé en dur ;
  - pas de seconde alerte avant 30 jours ;
  - source indisponible : aucune alerte.

## 3. Recouvrements avec les branches en cours

| Branche                                                                                                  | État le 27/11                                                                                                      | Recouvrement                                                                                                                 | Conduite                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feat/equipe-ed-pr12-orchestration`                                                                      | **Ouverte** (18 fichiers)                                                                                          | `providers/blog-claude-ledger.ts`, `equipe/circuit-article.ts` (branche `editerSeo`), `content-gen-worker.ts`                | **P0 attend sa fusion** et traite avec elle le type `blog_edition_seo`. P14 réutilise `circuit-article`.                                                   |
| `feat/equipe-ed-pr2`, `pr14`, `pr16`, `pr18`                                                             | **Fusionnées** (#2351, #2359, #2389, #2379) ; branches distantes périmées                                          | `content-keyword-sync-worker.ts`, `suivi-publication.ts`, `mise-a-jour*.ts`, `content-refresh-worker.ts`, `charge-de-liens*` | Partir de `main`, ignorer les branches distantes. Diffs minimaux dans P0b, P5 et P13.                                                                      |
| `chore/equipe-ed-pr0` et `feat/equipe-ed-pr1`, `pr3`, `pr4`, `pr5`, `pr7`, `pr8`, `pr10`, `pr11`, `pr13` | Fusionnées (#2356, #2354, #2357, #2362, #2363, #2352, #2353, #2358, #2372, #2364) ; branches distantes résiduelles | Aucun fichier commun direct                                                                                                  | —                                                                                                                                                          |
| `feat/images-blog-qualite`                                                                               | Ouverte                                                                                                            | `content-gen/images/*`, `content-publish-worker.ts`, `providers/unsplash.ts`, `actions/content-gen/hero-backfill.ts`         | Aucun fichier commun. P14 ne republie rien par `content-publish`.                                                                                          |
| `feat/gabarits-articles-conception`                                                                      | Conception (docs)                                                                                                  | Gabarits d'articles, dont FAQ et définition. `templateVariant` intervient dans la construction des URL d'article             | P12 aligne ses critères sur ces gabarits. P14 produit les FAQ au format du gabarit FAQ. Les URL sont construites par `buildArticlePath`, jamais à la main. |
| `geo/*` (llms.txt, pages offres, villes, glossaire…) et `fix/seo-*`                                      | Nombreuses, diverses                                                                                               | `src/app/_llms/*`, pages offres et villes                                                                                    | Le chantier **lit** ces pages et ne les modifie pas. P12 peut signaler des écarts de faits, que ces branches corrigent.                                    |

## 4. Estimation

| Vague | PR                        | Taille        | Remarque                                        |
| ----- | ------------------------- | ------------- | ----------------------------------------------- |
| 0     | P0, P0b, P1, P3, P7, P12  | S à M chacune | Indépendantes                                   |
| 1     | P2, P4                    | M             | La seule migration « lourde »                   |
| 2     | P5, P6a, P8, P9, P10, P18 | S à M         | Parallèles                                      |
| 3     | P6b, P11                  | S             | —                                               |
| 4     | P13 → P14 → P15 → P16     | M, M, S, S    | Séquentielles, après rattrapage de l'historique |

Le mode observation est livrable en **vagues 0 à 2**. Aucune action sur le site n'est possible avant la vague 4.
